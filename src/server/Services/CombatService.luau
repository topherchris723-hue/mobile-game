--!strict
-- Server-authoritative melee. The client only says "I swung"; the server owns combo state, timing,
-- the hitbox (built from the server's view of the character) and damage.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Net = require(ReplicatedStorage.Shared.Net)
local Progression = require(ReplicatedStorage.Shared.Progression)
local CombatConfig = require(ReplicatedStorage.Shared.Config.CombatConfig)
local ProgressionService = require(script.Parent.ProgressionService)
local EnemyService = require(script.Parent.EnemyService)
local RateLimiter = require(script.Parent.Parent.Util.RateLimiter)

type CombatState = {
	ComboIndex: number,
	LastSwingAt: number,
	NextSwingAt: number,
}

local CombatService = {}

local states: { [Player]: CombatState } = {}
-- Coarse flood guard; the real cadence is enforced by NextSwingAt below.
local attackLimiter = RateLimiter.new(6, 5)
local overlapParams = OverlapParams.new()
overlapParams.FilterType = Enum.RaycastFilterType.Include

local function getCombatState(player: Player): CombatState
	local state = states[player]
	if not state then
		state = { ComboIndex = 0, LastSwingAt = -math.huge, NextSwingAt = 0 }
		states[player] = state
	end
	return state
end

local function onRequestAttack(player: Player)
	if not attackLimiter:Check(player) then
		return
	end

	local strength = ProgressionService.GetStat(player, "Strength")
	if strength == nil then
		return
	end

	local character = player.Character
	local humanoid = if character then character:FindFirstChildOfClass("Humanoid") else nil
	local root = if character then character:FindFirstChild("HumanoidRootPart") else nil
	if not humanoid or humanoid.Health <= 0 or not root or not root:IsA("BasePart") then
		return
	end

	local state = getCombatState(player)
	local now = os.clock()
	if now < state.NextSwingAt - CombatConfig.TimingTolerance then
		return
	end

	if now - state.LastSwingAt > CombatConfig.ComboResetTime or state.ComboIndex >= CombatConfig.ComboLength then
		state.ComboIndex = 1
	else
		state.ComboIndex += 1
	end
	local isFinisher = state.ComboIndex == CombatConfig.ComboLength
	state.LastSwingAt = now
	state.NextSwingAt = now + (if isFinisher then CombatConfig.FinisherRecovery else CombatConfig.AttackInterval)

	local damage = Progression.MeleeDamage(strength)
	if isFinisher then
		damage *= CombatConfig.FinisherDamageMultiplier
	end
	damage = math.floor(damage + 0.5)

	local rootCFrame = root.CFrame
	local hitboxCFrame = rootCFrame * CFrame.new(0, 0, -CombatConfig.HitboxForwardOffset)
	overlapParams.FilterDescendantsInstances = { EnemyService.GetEnemyFolder() }
	local parts = workspace:GetPartBoundsInBox(hitboxCFrame, CombatConfig.HitboxSize, overlapParams)

	local seen: { [Model]: boolean } = {}
	local targets: { { Model: Model, Distance: number } } = {}
	for _, part in parts do
		local model = EnemyService.GetEnemyModelFromPart(part)
		if model and not seen[model] then
			seen[model] = true
			table.insert(targets, { Model = model, Distance = (model:GetPivot().Position - rootCFrame.Position).Magnitude })
		end
	end
	if #targets == 0 then
		return
	end
	table.sort(targets, function(a, b)
		return a.Distance < b.Distance
	end)

	local knockback: Vector3? = nil
	if isFinisher then
		knockback = rootCFrame.LookVector * CombatConfig.FinisherKnockback + Vector3.yAxis * CombatConfig.FinisherLift
	end

	local hits: { Net.HitInfo } = {}
	for index = 1, math.min(#targets, CombatConfig.MaxTargetsPerSwing) do
		local model = targets[index].Model
		local killed, applied = EnemyService.DamageEnemy(model, player, damage, knockback)
		if applied > 0 then
			table.insert(hits, { Model = model, Damage = applied, Finisher = isFinisher, Killed = killed })
		end
	end

	if #hits > 0 then
		Net.HitConfirmed:FireClient(player, hits)
	end
end

function CombatService.Start()
	Net.RequestAttack.OnServerEvent:Connect(onRequestAttack)
	Players.PlayerRemoving:Connect(function(player)
		states[player] = nil
		attackLimiter:Remove(player)
	end)
end

return CombatService
