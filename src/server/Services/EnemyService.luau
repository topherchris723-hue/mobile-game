--!strict
-- Spawns, drives and rewards PvE enemies.
--
-- Spawn points are BaseParts tagged "EnemySpawn" with an "EnemyType" attribute naming an entry in
-- EnemyConfig.Types. Each spawn point keeps one enemy alive, respawning it after RespawnTime.
--
-- All enemies are thought for in a single throttled Heartbeat pass rather than a loop per enemy.
-- Attacks are telegraphed (Telegraphing attribute) and resolved after a wind-up, so players can
-- react by stepping away.

local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local ServerStorage = game:GetService("ServerStorage")

local EnemyConfig = require(ReplicatedStorage.Shared.Config.EnemyConfig)
local CombatConfig = require(ReplicatedStorage.Shared.Config.CombatConfig)
local TagsModule = require(ReplicatedStorage.Shared.Tags)
local ProgressionService = require(script.Parent.ProgressionService)

local Tags = TagsModule.Tags
local EnemyAttributes = TagsModule.Attributes.Enemy

type EnemyDefinition = EnemyConfig.EnemyDefinition
type EnemyState = "Idle" | "Chase" | "WindUp" | "Return" | "Dead"

type Enemy = {
	TypeId: string,
	Definition: EnemyDefinition,
	Model: Model,
	Humanoid: Humanoid,
	Root: BasePart,
	SpawnPoint: BasePart,
	State: EnemyState,
	Target: Player?,
	NextAttackAt: number,
	WindUpEndsAt: number,
	StunnedUntil: number,
	LastMoveGoal: Vector3?,
	LastMoveAt: number,
	DamageByPlayer: { [Player]: number },
}

-- How close to its spawn a returning enemy must get before it resets.
local HOME_RADIUS = 4
-- Extra reach granted when an attack resolves, so a target that only just drifted out is still hit.
local ATTACK_RESOLVE_GRACE = 1.5
-- Targets this far beyond the aggro radius are dropped.
local DISENGAGE_MULTIPLIER = 1.6
-- Front-arc check for resolving attacks (dot product of facing vs. direction to target).
local ATTACK_FACING_DOT = 0.2
-- MoveTo is only re-issued when the goal moves further than this, to avoid redundant pathing work.
local MOVE_GOAL_TOLERANCE = 1
-- Humanoid:MoveTo gives up after 8 seconds, so long walks are re-issued before that.
local MOVE_REFRESH_INTERVAL = 6

local EnemyService = {}

local enemiesByModel: { [Model]: Enemy } = {}
local activeSpawnPoints: { [BasePart]: boolean } = {}
local templates: { [string]: Model } = {}
-- Rig creation yields; spawn points sharing a type wait on the first build instead of duplicating it.
local templatesBuilding: { [string]: boolean } = {}
local enemyFolder: Folder
local templateFolder: Folder

local function getAliveRoot(player: Player?): BasePart?
	if not player or player.Parent ~= Players then
		return nil
	end
	local character = player.Character
	if not character then
		return nil
	end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	local root = character:FindFirstChild("HumanoidRootPart")
	if not humanoid or humanoid.Health <= 0 or not root or not root:IsA("BasePart") then
		return nil
	end
	return root
end

local function findNearestPlayer(position: Vector3, radius: number): Player?
	local nearest: Player? = nil
	local nearestDistance = radius
	for _, player in Players:GetPlayers() do
		local root = getAliveRoot(player)
		if root then
			local distance = (root.Position - position).Magnitude
			if distance <= nearestDistance then
				nearest = player
				nearestDistance = distance
			end
		end
	end
	return nearest
end

local function buildTemplate(typeId: string, definition: EnemyDefinition): Model?
	-- PLACEHOLDER: a default R15 rig tinted per archetype. Replace with authored models by putting a
	-- Model named after the type id in ServerStorage.EnemyTemplates (it must contain a Humanoid and
	-- a HumanoidRootPart set as PrimaryPart).
	local description = Instance.new("HumanoidDescription")
	description.HeadColor = definition.SkinColor
	description.LeftArmColor = definition.SkinColor
	description.RightArmColor = definition.SkinColor
	description.TorsoColor = definition.TorsoColor
	description.LeftLegColor = definition.LegColor
	description.RightLegColor = definition.LegColor

	local ok, result = pcall(function()
		return Players:CreateHumanoidModelFromDescriptionAsync(description, Enum.HumanoidRigType.R15)
	end)
	description:Destroy()
	if not ok then
		warn(string.format("[EnemyService] Could not build rig for %s: %s", typeId, tostring(result)))
		return nil
	end

	local model = result :: Model
	model.Name = typeId
	return model
