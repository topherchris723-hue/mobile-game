--!strict
-- Enemy archetypes. Spawn parts in Workspace reference these by key via the "EnemyType" attribute.

export type EnemyDefinition = {
	DisplayName: string,
	Level: number,
	MaxHealth: number,
	WalkSpeed: number,
	Damage: number,
	AttackRange: number,
	-- Telegraph time before the hit lands; players can step out of range to avoid it.
	AttackWindup: number,
	AttackCooldown: number,
	-- If true, player hits stagger this enemy and cancel its wind-up. Heavier enemies have super armour.
	Staggerable: boolean,
	AggroRadius: number,
	-- Distance from its spawn at which the enemy gives up, walks home, and fully heals.
	LeashRadius: number,
	XPReward: number,
	RespawnTime: number,
	Scale: number,
	-- PLACEHOLDER appearance until custom models exist.
	SkinColor: Color3,
	TorsoColor: Color3,
	LegColor: Color3,
}

local EnemyConfig = {
	-- A player must deal at least this share of an enemy's max health to receive the kill reward.
	-- Everyone above the threshold gets the full reward, so grouping up is never punished.
	MinContributionFraction = 0.1,
	CorpseTime = 2.5,
	-- Seconds between AI decisions. Lower is more responsive but costs more server time.
	ThinkInterval = 0.1,

	Types = {
		DockThug = {
			DisplayName = "Dock Thug",
			Level = 1,
			MaxHealth = 70,
			WalkSpeed = 12,
			Damage = 7,
			AttackRange = 5,
			AttackWindup = 0.45,
			AttackCooldown = 1.6,
			Staggerable = true,
			AggroRadius = 35,
			LeashRadius = 70,
			XPReward = 20,
			RespawnTime = 8,
			Scale = 1,
			SkinColor = Color3.fromRGB(204, 142, 105),
			TorsoColor = Color3.fromRGB(86, 66, 54),
			LegColor = Color3.fromRGB(52, 58, 72),
		},
		HarborBrute = {
			DisplayName = "Harbor Brute",
			Level = 8,
			MaxHealth = 420,
			WalkSpeed = 11,
			Damage = 18,
			AttackRange = 6.5,
			AttackWindup = 0.7,
			AttackCooldown = 2.2,
			Staggerable = false,
			AggroRadius = 40,
			LeashRadius = 80,
			XPReward = 140,
			RespawnTime = 15,
			Scale = 1.3,
			SkinColor = Color3.fromRGB(160, 105, 80),
			TorsoColor = Color3.fromRGB(120, 40, 36),
			LegColor = Color3.fromRGB(40, 40, 44),
		},
	} :: { [string]: EnemyDefinition },
}

return EnemyConfig
