--!strict
-- CollectionService tags and instance attribute names shared by server and client.
-- Keeping them in one place stops the two sides from drifting apart.

local Tags = {
	Enemy = "Enemy",
	EnemySpawn = "EnemySpawn",
}

local Attributes = {
	Player = {
		DataLoaded = "DataLoaded",
		Level = "Level",
		XP = "XP",
		StatPoints = "StatPoints",
	},
	Enemy = {
		-- Set on spawn parts by level designers.
		SpawnType = "EnemyType",
		-- Set on live enemy models by the server.
		TypeId = "EnemyType",
		DisplayName = "DisplayName",
		Level = "Level",
		Telegraphing = "Telegraphing",
	},
}

local function statAttribute(statId: string): string
	return "Stat_" .. statId
end

return {
	Tags = Tags,
	Attributes = Attributes,
	StatAttribute = statAttribute,
}