end

local function getTemplate(typeId: string, definition: EnemyDefinition): Model?
	while templatesBuilding[typeId] do
		task.wait()
	end
	local cached = templates[typeId]
	if cached then
		return cached
	end

	templatesBuilding[typeId] = true
	local authored = templateFolder:FindFirstChild(typeId)
	local template: Model? = if authored and authored:IsA("Model") then authored else buildTemplate(typeId, definition)
	templatesBuilding[typeId] = nil
	if not template then
		return nil
	end

	local humanoid = template:FindFirstChildOfClass("Humanoid")
	local root = template:FindFirstChild("HumanoidRootPart")
	if not humanoid or not root or not root:IsA("BasePart") then
		warn("[EnemyService] Template " .. typeId .. " needs a Humanoid and a HumanoidRootPart.")
		return nil
	end

	template.PrimaryPart = root
	if definition.Scale ~= 1 then
		template:ScaleTo(definition.Scale)
	end
	-- Health bars and names are drawn by the client (EnemyBarsController).
	humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	humanoid.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
	humanoid.BreakJointsOnDeath = false
	-- Deliver the whole rig in one piece under StreamingEnabled so clients never see half a model.
	template.ModelStreamingMode = Enum.ModelStreamingMode.Atomic
	template.Parent = templateFolder

	templates[typeId] = template
	return template
end

local function moveTo(enemy: Enemy, goal: Vector3)
	local now = os.clock()
	local last = enemy.LastMoveGoal
	if last and (last - goal).Magnitude < MOVE_GOAL_TOLERANCE and now - enemy.LastMoveAt < MOVE_REFRESH_INTERVAL then
		return
	end
	enemy.LastMoveGoal = goal
	enemy.LastMoveAt = now
	enemy.Humanoid:MoveTo(goal)
end

local function stopMoving(enemy: Enemy)
	enemy.LastMoveGoal = nil
	enemy.Humanoid:MoveTo(enemy.Root.Position)
end

local function setTelegraph(enemy: Enemy, active: boolean)
	enemy.Model:SetAttribute(EnemyAttributes.Telegraphing, active)
end

local spawnEnemy: (spawnPoint: BasePart) -> ()

local function onEnemyDied(enemy: Enemy)
	if enemy.State == "Dead" then
		return
	end
	enemy.State = "Dead"
	setTelegraph(enemy, false)

	local threshold = enemy.Definition.MaxHealth * EnemyConfig.MinContributionFraction
	for player, dealt in enemy.DamageByPlayer do
		if player.Parent == Players and dealt >= threshold then
			ProgressionService.AddXP(player, enemy.Definition.XPReward)
		end
	end
	table.clear(enemy.DamageByPlayer)

	task.delay(EnemyConfig.CorpseTime, function()
		enemiesByModel[enemy.Model] = nil
		enemy.Model:Destroy()
	end)
	task.delay(enemy.Definition.RespawnTime, function()
		if activeSpawnPoints[enemy.SpawnPoint] then
			spawnEnemy(enemy.SpawnPoint)
		end
	end)
end

spawnEnemy = function(spawnPoint: BasePart)
	local typeId = spawnPoint:GetAttribute(EnemyAttributes.SpawnType)
	if type(typeId) ~= "string" then
		warn("[EnemyService] Spawn point " .. spawnPoint:GetFullName() .. " has no EnemyType attribute.")
		return
	end
	local definition = EnemyConfig.Types[typeId]
	if not definition then
		warn("[EnemyService] Unknown EnemyType '" .. typeId .. "' on " .. spawnPoint:GetFullName())
		return
	end
	local template = getTemplate(typeId, definition)
	if not template or not activeSpawnPoints[spawnPoint] then
		return
	end

	local model = template:Clone()
	local humanoid = model:FindFirstChildOfClass("Humanoid") :: Humanoid
	local root = model.PrimaryPart :: BasePart

	model.Name = definition.DisplayName
	model:SetAttribute(EnemyAttributes.TypeId, typeId)
	model:SetAttribute(EnemyAttributes.DisplayName, definition.DisplayName)
	model:SetAttribute(EnemyAttributes.Level, definition.Level)
	model:SetAttribute(EnemyAttributes.Telegraphing, false)

	humanoid.MaxHealth = definition.MaxHealth
	humanoid.Health = definition.MaxHealth
	humanoid.WalkSpeed = definition.WalkSpeed

	local height = model:GetExtentsSize().Y
	local groundY = spawnPoint.Position.Y + spawnPoint.Size.Y / 2
	local spawnPosition = Vector3.new(spawnPoint.Position.X, groundY + height / 2, spawnPoint.Position.Z)
	model:PivotTo(CFrame.new(spawnPosition) * spawnPoint.CFrame.Rotation)
	model.Parent = enemyFolder
	root:SetNetworkOwner(nil)

	local enemy: Enemy = {
		TypeId = typeId,
		Definition = definition,
		Model = model,
		Humanoid = humanoid,
		Root = root,
		SpawnPoint = spawnPoint,
		State = "Idle",
		Target = nil,
		NextAttackAt = 0,
		WindUpEndsAt = 0,
		StunnedUntil = 0,
		LastMoveGoal = nil,
		LastMoveAt = 0,
		DamageByPlayer = {},
	}
	enemiesByModel[model] = enemy
	CollectionService:AddTag(model, Tags.Enemy)

	humanoid.Died:Once(function()
		onEnemyDied(enemy)
	end)
