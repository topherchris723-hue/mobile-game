--!strict
-- Shape, defaults, migration and sanitisation of saved player data.
--
-- To change the schema:
--   1. Bump CURRENT_VERSION.
--   2. Add MIGRATIONS[oldVersion] that upgrades a table from oldVersion to oldVersion + 1.
--   3. Update Default() and Reconcile() for the new fields.
-- Never edit an existing migration after it has shipped.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ProgressionConfig = require(ReplicatedStorage.Shared.Config.ProgressionConfig)

export type PlayerData = {
	Version: number,
	Level: number,
	XP: number,
	StatPoints: number,
	Stats: { [string]: number },
}

local CURRENT_VERSION = 1

local MIGRATIONS: { [number]: (data: { [string]: any }) -> () } = {
	-- [1] = function(data) ... end, -- upgrades version 1 -> 2
}

local PlayerDataSchema = {}

PlayerDataSchema.CurrentVersion = CURRENT_VERSION

function PlayerDataSchema.Default(): PlayerData
	local stats: { [string]: number } = {}
	for _, stat in ProgressionConfig.Stats do
		stats[stat.Id] = 0
	end
	return {
		Version = CURRENT_VERSION,
		Level = 1,
		XP = 0,
		StatPoints = 0,
		Stats = stats,
	}
end

local function sanitizeInteger(value: any, fallback: number, minimum: number, maximum: number): number
	if type(value) ~= "number" or value ~= value then
		return fallback
	end
	return math.clamp(math.floor(value), minimum, maximum)
end

export type ReconcileFailure = "Corrupt" | "NewerVersion"

-- Migrates and validates stored data. Returns nil and a reason when the data must not be used:
-- loading data written by a newer server version and saving it back would silently drop fields.
function PlayerDataSchema.Reconcile(raw: any): (PlayerData?, ReconcileFailure?)
	if type(raw) ~= "table" then
		return nil, "Corrupt"
	end
	local version = raw.Version
	if type(version) ~= "number" then
		return nil, "Corrupt"
	end
	if version > CURRENT_VERSION then
		return nil, "NewerVersion"
	end

	while version < CURRENT_VERSION do
		local migrate = MIGRATIONS[version]
		if not migrate then
			return nil, "Corrupt"
		end
		migrate(raw)
		version += 1
	end

	local defaults = PlayerDataSchema.Default()
	local stats: { [string]: number } = {}
	local rawStats = if type(raw.Stats) == "table" then raw.Stats else {}
	for _, stat in ProgressionConfig.Stats do
		stats[stat.Id] = sanitizeInteger(rawStats[stat.Id], 0, 0, ProgressionConfig.MaxStatValue)
	end

	return {
		Version = CURRENT_VERSION,
		Level = sanitizeInteger(raw.Level, defaults.Level, 1, ProgressionConfig.MaxLevel),
		XP = sanitizeInteger(raw.XP, defaults.XP, 0, math.huge),
		StatPoints = sanitizeInteger(raw.StatPoints, defaults.StatPoints, 0, math.huge),
		Stats = stats,
	},
		nil
end

function PlayerDataSchema.DeepCopy<T>(value: T): T
	if type(value) ~= "table" then
		return value
	end
	local copy = {}
	for key, child in value :: any do
		copy[key] = PlayerDataSchema.DeepCopy(child)
	end
	return (copy :: any) :: T
end

return PlayerDataSchema
