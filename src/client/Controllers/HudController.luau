--!strict
-- Persistent HUD: level, health and XP at the bottom centre (clear of the mobile thumbstick and jump
-- button), the Stats button, XP toasts, the level-up banner and the damage vignette.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Net = require(ReplicatedStorage.Shared.Net)
local Progression = require(ReplicatedStorage.Shared.Progression)
local ProgressionConfig = require(ReplicatedStorage.Shared.Config.ProgressionConfig)
local TagsModule = require(ReplicatedStorage.Shared.Tags)
local Theme = require(script.Parent.Parent.UI.Theme)
local Components = require(script.Parent.Parent.UI.Components)
local InputMode = require(script.Parent.Parent.InputMode)
local StatsPanelController = require(script.Parent.StatsPanelController)

local create = Components.create
local PlayerAttributes = TagsModule.Attributes.Player

local VITALS_WIDTH = 400
local VITALS_HEIGHT = 72
local BADGE_WIDTH = 64
local STATS_BUTTON_WIDTH = 72
local BOTTOM_MARGIN = Theme.Spacing.M
local TOAST_LIFETIME = 1.4
local BANNER_HOLD = 1.8
local MAX_TOASTS = 4

local player = Players.LocalPlayer

local HudController = {}

local function getNumberAttribute(name: string, fallback: number): number
	local value = player:GetAttribute(name)
	return if type(value) == "number" then value else fallback
end

local function buildVignette(parent: Instance): (intensity: number) -> ()
	-- Four edge strips with transparency gradients approximate a vignette without an image asset.
	local container = create(Instance.new("Frame"), {
		Name = "DamageVignette",
		BackgroundTransparency = 1,
		Size = UDim2.fromScale(1, 1),
		ZIndex = 0,
		Parent = parent,
	})
	local fadeOut = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0),
		NumberSequenceKeypoint.new(1, 1),
	})
	local edges = {
		{ Size = UDim2.fromScale(1, 0.18), Position = UDim2.fromScale(0, 0), Rotation = 90 },
		{ Size = UDim2.fromScale(1, 0.18), Position = UDim2.fromScale(0, 0.82), Rotation = -90 },
		{ Size = UDim2.fromScale(0.12, 1), Position = UDim2.fromScale(0, 0), Rotation = 0 },
		{ Size = UDim2.fromScale(0.12, 1), Position = UDim2.fromScale(0.88, 0), Rotation = 180 },
	}
	local frames: { Frame } = {}
	for _, edge in edges do
		local frame = create(Instance.new("Frame"), {
			BackgroundColor3 = Theme.Colors.Danger,
			BackgroundTransparency = 1,
			BorderSizePixel = 0,
			Size = edge.Size,
			Position = edge.Position,
			Parent = container,
		}, {
			create(Instance.new("UIGradient"), { Transparency = fadeOut, Rotation = edge.Rotation }),
		})
		table.insert(frames, frame)
	end

	return function(intensity: number)
		-- Bigger hits read stronger, but the effect never fully obscures the screen.
		local peak = 1 - math.clamp(0.25 + intensity * 1.5, 0.25, 0.65)
		for _, frame in frames do
			frame.BackgroundTransparency = peak
			TweenService:Create(frame, Theme.Motion.Slow, { BackgroundTransparency = 1 }):Play()
		end
	end
end

