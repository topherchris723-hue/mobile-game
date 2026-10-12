--!strict
-- Floating name, level and health bar for every enemy streamed in to this client, plus the red
-- outline telegraph while an enemy winds up an attack. Built from CollectionService so it follows
-- StreamingEnabled: entries are created when enemies stream in and cleaned up when they leave.

local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local TagsModule = require(ReplicatedStorage.Shared.Tags)
local Theme = require(script.Parent.Parent.UI.Theme)
local Components = require(script.Parent.Parent.UI.Components)

local create = Components.create
local Tags = TagsModule.Tags
local EnemyAttributes = TagsModule.Attributes.Enemy
local PlayerAttributes = TagsModule.Attributes.Player

local MAX_DISTANCE = 80
-- Enemies this many levels above the player get a warning-coloured name.
local DANGER_LEVEL_GAP = 5

local player = Players.LocalPlayer

type Entry = {
	Model: Model,
	Billboard: BillboardGui,
	NameLabel: TextLabel,
	Telegraph: Highlight,
	Connections: { RBXScriptConnection },
}

local EnemyBarsController = {}

local entries: { [Instance]: Entry } = {}

local function getPlayerLevel(): number
	local level = player:GetAttribute(PlayerAttributes.Level)
	return if type(level) == "number" then level else 1
end

local function updateNameColor(entry: Entry)
	local enemyLevel = entry.Model:GetAttribute(EnemyAttributes.Level)
	local isDangerous = type(enemyLevel) == "number" and enemyLevel - getPlayerLevel() >= DANGER_LEVEL_GAP
	entry.NameLabel.TextColor3 = if isDangerous then Theme.Colors.Danger else Theme.Colors.TextPrimary
end

local function detach(instance: Instance)
	local entry = entries[instance]
	if not entry then
		return
	end
	entries[instance] = nil
	for _, connection in entry.Connections do
		connection:Disconnect()
	end
	entry.Billboard:Destroy()
	entry.Telegraph:Destroy()
end

local function attach(instance: Instance)
	if entries[instance] or not instance:IsA("Model") then
		return
	end
	local model = instance
	local humanoid = model:FindFirstChildOfClass("Humanoid")
	local adornee = model:FindFirstChild("Head") or model.PrimaryPart
	if not humanoid or not adornee or not adornee:IsA("BasePart") then
		return
	end
	local playerGui = player:FindFirstChildOfClass("PlayerGui")
	if not playerGui then
		return
	end

	local billboard = create(Instance.new("BillboardGui"), {
		Name = "EnemyBar",
		Adornee = adornee,
		AlwaysOnTop = true,
		LightInfluence = 0,
		MaxDistance = MAX_DISTANCE,
		ResetOnSpawn = false,
		Size = UDim2.fromOffset(160, 36),
		StudsOffsetWorldSpace = Vector3.new(0, adornee.Size.Y * 0.5 + 1.6, 0),
		Parent = playerGui,
	})

	local displayName = model:GetAttribute(EnemyAttributes.DisplayName)
	local level = model:GetAttribute(EnemyAttributes.Level)
	local nameLabel = Components.label({
		Text = string.format(
			"%s  <font transparency=\"0.35\">Lv.%s</font>",
			if type(displayName) == "string" then displayName else model.Name,
			if type(level) == "number" then tostring(level) else "?"
		),
		RichText = true,
		FontFace = Theme.Fonts.Heading,
		TextSize = Theme.TextSize.Body,
		TextXAlignment = Enum.TextXAlignment.Center,
		Size = UDim2.new(1, 0, 0, 20),
		Parent = billboard,
	})
	Components.textShadow().Parent = nameLabel

	local bar = Components.bar(Theme.Colors.Health, true)
	bar.Label.Visible = false
	create(bar.Frame, {
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -4),
		Size = UDim2.fromOffset(120, 7),
		Parent = billboard,
	})
	Components.stroke(Theme.Colors.TextShadow).Parent = bar.Frame

	local telegraph = create(Instance.new("Highlight"), {
		Name = "Telegraph",
		DepthMode = Enum.HighlightDepthMode.Occluded,
		Enabled = false,
		FillColor = Theme.Colors.Danger,
		FillTransparency = 0.75,
		OutlineColor = Theme.Colors.Danger,
		OutlineTransparency = 0,
		Parent = model,
	})

	local entry: Entry = {
		Model = model,
		Billboard = billboard,
		NameLabel = nameLabel,
		Telegraph = telegraph,
		Connections = {},
	}
	entries[model] = entry
	updateNameColor(entry)

	local function refreshHealth(instant: boolean)
		bar.SetProgress(humanoid.Health / math.max(humanoid.MaxHealth, 1), instant)
		if humanoid.Health <= 0 then
			telegraph.Enabled = false
			TweenService:Create(nameLabel, Theme.Motion.Slow, { TextTransparency = 1 }):Play()
			bar.Frame.Visible = false
		end
	end
	refreshHealth(true)

	table.insert(entry.Connections, humanoid.HealthChanged:Connect(function()
		refreshHealth(false)
	end))
	table.insert(entry.Connections, model:GetAttributeChangedSignal(EnemyAttributes.Telegraphing):Connect(function()
		telegraph.Enabled = model:GetAttribute(EnemyAttributes.Telegraphing) == true and humanoid.Health > 0
	end))
	-- Covers enemies that are destroyed without the tag-removed signal reaching us first.
	table.insert(entry.Connections, model.AncestryChanged:Connect(function(_, parent)
		if parent == nil then
			detach(model)
		end
	end))
end

function EnemyBarsController.Start()
	CollectionService:GetInstanceAddedSignal(Tags.Enemy):Connect(attach)
	CollectionService:GetInstanceRemovedSignal(Tags.Enemy):Connect(detach)
	for _, instance in CollectionService:GetTagged(Tags.Enemy) do
		task.spawn(attach, instance)
	end

	player:GetAttributeChangedSignal(PlayerAttributes.Level):Connect(function()
		for _, entry in entries do
			updateNameColor(entry)
		end
	end)
end

return EnemyBarsController
