--!strict
-- Owns level, XP and attribute points. The client sees progression through replicated Player
-- attributes (read-only from the client's side) and RewardGranted events for feedback.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Net = require(ReplicatedStorage.Shared.Net)
local Progression = require(ReplicatedStorage.Shared.Progression)
local ProgressionConfig = require(ReplicatedStorage.Shared.Config.ProgressionConfig)
local TagsModule = require(ReplicatedStorage.Shared.Tags)
local DataService = require(script.Parent.DataService)
local RateLimiter = require(script.Parent.Parent.Util.RateLimiter)

local PlayerAttributes = TagsModule.Attributes.Player

local ProgressionService = {}

local allocateLimiter = RateLimiter.new(10, 8)
local characterConnections: { [Player]: RBXScriptConnection } = {}

local function syncAttributes(player: Player)
	local data = DataService.GetData(player)
	if not data then
		return
	end
	player:SetAttribute(PlayerAttributes.Level, data.Level)
	player:SetAttribute(PlayerAttributes.XP, data.XP)
	player:SetAttribute(PlayerAttributes.StatPoints, data.StatPoints)
	for _, stat in ProgressionConfig.Stats do
		player:SetAttribute(TagsModule.StatAttribute(stat.Id), data.Stats[stat.Id] or 0)
	end

	local leaderstats = player:FindFirstChild("leaderstats")
	local levelValue = if leaderstats then leaderstats:FindFirstChild("Level") else nil
	if levelValue and levelValue:IsA("IntValue") then
		levelValue.Value = data.Level
	end
end

local function createLeaderstats(player: Player)
	if player:FindFirstChild("leaderstats") then
		return
	end
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	local level = Instance.new("IntValue")
	level.Name = "Level"
	level.Parent = leaderstats
	leaderstats.Parent = player
end

-- Applies stat-derived values to the current character. `refill` restores full health
-- (on spawn and level-up); otherwise the current health percentage is preserved.
local function applyCharacterStats(player: Player, refill: boolean)
	local data = DataService.GetData(player)
	local character = player.Character
	if not data or not character then
		return
	end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	if not humanoid or humanoid.Health <= 0 then
		return
	end

	local newMax = Progression.MaxHealth(data.Stats.Vitality or 0)
	local ratio = if humanoid.MaxHealth > 0 then humanoid.Health / humanoid.MaxHealth else 1
	humanoid.MaxHealth = newMax
	humanoid.Health = if refill then newMax else math.max(1, newMax * ratio)
end

local function onCharacterAdded(player: Player, character: Model)
	local humanoid = character:WaitForChild("Humanoid", 10)
	if humanoid and player.Character == character then
		applyCharacterStats(player, true)
	end
end

local function onProfileLoaded(player: Player)
	createLeaderstats(player)
	syncAttributes(player)

	characterConnections[player] = player.CharacterAdded:Connect(function(character)
		onCharacterAdded(player, character)
	end)
	if player.Character then
		task.spawn(onCharacterAdded, player, player.Character)
	end

	player:SetAttribute(PlayerAttributes.DataLoaded, true)
end

local function onRequestAllocateStat(player: Player, statId: unknown, amount: unknown)
	if not allocateLimiter:Check(player) then
		return
	end
	if type(statId) ~= "string" or not Progression.IsValidStat(statId) then
		return
	end
	-- Rejects NaN, infinities and fractions in one check.
	if type(amount) ~= "number" or amount % 1 ~= 0 or amount < 1 then
		return
	end

	local data = DataService.GetData(player)
	if not data or data.StatPoints <= 0 then
		return
	end

	local current = data.Stats[statId] or 0
	local spend = math.min(amount, data.StatPoints, ProgressionConfig.MaxStatValue - current)
	if spend <= 0 then
		return
	end

	data.StatPoints -= spend
	data.Stats[statId] = current + spend
	syncAttributes(player)

	if statId == "Vitality" then
		applyCharacterStats(player, false)
	end
end

-- Server-only API. Grants XP from a trusted source (enemy kills, quests).
function ProgressionService.AddXP(player: Player, amount: number)
	local data = DataService.GetData(player)
	if not data or amount <= 0 then
		return
	end

	local level, xp, statPoints, levelsGained = Progression.ApplyXP(data.Level, data.XP, data.StatPoints, amount)
	data.Level = level
	data.XP = xp
	data.StatPoints = statPoints
	syncAttributes(player)

	if levelsGained > 0 then
		applyCharacterStats(player, true)
	end

	Net.RewardGranted:FireClient(player, {
		XP = amount,
		LevelsGained = levelsGained,
		NewLevel = level,
	} :: Net.RewardInfo)
end

-- Returns the player's allocated value for a stat, or nil if their data is not loaded.
function ProgressionService.GetStat(player: Player, statId: string): number?
	local data = DataService.GetData(player)
	if not data then
		return nil
	end
	return data.Stats[statId] or 0
end

function ProgressionService.Start()
	DataService.OnProfileLoaded(onProfileLoaded)
	Net.RequestAllocateStat.OnServerEvent:Connect(onRequestAllocateStat)

	Players.PlayerRemoving:Connect(function(player)
		allocateLimiter:Remove(player)
		local connection = characterConnections[player]
		if connection then
			connection:Disconnect()
			characterConnections[player] = nil
		end
	end)
end

return ProgressionService
