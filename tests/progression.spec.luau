-- Plain-Luau checks for the pure progression formulas and save-data reconciliation.
-- Run with: python3 tests/run_tests.py  (see README). Not executed inside Roblox.

return function(Progression: any, ProgressionConfig: any, PlayerDataSchema: any)
	local failures = 0
	local function check(name: string, condition: boolean)
		if condition then
			print("  ok   " .. name)
		else
			failures += 1
			print("  FAIL " .. name)
		end
	end

	-- XP curve
	check("level 1 needs 50 XP", Progression.XPToNextLevel(1) == 50)
	check("max level needs 0 XP", Progression.XPToNextLevel(ProgressionConfig.MaxLevel) == 0)
	local increasing = true
	for level = 1, ProgressionConfig.MaxLevel - 2 do
		if Progression.XPToNextLevel(level + 1) <= Progression.XPToNextLevel(level) then
			increasing = false
		end
	end
	check("XP curve strictly increases", increasing)

	-- ApplyXP
	local level, xp, points, gained = Progression.ApplyXP(1, 0, 0, 49)
	check("49 XP does not level", level == 1 and xp == 49 and points == 0 and gained == 0)
	level, xp, points, gained = Progression.ApplyXP(1, 49, 0, 1)
	check("exactly 50 XP levels once", level == 2 and xp == 0 and points == 3 and gained == 1)
	level, xp, points, gained = Progression.ApplyXP(1, 0, 0, 50 + Progression.XPToNextLevel(2) + 5)
	check("overflow carries across multiple levels", level == 3 and xp == 5 and points == 6 and gained == 2)
	level, xp, points = Progression.ApplyXP(ProgressionConfig.MaxLevel - 1, 0, 0, 10 ^ 9)
	check("XP clamps at max level", level == ProgressionConfig.MaxLevel and xp == 0 and points == 3)

	-- Derived stats
	check("base health", Progression.MaxHealth(0) == 100)
	check("vitality adds health", Progression.MaxHealth(10) == 150)
	check("strength adds damage", Progression.MeleeDamage(10) == 15)
	check("stat validation", Progression.IsValidStat("Strength") and not Progression.IsValidStat("Luck"))

	-- Schema
	local default = PlayerDataSchema.Default()
	check("default data", default.Level == 1 and default.Stats.Strength == 0 and default.Version == 1)
	local data, failure = PlayerDataSchema.Reconcile({ Version = 99 })
	check("newer version rejected", data == nil and failure == "NewerVersion")
	data, failure = PlayerDataSchema.Reconcile("garbage")
	check("non-table rejected", data == nil and failure == "Corrupt")
	data = PlayerDataSchema.Reconcile({
		Version = 1,
		Level = 0 / 0,
		XP = -5,
		StatPoints = 4.7,
		Stats = { Strength = 10 ^ 9, Luck = 5 },
	})
	check(
		"reconcile sanitises values",
		data ~= nil
			and data.Level == 1
			and data.XP == 0
			and data.StatPoints == 4
			and data.Stats.Strength == ProgressionConfig.MaxStatValue
			and data.Stats.Vitality == 0
			and data.Stats.Luck == nil
	)
	local copy = PlayerDataSchema.DeepCopy(default)
	copy.Stats.Strength = 5
	check("deep copy is independent", default.Stats.Strength == 0)

	return failures
end