function HudController.Start()
	local playerGui = player:WaitForChild("PlayerGui")

	local screenGui = create(Instance.new("ScreenGui"), {
		Name = "HUD",
		ResetOnSpawn = false,
		Enabled = false,
		ScreenInsets = Enum.ScreenInsets.CoreUISafeInsets,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
		DisplayOrder = 1,
		Parent = playerGui,
	})
	Components.attachResponsiveScale(screenGui)

	-- The vignette ignores safe areas so it reaches the physical screen edges.
	local effectsGui = create(Instance.new("ScreenGui"), {
		Name = "HUDEffects",
		ResetOnSpawn = false,
		ScreenInsets = Enum.ScreenInsets.None,
		DisplayOrder = 0,
		Parent = playerGui,
	})
	local flashDamage = buildVignette(effectsGui)

	-- Vitals ---------------------------------------------------------------------------------
	local vitals = create(Instance.new("Frame"), {
		Name = "Vitals",
		AnchorPoint = Vector2.new(0.5, 1),
		BackgroundTransparency = 1,
		Position = UDim2.new(0.5, 0, 1, -BOTTOM_MARGIN),
		Size = UDim2.fromOffset(VITALS_WIDTH + Theme.Spacing.S + STATS_BUTTON_WIDTH, VITALS_HEIGHT),
		Parent = screenGui,
	})

	local badge = Components.panel({
		Name = "LevelBadge",
		Size = UDim2.fromOffset(BADGE_WIDTH, VITALS_HEIGHT),
		Parent = vitals,
	})
	Components.label({
		Text = "LEVEL",
		FontFace = Theme.Fonts.Heading,
		TextSize = Theme.TextSize.Caption - 2,
		TextColor3 = Theme.Colors.TextMuted,
		TextXAlignment = Enum.TextXAlignment.Center,
		Position = UDim2.fromOffset(0, 8),
		Size = UDim2.new(1, 0, 0, 12),
		Parent = badge,
	})
	local levelLabel = Components.label({
		Name = "Level",
		Text = "1",
		FontFace = Theme.Fonts.Heading,
		TextSize = 30,
		TextColor3 = Theme.Colors.Accent,
		TextXAlignment = Enum.TextXAlignment.Center,
		Position = UDim2.fromOffset(0, 22),
		Size = UDim2.new(1, 0, 0, 40),
		Parent = badge,
	})

	local barsPanel = Components.panel({
		Name = "Bars",
		Position = UDim2.fromOffset(BADGE_WIDTH + Theme.Spacing.S, 0),
		Size = UDim2.fromOffset(VITALS_WIDTH - BADGE_WIDTH - Theme.Spacing.S, VITALS_HEIGHT),
		Parent = vitals,
	})
	Components.padding(Theme.Spacing.M - 2).Parent = barsPanel

	local healthBar = Components.bar(Theme.Colors.Health, true)
	create(healthBar.Frame, { Name = "Health", Size = UDim2.new(1, 0, 0, 22), Parent = barsPanel })

	local xpCaption = Components.label({
		Name = "XPCaption",
		Text = "",
		FontFace = Theme.Fonts.Numeric,
		TextSize = Theme.TextSize.Caption,
		TextColor3 = Theme.Colors.TextMuted,
		TextXAlignment = Enum.TextXAlignment.Right,
		Position = UDim2.fromOffset(0, 26),
		Size = UDim2.new(1, 0, 0, 14),
		Parent = barsPanel,
	})
	Components.label({
		Text = "EXPERIENCE",
		FontFace = Theme.Fonts.Heading,
		TextSize = Theme.TextSize.Caption - 2,
		TextColor3 = Theme.Colors.TextMuted,
		Position = UDim2.fromOffset(0, 26),
		Size = UDim2.new(0.5, 0, 0, 14),
		Parent = barsPanel,
	})
	local xpBar = Components.bar(Theme.Colors.Experience, false)
	xpBar.Label.Visible = false
	create(xpBar.Frame, {
		Name = "Experience",
		AnchorPoint = Vector2.new(0, 1),
		Position = UDim2.fromScale(0, 1),
		Size = UDim2.new(1, 0, 0, 8),
		Parent = barsPanel,
	})

	-- Stats button -----------------------------------------------------------------------------
	local statsButton = Components.button("Stats", "Secondary", {
		Name = "StatsButton",
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.fromScale(1, 0),
		Size = UDim2.fromOffset(STATS_BUTTON_WIDTH, VITALS_HEIGHT),
		TextYAlignment = Enum.TextYAlignment.Center,
		Parent = vitals,
	})
	statsButton.OnActivated(StatsPanelController.Toggle)

	local hotkeyHint = Components.label({
		Name = "Hotkey",
		Text = "",
		FontFace = Theme.Fonts.Numeric,
		TextSize = Theme.TextSize.Caption - 1,
		TextColor3 = Theme.Colors.TextMuted,
		TextXAlignment = Enum.TextXAlignment.Center,
		AnchorPoint = Vector2.new(0, 1),
		Position = UDim2.new(0, 0, 1, -6),
		Size = UDim2.new(1, 0, 0, 14),
		Parent = statsButton.Instance,
	})
	InputMode.Observe(function(mode)
		hotkeyHint.Text = if mode == "KeyboardMouse" then "[C]" elseif mode == "Gamepad" then "[Y]" else ""
	end)

	local pointsBadge = create(Instance.new("Frame"), {
		Name = "PointsBadge",
		AnchorPoint = Vector2.new(0.5, 0.5),
		BackgroundColor3 = Theme.Colors.Accent,
		BorderSizePixel = 0,
		Position = UDim2.new(1, -4, 0, 4),
		Size = UDim2.fromOffset(22, 22),
		Visible = false,
		ZIndex = 3,
		Parent = statsButton.Instance,
	}, { Components.corner(UDim.new(0.5, 0)) })
	local pointsBadgeLabel = Components.label({
		FontFace = Theme.Fonts.Heading,
		TextSize = Theme.TextSize.Caption,
		TextColor3 = Theme.Colors.TextOnAccent,
		TextXAlignment = Enum.TextXAlignment.Center,
		ZIndex = 4,
		Parent = pointsBadge,
	})

	-- Toasts and banner ------------------------------------------------------------------------
	local toastArea = create(Instance.new("Frame"), {
		Name = "Toasts",
		AnchorPoint = Vector2.new(0.5, 1),
		BackgroundTransparency = 1,
		Position = UDim2.new(0.5, 0, 1, -(BOTTOM_MARGIN + VITALS_HEIGHT + Theme.Spacing.S)),
		Size = UDim2.fromOffset(260, 120),
		Parent = screenGui,
	}, {
		create(Instance.new("UIListLayout"), {
			SortOrder = Enum.SortOrder.LayoutOrder,
			VerticalAlignment = Enum.VerticalAlignment.Bottom,
			HorizontalAlignment = Enum.HorizontalAlignment.Center,
			Padding = UDim.new(0, 2),
		}),
	})
	local toastOrder = 0

	local function showToast(text: string, color: Color3)
		toastOrder += 1
		local toast = Components.label({
			Text = text,
			FontFace = Theme.Fonts.Heading,
			TextSize = Theme.TextSize.Label,
			TextColor3 = color,
			TextTransparency = 1,
			TextXAlignment = Enum.TextXAlignment.Center,
			LayoutOrder = toastOrder,
			Size = UDim2.new(1, 0, 0, 22),
			Parent = toastArea,
		})
		local shadow = Components.textShadow()
		shadow.Transparency = 1
		shadow.Parent = toast

		local labels: { TextLabel } = {}
		for _, child in toastArea:GetChildren() do
			if child:IsA("TextLabel") then
				table.insert(labels, child)
			end
		end
		if #labels > MAX_TOASTS then
			table.sort(labels, function(a, b)
				return a.LayoutOrder < b.LayoutOrder
			end)
			labels[1]:Destroy()
		end

		TweenService:Create(toast, Theme.Motion.Fast, { TextTransparency = 0 }):Play()
		TweenService:Create(shadow, Theme.Motion.Fast, { Transparency = 0.35 }):Play()
		task.delay(TOAST_LIFETIME, function()
			if toast.Parent then
				TweenService:Create(toast, Theme.Motion.Slow, { TextTransparency = 1 }):Play()
				TweenService:Create(shadow, Theme.Motion.Slow, { Transparency = 1 }):Play()
				task.delay(Theme.Motion.Slow.Time, function()
					toast:Destroy()
				end)
			end
		end)
	end

	local banner = create(Instance.new("Frame"), {
		Name = "LevelUpBanner",
		AnchorPoint = Vector2.new(0.5, 0.5),
		BackgroundTransparency = 1,
		Position = UDim2.fromScale(0.5, 0.24),
		Size = UDim2.fromOffset(420, 96),
		Visible = false,
		Parent = screenGui,
	})
	local bannerScale = create(Instance.new("UIScale"), { Parent = banner })
	local bannerTitle = Components.label({
		FontFace = Theme.Fonts.Heading,
		TextSize = Theme.TextSize.Display,
		TextColor3 = Theme.Colors.Accent,
		TextXAlignment = Enum.TextXAlignment.Center,
		Size = UDim2.new(1, 0, 0, 52),
		Parent = banner,
	})
	local bannerSubtitle = Components.label({
		FontFace = Theme.Fonts.Body,
		TextSize = Theme.TextSize.Label,
		TextXAlignment = Enum.TextXAlignment.Center,
		Position = UDim2.fromOffset(0, 54),
		Size = UDim2.new(1, 0, 0, 24),
		Parent = banner,
	})
	local bannerStrokes = { Components.textShadow(), Components.textShadow() }
	bannerStrokes[1].Parent = bannerTitle
	bannerStrokes[2].Parent = bannerSubtitle
	local bannerToken = 0

	local function setBannerTransparency(alpha: number, tweenInfo: TweenInfo?)
		local strokeAlpha = 0.35 + alpha * 0.65
		if tweenInfo then
			TweenService:Create(bannerTitle, tweenInfo, { TextTransparency = alpha }):Play()
			TweenService:Create(bannerSubtitle, tweenInfo, { TextTransparency = alpha }):Play()
			for _, stroke in bannerStrokes do
				TweenService:Create(stroke, tweenInfo, { Transparency = strokeAlpha }):Play()
			end
		else
			bannerTitle.TextTransparency = alpha
			bannerSubtitle.TextTransparency = alpha
			for _, stroke in bannerStrokes do
				stroke.Transparency = strokeAlpha
			end
		end
	end

	local function showLevelUp(level: number, levelsGained: number)
		bannerToken += 1
		local token = bannerToken
		local points = levelsGained * ProgressionConfig.StatPointsPerLevel
		bannerTitle.Text = "LEVEL " .. tostring(level)
		bannerSubtitle.Text = string.format("+%d attribute points", points)

		setBannerTransparency(1)
		bannerScale.Scale = 0.85
		banner.Visible = true
		setBannerTransparency(0, Theme.Motion.Medium)
		TweenService:Create(bannerScale, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()

		task.delay(BANNER_HOLD, function()
			if token ~= bannerToken then
				return
			end
			setBannerTransparency(1, Theme.Motion.Slow)
			task.delay(Theme.Motion.Slow.Time, function()
				if token == bannerToken then
					banner.Visible = false
				end
			end)
		end)
	end

	-- Bindings ---------------------------------------------------------------------------------
	local function refreshProgress(instant: boolean)
		local level = getNumberAttribute(PlayerAttributes.Level, 1)
		local xp = getNumberAttribute(PlayerAttributes.XP, 0)
		local required = Progression.XPToNextLevel(level)
		levelLabel.Text = tostring(level)
		if required > 0 then
			xpBar.SetProgress(xp / required, instant)
			xpCaption.Text = string.format("%d / %d", xp, required)
		else
			xpBar.SetProgress(1, true)
			xpCaption.Text = "MAX LEVEL"
		end

		local points = getNumberAttribute(PlayerAttributes.StatPoints, 0)
		pointsBadge.Visible = points > 0
		pointsBadgeLabel.Text = if points > 99 then "99+" else tostring(points)
	end

	local lastLevel = getNumberAttribute(PlayerAttributes.Level, 1)
	player:GetAttributeChangedSignal(PlayerAttributes.Level):Connect(function()
		local level = getNumberAttribute(PlayerAttributes.Level, 1)
		-- A level-up wraps the bar; snap instead of animating it backwards.
		refreshProgress(level ~= lastLevel)
		lastLevel = level
	end)
	player:GetAttributeChangedSignal(PlayerAttributes.XP):Connect(function()
		refreshProgress(false)
	end)
	player:GetAttributeChangedSignal(PlayerAttributes.StatPoints):Connect(function()
		refreshProgress(false)
	end)

	local characterConnections: { RBXScriptConnection } = {}
	local function bindCharacter(character: Model)
		for _, connection in characterConnections do
			connection:Disconnect()
		end
		table.clear(characterConnections)

		local found = character:WaitForChild("Humanoid", 10)
		if not found or not found:IsA("Humanoid") or player.Character ~= character then
			return
		end
		local humanoid = found
		local lastHealth = humanoid.Health

		local function refreshHealth(instant: boolean)
			local maxHealth = math.max(humanoid.MaxHealth, 1)
			healthBar.SetProgress(humanoid.Health / maxHealth, instant)
			healthBar.Label.Text = string.format("%d / %d", math.ceil(humanoid.Health), math.floor(maxHealth))
		end
		refreshHealth(true)

		table.insert(characterConnections, humanoid.HealthChanged:Connect(function(health)
			if health < lastHealth - 0.5 then
				flashDamage((lastHealth - health) / math.max(humanoid.MaxHealth, 1))
			end
			lastHealth = health
			refreshHealth(false)
		end))
		table.insert(characterConnections, humanoid:GetPropertyChangedSignal("MaxHealth"):Connect(function()
			refreshHealth(false)
		end))
	end

	player.CharacterAdded:Connect(bindCharacter)
	if player.Character then
		task.spawn(bindCharacter, player.Character)
	end

	Net.RewardGranted.OnClientEvent:Connect(function(reward: Net.RewardInfo)
		if type(reward) ~= "table" then
			return
		end
		showToast(string.format("+%d XP", reward.XP), Theme.Colors.Experience)
		if reward.LevelsGained > 0 then
			showLevelUp(reward.NewLevel, reward.LevelsGained)
		end
	end)

	-- Reveal the HUD once data has loaded so players never see placeholder values.
	local function revealIfLoaded()
		if player:GetAttribute(PlayerAttributes.DataLoaded) == true then
			lastLevel = getNumberAttribute(PlayerAttributes.Level, 1)
			refreshProgress(true)
			screenGui.Enabled = true
		end
	end
	player:GetAttributeChangedSignal(PlayerAttributes.DataLoaded):Connect(revealIfLoaded)
	revealIfLoaded()
end

return HudController
