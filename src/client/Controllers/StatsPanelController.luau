--!strict
-- Attributes panel: shows allocated stats and lets the player spend unspent points.
-- Values come from replicated Player attributes; spending is a request the server validates.
-- Toggle: C (keyboard), Y (gamepad), or the Stats button on the HUD.

local ContextActionService = game:GetService("ContextActionService")
local GuiService = game:GetService("GuiService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Net = require(ReplicatedStorage.Shared.Net)
local ProgressionConfig = require(ReplicatedStorage.Shared.Config.ProgressionConfig)
local TagsModule = require(ReplicatedStorage.Shared.Tags)
local Theme = require(script.Parent.Parent.UI.Theme)
local Components = require(script.Parent.Parent.UI.Components)
local InputMode = require(script.Parent.Parent.InputMode)

local create = Components.create
local PlayerAttributes = TagsModule.Attributes.Player

local PANEL_WIDTH = 360
local ROW_HEIGHT = 64
local SLIDE_DISTANCE = 16
local BULK_AMOUNT = 5
local TOGGLE_ACTION = "ToggleStatsPanel"

local player = Players.LocalPlayer

local StatsPanelController = {}

local isOpen = false
local panel: Frame
local openPosition: UDim2
local firstSelectable: GuiObject? = nil
local openChangedListeners: { (boolean) -> () } = {}

local function getNumberAttribute(name: string): number
	local value = player:GetAttribute(name)
	return if type(value) == "number" then value else 0
end

type StatRow = {
	Value: TextLabel,
	AddOne: Components.Button,
	AddBulk: Components.Button,
	StatId: string,
}

local rows: { StatRow } = {}
local pointsLabel: TextLabel

local function refresh()
	local points = getNumberAttribute(PlayerAttributes.StatPoints)
	pointsLabel.Text = if points > 0 then string.format("%d unspent point%s", points, if points == 1 then "" else "s") else "No unspent points"
	pointsLabel.TextColor3 = if points > 0 then Theme.Colors.Accent else Theme.Colors.TextMuted

	for _, row in rows do
		local value = getNumberAttribute(TagsModule.StatAttribute(row.StatId))
		row.Value.Text = tostring(value)
		local canSpend = points > 0 and value < ProgressionConfig.MaxStatValue
		row.AddOne.SetEnabled(canSpend)
		row.AddBulk.SetEnabled(canSpend and points >= 2)
		row.AddBulk.SetText("+" .. tostring(math.min(BULK_AMOUNT, math.max(points, 1))))
	end
end

local function buildRow(stat: ProgressionConfig.StatDefinition, order: number): Frame
	local row = create(Instance.new("Frame"), {
		Name = stat.Id,
		BackgroundColor3 = Theme.Colors.SurfaceRaised,
		BackgroundTransparency = 0.2,
		BorderSizePixel = 0,
		LayoutOrder = order,
		Size = UDim2.new(1, 0, 0, ROW_HEIGHT),
	}, { Components.corner() :: Instance, Components.padding(Theme.Spacing.M) })

	Components.label({
		Name = "Name",
		Text = stat.DisplayName,
		FontFace = Theme.Fonts.Heading,
		TextSize = Theme.TextSize.Label,
		Size = UDim2.new(1, -150, 0, 20),
		Parent = row,
	})
	Components.label({
		Name = "Description",
		Text = stat.Description,
		TextSize = Theme.TextSize.Caption,
		TextColor3 = Theme.Colors.TextMuted,
		Position = UDim2.fromOffset(0, 22),
		Size = UDim2.new(1, -150, 0, 18),
		Parent = row,
	})

	local value = Components.label({
		Name = "Value",
		Text = "0",
		FontFace = Theme.Fonts.Numeric,
		TextSize = Theme.TextSize.Title,
		TextXAlignment = Enum.TextXAlignment.Right,
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -112, 0.5, 0),
		Size = UDim2.fromOffset(40, 28),
		Parent = row,
	})

	local addOne = Components.button("+1", "Primary", {
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -54, 0.5, 0),
		Size = UDim2.fromOffset(48, 36),
		Parent = row,
	})
	local addBulk = Components.button("+" .. BULK_AMOUNT, "Secondary", {
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, 0, 0.5, 0),
		Size = UDim2.fromOffset(48, 36),
		Parent = row,
	})

	addOne.OnActivated(function()
		Net.RequestAllocateStat:FireServer(stat.Id, 1)
	end)
	addBulk.OnActivated(function()
		local points = getNumberAttribute(PlayerAttributes.StatPoints)
		Net.RequestAllocateStat:FireServer(stat.Id, math.min(BULK_AMOUNT, points))
	end)

	if not firstSelectable then
		firstSelectable = addOne.Instance
	end
	table.insert(rows, { Value = value, AddOne = addOne, AddBulk = addBulk, StatId = stat.Id })
	return row