end

local function beginReturn(enemy: Enemy)
	enemy.Target = nil
	enemy.State = "Return"
	setTelegraph(enemy, false)
end

local function resolveAttack(enemy: Enemy, now: number)
	setTelegraph(enemy, false)
	enemy.State = "Chase"
	enemy.NextAttackAt = now + enemy.Definition.AttackCooldown

	local targetRoot = getAliveRoot(enemy.Target)
	if not targetRoot then
		return
	end
	local offset = targetRoot.Position - enemy.Root.Position
	local flatOffset = Vector3.new(offset.X, 0, offset.Z)
	if flatOffset.Magnitude > enemy.Definition.AttackRange + ATTACK_RESOLVE_GRACE then
		return
	end
	if flatOffset.Magnitude > 0.1 and enemy.Root.CFrame.LookVector:Dot(flatOffset.Unit) < ATTACK_FACING_DOT then
		return
	end

	local targetHumanoid = (targetRoot.Parent :: Instance):FindFirstChildOfClass("Humanoid")
	if targetHumanoid then
		targetHumanoid:TakeDamage(enemy.Definition.Damage)
	end
end

local function think(enemy: Enemy, now: number)
	local definition = enemy.Definition
	local humanoid = enemy.Humanoid
	local position = enemy.Root.Position
	local homePosition = enemy.SpawnPoint.Position

	if now < enemy.StunnedUntil then
		return
	end
	if humanoid.WalkSpeed ~= definition.WalkSpeed then
		humanoid.WalkSpeed = definition.WalkSpeed
	end

	if enemy.State == "WindUp" then
		if now >= enemy.WindUpEndsAt then
			resolveAttack(enemy, now)
		end
		return
	end

	local flatFromHome = Vector3.new(position.X - homePosition.X, 0, position.Z - homePosition.Z)
	if enemy.State ~= "Return" and flatFromHome.Magnitude > definition.LeashRadius then
		beginReturn(enemy)
	end

	if enemy.State == "Return" then
		if flatFromHome.Magnitude <= HOME_RADIUS then
			-- Leash reset: heal fully and forget contributors so kiting cannot farm partial damage.
			humanoid.Health = humanoid.MaxHealth
			table.clear(enemy.DamageByPlayer)
			enemy.State = "Idle"
			stopMoving(enemy)
		else
			moveTo(enemy, homePosition)
		end
		return
	end

	local targetRoot = getAliveRoot(enemy.Target)
	if targetRoot and (targetRoot.Position - position).Magnitude > definition.AggroRadius * DISENGAGE_MULTIPLIER then
		targetRoot = nil
	end
	if not targetRoot then
		enemy.Target = findNearestPlayer(position, definition.AggroRadius)
		targetRoot = getAliveRoot(enemy.Target)
	end

	if not targetRoot then
		if enemy.State == "Chase" or flatFromHome.Magnitude > HOME_RADIUS * 2 then
			beginReturn(enemy)
		end
		return
	end

	local toTarget = targetRoot.Position - position
	local flatToTarget = Vector3.new(toTarget.X, 0, toTarget.Z)
	if flatToTarget.Magnitude <= definition.AttackRange then
		if now >= enemy.NextAttackAt then
			enemy.State = "WindUp"
			enemy.WindUpEndsAt = now + definition.AttackWindup
			stopMoving(enemy)
			if flatToTarget.Magnitude > 0.1 then
				enemy.Root.CFrame = CFrame.lookAt(position, position + flatToTarget)
			end
			setTelegraph(enemy, true)
		else
			-- In range but on cooldown: hold position instead of shoving into the player.
			enemy.State = "Chase"
			stopMoving(enemy)
		end
	else
		enemy.State = "Chase"
		moveTo(enemy, targetRoot.Position)
	end
