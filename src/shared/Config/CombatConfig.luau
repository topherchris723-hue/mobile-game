--!strict
-- Melee tuning. Shared so the client can gate input locally with the same timings the server enforces.

local CombatConfig = {
	ComboLength = 4,
	-- Minimum time between swings inside a combo.
	AttackInterval = 0.36,
	-- Extra recovery after the finisher, so mashing has a rhythm instead of a flat DPS stream.
	FinisherRecovery = 0.7,
	-- Idle time after which the next swing restarts the combo at hit 1.
	ComboResetTime = 1.0,
	-- Server accepts swings this much earlier than the interval to absorb network jitter.
	TimingTolerance = 0.08,

	FinisherDamageMultiplier = 1.6,
	FinisherKnockback = 38,
	FinisherLift = 14,
	HitstunDuration = 0.35,

	HitboxSize = Vector3.new(6, 5, 6),
	-- Studs in front of the HumanoidRootPart where the hitbox is centred.
	HitboxForwardOffset = 3,
	MaxTargetsPerSwing = 4,

	-- PLACEHOLDER: upload R15 punch animations and paste their asset IDs ("rbxassetid://123").
	-- Empty entries are skipped, and a placeholder swing effect is shown instead.
	ComboAnimationIds = { "", "", "", "" } :: { string },
	-- PLACEHOLDER: swing / impact sound IDs. Empty entries are skipped.
	SwingSoundId = "",
	HitSoundId = "",
}

return CombatConfig