end

local function setOpen(open: boolean)
	if isOpen == open then
		return
	end
	isOpen = open

	local closedPosition = openPosition + UDim2.fromOffset(SLIDE_DISTANCE, 0)
	if open then
		refresh()
		panel.Position = closedPosition
		panel.Visible = true
		TweenService:Create(panel, Theme.Motion.Medium, { Position = openPosition }):Play()
		if InputMode.Get() == "Gamepad" and firstSelectable then
			GuiService.SelectedObject = firstSelectable
		end
	else
		local tween = TweenService:Create(panel, Theme.Motion.Fast, { Position = closedPosition })
		tween.Completed:Once(function()
			if not isOpen then
				panel.Visible = false
			end
		end)
		tween:Play()
		local selected = GuiService.SelectedObject
		if selected and selected:IsDescendantOf(panel) then
			GuiService.SelectedObject = nil
		end
	end

	for _, listener in openChangedListeners do
		task.spawn(listener, open)
	end
end

function StatsPanelController.Toggle()
	setOpen(not isOpen)
end

function StatsPanelController.IsOpen(): boolean
	return isOpen
end

function StatsPanelController.OnOpenChanged(listener: (boolean) -> ())
	table.insert(openChangedListeners, listener)
end

function StatsPanelController.Start()
	local playerGui = player:WaitForChild("PlayerGui")

	local screenGui = create(Instance.new("ScreenGui"), {
		Name = "StatsPanel",
		ResetOnSpawn = false,
		ScreenInsets = Enum.ScreenInsets.CoreUISafeInsets,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
		DisplayOrder = 5,
		Parent = playerGui,
	})
	Components.attachResponsiveScale(screenGui)

	openPosition = UDim2.new(1, -Theme.Spacing.XL, 0.45, 0)
	panel = Components.panel({
		Name = "Panel",
		AnchorPoint = Vector2.new(1, 0.5),
		Position = openPosition,
		Size = UDim2.fromOffset(PANEL_WIDTH, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		Visible = false,
		Parent = screenGui,
	})
	Components.padding(Theme.Spacing.L).Parent = panel
	create(Instance.new("UIListLayout"), {
		SortOrder = Enum.SortOrder.LayoutOrder,
		Padding = UDim.new(0, Theme.Spacing.S),
		Parent = panel,
	})

	local header = create(Instance.new("Frame"), {
		Name = "Header",
		BackgroundTransparency = 1,
		LayoutOrder = 0,
		Size = UDim2.new(1, 0, 0, 48),
		Parent = panel,
	})
	Components.label({
		Text = "Attributes",
		FontFace = Theme.Fonts.Heading,
		TextSize = Theme.TextSize.Title,
		Size = UDim2.new(1, -80, 0, 26),
		Parent = header,
	})
	pointsLabel = Components.label({
		Name = "Points",
		Text = "",
		FontFace = Theme.Fonts.Numeric,
		TextSize = Theme.TextSize.Body,
		Position = UDim2.fromOffset(0, 28),
		Size = UDim2.new(1, -80, 0, 18),
		Parent = header,
	})
	local close = Components.button("Close", "Secondary", {
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.fromScale(1, 0),
		Size = UDim2.fromOffset(68, 30),
		TextSize = Theme.TextSize.Caption,
		Parent = header,
	})
	close.OnActivated(function()
		setOpen(false)
	end)

	for index, stat in ProgressionConfig.Stats do
		buildRow(stat, index).Parent = panel
	end

	player:GetAttributeChangedSignal(PlayerAttributes.StatPoints):Connect(refresh)
	for _, stat in ProgressionConfig.Stats do
		player:GetAttributeChangedSignal(TagsModule.StatAttribute(stat.Id)):Connect(refresh)
	end
	refresh()

	ContextActionService:BindAction(TOGGLE_ACTION, function(_, inputState)
		if inputState == Enum.UserInputState.Begin then
			StatsPanelController.Toggle()
		end
		return Enum.ContextActionResult.Sink
	end, false, Enum.KeyCode.C, Enum.KeyCode.ButtonY)
end

return StatsPanelController
