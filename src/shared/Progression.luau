--!strict
-- Pure progression formulas. Used by the server for authority and by the client for display only.

local ProgressionConfig = require(script.Parent.Config.ProgressionConfig)

local Progression = {}

local validStats: { [string]: boolean } = {}
for _, stat in ProgressionConfig.Stats do
	validStats[stat.Id] = true
end

function Progression.IsValidStat(statId: string): boolean
	return validStats[statId] == true
end

function Progression.XPToNextLevel(level: number): number
	if level >= ProgressionConfig.MaxLevel then
		return 0
	end
	return math.floor(ProgressionConfig.XPBase * level ^ ProgressionConfig.XPExponent + 0.5)
end

function Progression.MaxHealth(vitality: number): number
	return ProgressionConfig.BaseMaxHealth + vitality * ProgressionConfig.HealthPerVitality
end

function Progression.MeleeDamage(strength: number): number
	return ProgressionConfig.BaseMeleeDamage + strength * ProgressionConfig.MeleeDamagePerStrength
end

-- Applies gained XP and returns the new (level, xp, statPoints, levelsGained).
-- XP is discarded at max level so the bar does not fill forever.
function Progression.ApplyXP(level: number, xp: number, statPoints: number, gained: number): (number, number, number, number)
	local levelsGained = 0
	xp += gained
	while level < ProgressionConfig.MaxLevel do
		local required = Progression.XPToNextLevel(level)
		if xp < required then
			break
		end
		xp -= required
		level += 1
		levelsGained += 1
		statPoints += ProgressionConfig.StatPointsPerLevel
	end
	if level >= ProgressionConfig.MaxLevel then
		xp = 0
	end
	return level, xp, statPoints, levelsGained
end

return Progression
