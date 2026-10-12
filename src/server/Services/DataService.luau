--!strict
-- Loads, autosaves and releases player data with session locking.
--
-- Guarantees:
--   * Only one server owns a player's data at a time. A record carries a lock { SessionId, Timestamp };
--     a server never writes a record whose lock it does not hold, so a stale server cannot overwrite
--     progress made on a newer one.
--   * A lock left behind by a crashed server is treated as abandoned after LOCK_TIMEOUT seconds.
--   * Players whose data fails to load are kicked rather than allowed to play on unsaved data.
--   * Data written by a newer schema version is never loaded (and therefore never downgraded).
--   * Every profile is saved and released on leave and on server shutdown.
--
-- In Studio without "Studio Access to API Services", a temporary in-memory store is used instead.

local DataStoreService = game:GetService("DataStoreService")
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local PlayerDataSchema = require(script.Parent.Parent.Data.PlayerDataSchema)

type PlayerData = PlayerDataSchema.PlayerData

local STORE_NAME = "PlayerData"
local KEY_PREFIX = "Player_"
local AUTOSAVE_INTERVAL = 60
local LOCK_TIMEOUT = 300
local LOCKED_RETRY_ATTEMPTS = 6
local LOCKED_RETRY_DELAY = 5
local REQUEST_ATTEMPTS = 3
local SHUTDOWN_TIMEOUT = 25

local SESSION_ID = HttpService:GenerateGUID(false)

type Profile = {
	Player: Player,
	Key: string,
	Data: PlayerData,
	Released: boolean,
}

type LoadOutcome = "Loaded" | "Locked" | "Corrupt" | "NewerVersion"

local DataService = {}

local store: DataStore = DataStoreService:GetDataStore(STORE_NAME)
local useMemoryStore = false
local memoryRecords: { [string]: any } = {}

local profiles: { [Player]: Profile } = {}
-- Keys whose final save is still in flight on this server; a rejoin waits for it before loading.
local releasingKeys: { [string]: boolean } = {}
local loadedCallbacks: { (Player, PlayerData) -> () } = {}

local function log(message: string)
	print("[DataService] " .. message)
end

local function logWarning(message: string)
	warn("[DataService] " .. message)
end

local function isValidLock(lock: any): boolean
	return type(lock) == "table" and type(lock.SessionId) == "string" and type(lock.Timestamp) == "number"
end

-- Runs an UpdateAsync with retries. `transform` receives the raw stored value and returns the new
-- value, or nil to cancel the write. It may run more than once and must not yield.
local function updateRecord(key: string, userId: number, transform: (old: any) -> any): (boolean, string?)
	if useMemoryStore then
		local result = transform(PlayerDataSchema.DeepCopy(memoryRecords[key]))
		if result ~= nil then
			memoryRecords[key] = PlayerDataSchema.DeepCopy(result)
		end
		return true, nil
	end

	local lastError: string? = nil
	for attempt = 1, REQUEST_ATTEMPTS do
		local ok, err = pcall(function()
			store:UpdateAsync(key, function(old: any)
				local new = transform(old)
				if new == nil then
					return nil
				end
				return new, { userId }
			end)
		end)
		if ok then
			return true, nil
		end
		lastError = tostring(err)
		logWarning(string.format("UpdateAsync failed for %s (attempt %d/%d): %s", key, attempt, REQUEST_ATTEMPTS, lastError or "?"))
		if attempt < REQUEST_ATTEMPTS then
			task.wait(2 ^ attempt)
		end
	end
	return false, lastError
end

local function saveProfile(profile: Profile, release: boolean): boolean
	local snapshot = PlayerDataSchema.DeepCopy(profile.Data)
	local lockLost = false

	local ok = updateRecord(profile.Key, profile.Player.UserId, function(old: any)
		lockLost = false
		if type(old) ~= "table" or not isValidLock(old.Lock) or old.Lock.SessionId ~= SESSION_ID then
			lockLost = true
			return nil
		end
		return {
			Data = snapshot,
			Lock = if release then nil else { SessionId = SESSION_ID, Timestamp = os.time() },
		}
	end)

	if not ok then
		logWarning("Save failed for " .. profile.Key .. "; will retry on next autosave or release.")
		return false
	end
	if lockLost then
		logWarning("Lock for " .. profile.Key .. " is held by another session; this server's copy was not saved.")
		if not profile.Released then
			-- Another server owns this player now. Stop this session before it diverges further.
			profile.Released = true
			profiles[profile.Player] = nil
			profile.Player:Kick("Your progress was opened on another server. Please rejoin.")
		end
		return false
	end
	return true
end

local function releaseProfile(player: Player)
	local profile = profiles[player]
	if not profile or profile.Released then
		return
	end
	profile.Released = true
	profiles[player] = nil
	releasingKeys[profile.Key] = true
	saveProfile(profile, true)
	releasingKeys[profile.Key] = nil
end

