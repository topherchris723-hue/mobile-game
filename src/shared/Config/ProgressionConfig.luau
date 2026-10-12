--!strict
-- Tuning values for leveling and attributes. Formulas that use these live in Shared/Progression.

export type StatDefinition = {
	Id: string,
	DisplayName: string,
	Description: string,
}

local ProgressionConfig = {
	MaxLevel = 100,
	StatPointsPerLevel = 3,
	-- Hard cap per attribute; (MaxLevel - 1) * StatPointsPerLevel would let one stat absorb every point.
	MaxStatValue = 300,

	-- XP needed to go from `level` to `level + 1` = round(XPBase * level ^ XPExponent).
	-- Level 1 -> 50, level 10 -> ~1,580, level 50 -> ~17,700.
	XPBase = 50,
	XPExponent = 1.5,

	BaseMaxHealth = 100,
	HealthPerVitality = 5,

	BaseMeleeDamage = 10,
	MeleeDamagePerStrength = 0.5,

	-- Display order in the attributes panel. New stats (Blade, Relic) are added here in later milestones.
	Stats = {
		{
			Id = "Strength",
			DisplayName = "Strength",
			Description = "Increases melee damage.",
		},
		{
			Id = "Vitality",
			DisplayName = "Vitality",
			Description = "Increases maximum health.",
		},
	} :: { StatDefinition },
}

return ProgressionConfig