end

local function addSpawnPoint(instance: Instance)
	if not instance:IsA("BasePart") or activeSpawnPoints[instance] then
		return
	end
	activeSpawnPoints[instance] = true
	task.spawn(spawnEnemy, instance)
end

local function removeSpawnPoint(instance: Instance)
	if instance:IsA("BasePart") then
		activeSpawnPoints[instance] = nil
	end
end

-- Returns the enemy model a part belongs to, or nil if it is not part of a live enemy.
function EnemyService.GetEnemyModelFromPart(part: BasePart): Model?
	local current: Instance? = part
	while current and current.Parent ~= enemyFolder do
		current = current.Parent
	end
	if current and current:IsA("Model") then
		local enemy = enemiesByModel[current]
		if enemy and enemy.State ~= "Dead" then
			return current
		end
	end
	return nil
end

function EnemyService.GetEnemyFolder(): Folder
	return enemyFolder
end

-- Applies player damage to an enemy. Returns (killed, damageApplied).
-- `knockback` is a world-space velocity change applied if the enemy can be staggered.
function EnemyService.DamageEnemy(model: Model, attacker: Player, amount: number, knockback: Vector3?): (boolean, number)
	local enemy = enemiesByModel[model]
	if not enemy or enemy.State == "Dead" or enemy.Humanoid.Health <= 0 or amount <= 0 then
		return false, 0
	end

	local applied = math.min(amount, enemy.Humanoid.Health)
	enemy.DamageByPlayer[attacker] = (enemy.DamageByPlayer[attacker] or 0) + applied

	-- Being hit pulls the enemy into the fight, even mid-return.
	if enemy.State == "Idle" or enemy.State == "Return" or enemy.Target == nil then
		enemy.Target = attacker
		if enemy.State ~= "WindUp" then
			enemy.State = "Chase"
		end
	end

	if enemy.Definition.Staggerable then
		local now = os.clock()
		enemy.StunnedUntil = now + CombatConfig.HitstunDuration
		enemy.Humanoid.WalkSpeed = 0
		if enemy.State == "WindUp" then
			-- Interrupted: the attack is lost but the enemy recovers sooner than a full cooldown.
			setTelegraph(enemy, false)
			enemy.State = "Chase"
			enemy.NextAttackAt = now + enemy.Definition.AttackCooldown * 0.5
		end
		if knockback then
			enemy.Root:ApplyImpulse(knockback * enemy.Root.AssemblyMass)
		end
	end

	enemy.Humanoid.Health -= applied
	return enemy.Humanoid.Health <= 0, applied
end

function EnemyService.Start()
	local folder = Instance.new("Folder")
	folder.Name = "Enemies"
	folder.Parent = workspace
	enemyFolder = folder

	local existingTemplates = ServerStorage:FindFirstChild("EnemyTemplates")
	if existingTemplates and existingTemplates:IsA("Folder") then
		templateFolder = existingTemplates
	else
		local created = Instance.new("Folder")
		created.Name = "EnemyTemplates"
		created.Parent = ServerStorage
		templateFolder = created
	end

	CollectionService:GetInstanceAddedSignal(Tags.EnemySpawn):Connect(addSpawnPoint)
	CollectionService:GetInstanceRemovedSignal(Tags.EnemySpawn):Connect(removeSpawnPoint)
	for _, spawnPoint in CollectionService:GetTagged(Tags.EnemySpawn) do
		addSpawnPoint(spawnPoint)
	end

	Players.PlayerRemoving:Connect(function(player)
		for _, enemy in enemiesByModel do
			enemy.DamageByPlayer[player] = nil
			if enemy.Target == player then
				enemy.Target = nil
			end
		end
	end)

	local accumulated = 0
	RunService.Heartbeat:Connect(function(deltaTime)
		accumulated += deltaTime
		if accumulated < EnemyConfig.ThinkInterval then
			return
		end
		accumulated = 0
		local now = os.clock()
		for _, enemy in enemiesByModel do
			if enemy.State ~= "Dead" then
				think(enemy, now)
			end
		end
	end)
end

return EnemyService