local function loadProfile(player: Player)
	local key = KEY_PREFIX .. player.UserId

	-- If this player just left this same server, let that final save finish first.
	local waitStarted = os.clock()
	while releasingKeys[key] and os.clock() - waitStarted < SHUTDOWN_TIMEOUT do
		task.wait(0.25)
	end

	for attempt = 1, LOCKED_RETRY_ATTEMPTS do
		if player.Parent ~= Players then
			return
		end

		local outcome: LoadOutcome = "Locked"
		local loaded: PlayerData? = nil

		local ok, err = updateRecord(key, player.UserId, function(old: any)
			outcome = "Locked"
			loaded = nil

			if old ~= nil and type(old) ~= "table" then
				outcome = "Corrupt"
				return nil
			end

			local now = os.time()
			if old ~= nil and isValidLock(old.Lock) and old.Lock.SessionId ~= SESSION_ID then
				if now - old.Lock.Timestamp < LOCK_TIMEOUT then
					outcome = "Locked"
					return nil
				end
			end

			local data: PlayerData
			if old == nil or old.Data == nil then
				data = PlayerDataSchema.Default()
			else
				local reconciled, failure = PlayerDataSchema.Reconcile(old.Data)
				if not reconciled then
					outcome = if failure == "NewerVersion" then "NewerVersion" else "Corrupt"
					return nil
				end
				data = reconciled
			end

			outcome = "Loaded"
			loaded = data
			return {
				Data = PlayerDataSchema.DeepCopy(data),
				Lock = { SessionId = SESSION_ID, Timestamp = now },
			}
		end)

		if not ok then
			logWarning("Could not load " .. key .. ": " .. tostring(err))
			player:Kick("We couldn't load your progress. Please rejoin in a moment.")
			return
		end

		if outcome == "Loaded" and loaded then
			local profile: Profile = { Player = player, Key = key, Data = loaded, Released = false }
			profiles[player] = profile

			if player.Parent ~= Players then
				-- Left while we were loading; give the lock straight back.
				releaseProfile(player)
				return
			end

			for _, callback in loadedCallbacks do
				task.spawn(callback, player, loaded)
			end
			return
		elseif outcome == "Corrupt" then
			logWarning("Stored data for " .. key .. " is unreadable; refusing to overwrite it.")
			player:Kick("Your saved data could not be read. Please contact support.")
			return
		elseif outcome == "NewerVersion" then
			logWarning("Stored data for " .. key .. " is from a newer game version.")
			player:Kick("This server is running an older version of the game. Please rejoin.")
			return
		end

		-- Locked by another server, usually one that is still saving after a server hop.
		if attempt < LOCKED_RETRY_ATTEMPTS then
			task.wait(LOCKED_RETRY_DELAY)
		end
	end

	player:Kick("Your progress is still being saved on another server. Please rejoin in a moment.")
end

local function autosaveLoop()
	while true do
		task.wait(AUTOSAVE_INTERVAL)
		local toSave: { Profile } = {}
		for _, profile in profiles do
			table.insert(toSave, profile)
		end
		-- Spread requests across the interval rather than spiking the DataStore budget.
		local spacing = if #toSave > 0 then math.min(1, AUTOSAVE_INTERVAL / (#toSave * 2)) else 0
		for _, profile in toSave do
			if not profile.Released then
				task.spawn(saveProfile, profile, false)
				task.wait(spacing)
			end
		end
	end
end

local function onShutdown()
	local pending = 0
	for player in profiles do
		pending += 1
		task.spawn(function()
			releaseProfile(player)
			pending -= 1
		end)
	end

	local deadline = os.clock() + SHUTDOWN_TIMEOUT
	while (pending > 0 or next(releasingKeys) ~= nil) and os.clock() < deadline do
		task.wait(0.1)
	end
	if pending > 0 then
		logWarning(string.format("Shutdown timed out with %d profile(s) unsaved.", pending))
	end
end

-- Returns the live data table for a loaded player, or nil if it is not loaded (yet).
-- Only server services may mutate it; changes are persisted on the next save.
function DataService.GetData(player: Player): PlayerData?
	local profile = profiles[player]
	if profile and not profile.Released then
		return profile.Data
	end
	return nil
end

-- Registers a callback fired once per player after their data loads. Also fires for players
-- who are already loaded, so registration order does not matter.
function DataService.OnProfileLoaded(callback: (Player, PlayerData) -> ())
	table.insert(loadedCallbacks, callback)
	for player, profile in profiles do
		task.spawn(callback, player, profile.Data)
	end
end

function DataService.Start()
	if RunService:IsStudio() then
		local ok, err = pcall(function()
			store:GetAsync("__studio_probe")
		end)
		if not ok then
			useMemoryStore = true
			logWarning(
				"DataStores unavailable in Studio ("
					.. tostring(err)
					.. "). Using a temporary in-memory store; progress will NOT persist. "
					.. "Enable Game Settings > Security > Studio Access to API Services to test saving."
			)
		end
	end

	Players.PlayerAdded:Connect(loadProfile)
	Players.PlayerRemoving:Connect(releaseProfile)
	for _, player in Players:GetPlayers() do
		task.spawn(loadProfile, player)
	end

	game:BindToClose(onShutdown)
	task.spawn(autosaveLoop)
	log("Started with session " .. SESSION_ID .. (if useMemoryStore then " (memory store)" else ""))
end

return DataService
