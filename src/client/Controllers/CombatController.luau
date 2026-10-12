--!strict
-- Melee input and feedback. Input: hold left mouse, R2 / X on gamepad, or the on-screen button on
-- touch devices. The client mirrors the server's combo timing to animate instantly, but only the
-- server decides what is hit; HitConfirmed drives damage numbers and impact effects.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local Net = require(ReplicatedStorage.Shared.Net)
local CombatConfig = require(ReplicatedStorage.Shared.Config.CombatConfig)
local Theme = require(script.Parent.Parent.UI.Theme)
local Components = require(script.Parent.Parent.UI.Components)
local InputMode = require(script.Parent.Parent.InputMode)

local create = Components.create

local MOUSE_SOURCE = "Mouse"
local GAMEPAD_SOURCE = "Gamepad"
local TOUCH_SOURCE = "Touch"
local GAMEPAD_ATTACK_KEYS = { [Enum.KeyCode.ButtonR2] = true, [Enum.KeyCode.ButtonX] = true }

local DAMAGE_NUMBER_LIFETIME = 0.7
local FOV_PUNCH = 2.5

local player = Players.LocalPlayer

local CombatController = {}

local comboIndex = 0
local lastSwingAt = -math.huge
local nextSwingAt = 0
local heldSources: { [string]: boolean } = {}
local holdThread: thread? = nil
local touchInput: InputObject? = nil

local animationTracks: { AnimationTrack? } = {}
local swingEffect: Part? = nil
local fovPunchActive = false

local function getAliveCharacter(): (Model?, Humanoid?, BasePart?)
	local character = player.Character
	if not character then
		return nil, nil, nil
	end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	local root = character:FindFirstChild("HumanoidRootPart")
	if not humanoid or humanoid.Health <= 0 or not root or not root:IsA("BasePart") then
		return nil, nil, nil
	end
	return character, humanoid, root
end

local function playSound(soundId: string, parent: Instance?)
	if soundId == "" or not parent then
		return
	end
	local sound = create(Instance.new("Sound"), { SoundId = soundId, Volume = 0.6, Parent = parent })
	sound.Ended:Once(function()
		sound:Destroy()
	end)
	sound:Play()
end

local function loadAnimations(character: Model)
	table.clear(animationTracks)
	local humanoid = character:WaitForChild("Humanoid", 10)
	if not humanoid or not humanoid:IsA("Humanoid") then
		return
	end
	local animator = humanoid:FindFirstChildOfClass("Animator") or humanoid:WaitForChild("Animator", 10)
	if not animator or not animator:IsA("Animator") or player.Character ~= character then
		return
	end
	for index, animationId in CombatConfig.ComboAnimationIds do
		if animationId ~= "" then
			local animation = create(Instance.new("Animation"), { AnimationId = animationId })
			local track = animator:LoadAnimation(animation)
			track.Priority = Enum.AnimationPriority.Action
			animationTracks[index] = track
		end
	end
end

-- PLACEHOLDER: a brief pale slash in front of the character, shown only when no animation is
-- configured for this combo step. Visible to the local player only.
local function showPlaceholderSwing(root: BasePart, index: number, isFinisher: boolean)
	local effect = swingEffect
	if not effect or not effect.Parent then
		effect = create(Instance.new("Part"), {
			Name = "SwingEffect",
			Anchored = true,
			CanCollide = false,
			CanQuery = false,
			CanTouch = false,
			CastShadow = false,
			Material = Enum.Material.Neon,
			Color = Theme.Colors.Damage,
			Transparency = 1,
			Parent = workspace,
		})
		swingEffect = effect
	end
	assert(effect, "swing effect exists")

	local tilt = if index % 2 == 0 then -35 else 35
	effect.Size = if isFinisher then Vector3.new(5.5, 0.15, 1.2) else Vector3.new(4, 0.12, 0.8)
	effect.CFrame = root.CFrame * CFrame.new(0, 0.4, -2.6) * CFrame.Angles(0, 0, math.rad(tilt))
	effect.Transparency = 0.35
	TweenService:Create(effect, TweenInfo.new(0.14, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Transparency = 1 }):Play()
end

local function tryAttack()
	local now = os.clock()
	if now < nextSwingAt then
		return
	end
	local _, _, root = getAliveCharacter()
	if not root then
		return
	end

	if now - lastSwingAt > CombatConfig.ComboResetTime or comboIndex >= CombatConfig.ComboLength then
		comboIndex = 1
	else
		comboIndex += 1
	end
	local isFinisher = comboIndex == CombatConfig.ComboLength
	lastSwingAt = now
	nextSwingAt = now + (if isFinisher then CombatConfig.FinisherRecovery else CombatConfig.AttackInterval)

	local track = animationTracks[comboIndex]
	if track then
		track:Play(0.05)
	else
		showPlaceholderSwing(root, comboIndex, isFinisher)
	end
	playSound(CombatConfig.SwingSoundId, root)

	Net.RequestAttack:FireServer()
end

local function setHeld(source: string, held: boolean)
	if held then
		heldSources[source] = true
	else
		heldSources[source] = nil
	end
	if held and not holdThread then
		holdThread = task.spawn(function()
			while next(heldSources) ~= nil do
				tryAttack()
				task.wait()
			end
			holdThread = nil
		end)
	end
end

local function showDamageNumber(model: Model, damage: number, isFinisher: boolean, killed: boolean)
	local adornee = model:FindFirstChild("Head") or model.PrimaryPart
	if not adornee or not adornee:IsA("BasePart") then
		return
	end
	local playerGui = player:FindFirstChildOfClass("PlayerGui")
	if not playerGui then
		return
	end

	local jitter = Vector3.new(math.random(-10, 10) / 10, 0, math.random(-10, 10) / 10)
	local billboard = create(Instance.new("BillboardGui"), {
		Adornee = adornee,
		AlwaysOnTop = true,
		LightInfluence = 0,
		ResetOnSpawn = false,
		Size = UDim2.fromOffset(120, 40),
		StudsOffsetWorldSpace = Vector3.new(0, 1.5, 0) + jitter,
		Parent = playerGui,
	})
	local label = Components.label({
		Text = tostring(math.floor(damage + 0.5)),
		FontFace = Theme.Fonts.Heading,
		TextSize = if isFinisher or killed then 30 else 24,
		TextColor3 = if isFinisher or killed then Theme.Colors.Accent else Theme.Colors.Damage,
		TextXAlignment = Enum.TextXAlignment.Center,
		Parent = billboard,
	})
	local shadow = Components.textShadow()
	shadow.Parent = label

	local rise = TweenInfo.new(DAMAGE_NUMBER_LIFETIME, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
	TweenService:Create(billboard, rise, { StudsOffsetWorldSpace = billboard.StudsOffsetWorldSpace + Vector3.new(0, 2, 0) }):Play()
	local fade = TweenInfo.new(DAMAGE_NUMBER_LIFETIME * 0.5, Enum.EasingStyle.Quad, Enum.EasingDirection.In, 0, false, DAMAGE_NUMBER_LIFETIME * 0.5)
	TweenService:Create(label, fade, { TextTransparency = 1 }):Play()
	TweenService:Create(shadow, fade, { Transparency = 1 }):Play()
	task.delay(DAMAGE_NUMBER_LIFETIME, function()
		billboard:Destroy()
	end)
end

local function flashModel(model: Model)
	local highlight = create(Instance.new("Highlight"), {
		DepthMode = Enum.HighlightDepthMode.Occluded,
		FillColor = Color3.new(1, 1, 1),
		FillTransparency = 0.4,
		OutlineTransparency = 1,
		Parent = model,
	})
	local tween = TweenService:Create(highlight, TweenInfo.new(0.15), { FillTransparency = 1 })
	tween.Completed:Once(function()
		highlight:Destroy()
	end)
	tween:Play()
end

local function punchCamera()
	local camera = workspace.CurrentCamera
	if fovPunchActive or not camera then
		return
	end
	fovPunchActive = true
	local baseFov = camera.FieldOfView
	local out = TweenService:Create(camera, TweenInfo.new(0.06, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		FieldOfView = baseFov + FOV_PUNCH,
	})
	out.Completed:Once(function()
		local back = TweenService:Create(camera, TweenInfo.new(0.18, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			FieldOfView = baseFov,
		})
		back.Completed:Once(function()
			fovPunchActive = false
		end)
		back:Play()
	end)
	out:Play()
end

local function onHitConfirmed(hits: { Net.HitInfo })
	if type(hits) ~= "table" then
		return
	end
	local anyFinisher = false
	for _, hit in hits do
		if typeof(hit.Model) == "Instance" and hit.Model.Parent then
			flashModel(hit.Model)
			showDamageNumber(hit.Model, hit.Damage, hit.Finisher, hit.Killed)
			playSound(CombatConfig.HitSoundId, hit.Model.PrimaryPart)
			anyFinisher = anyFinisher or hit.Finisher
		end
	end
	if anyFinisher then
		punchCamera()
	end
end

local function buildTouchButton()
	local playerGui = player:WaitForChild("PlayerGui")
	-- Separate unscaled ScreenGui so the button lines up with Roblox's own jump button, which is
	-- sized from the raw screen size rather than our UIScale.
	local touchGui = create(Instance.new("ScreenGui"), {
		Name = "TouchCombat",
		ResetOnSpawn = false,
		ScreenInsets = Enum.ScreenInsets.DeviceSafeInsets,
		Enabled = false,
		Parent = playerGui,
	})
	local button = create(Instance.new("TextButton"), {
		Name = "Attack",
		AnchorPoint = Vector2.new(1, 1),
		AutoButtonColor = false,
		BackgroundColor3 = Theme.Colors.Surface,
		BackgroundTransparency = 0.25,
		FontFace = Theme.Fonts.Heading,
		Text = "ATTACK",
		TextColor3 = Theme.Colors.TextPrimary,
		TextSize = Theme.TextSize.Caption,
		Parent = touchGui,
	}, { Components.corner(UDim.new(0.5, 0)) :: Instance, Components.stroke(Theme.Colors.Accent, 2) })

	local function layout()
		local camera = workspace.CurrentCamera
		if not camera then
			return
		end
		local viewport = camera.ViewportSize
		-- Mirrors the default jump button: 70px on small screens, 120px otherwise.
		if math.min(viewport.X, viewport.Y) <= 500 then
			button.Size = UDim2.fromOffset(64, 64)
			button.Position = UDim2.new(1, -108, 1, -24)
		else
			button.Size = UDim2.fromOffset(104, 104)
			button.Position = UDim2.new(1, -184, 1, -96)
		end
	end
	layout()
	if workspace.CurrentCamera then
		workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(layout)
	end

	button.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.Touch and input.UserInputState == Enum.UserInputState.Begin then
			touchInput = input
			button.BackgroundColor3 = Theme.Colors.AccentPressed
			setHeld(TOUCH_SOURCE, true)
		end
	end)
	-- Watch the specific touch globally: the finger may slide off the button before lifting.
	UserInputService.InputEnded:Connect(function(input)
		if input == touchInput then
			touchInput = nil
			button.BackgroundColor3 = Theme.Colors.Surface
			setHeld(TOUCH_SOURCE, false)
		end
	end)

	InputMode.Observe(function(mode)
		touchGui.Enabled = mode == "Touch"
		if mode ~= "Touch" and touchInput then
			touchInput = nil
			setHeld(TOUCH_SOURCE, false)
		end
	end)
end

function CombatController.Start()
	UserInputService.InputBegan:Connect(function(input, gameProcessed)
		if gameProcessed then
			return
		end
		if input.UserInputType == Enum.UserInputType.MouseButton1 then
			setHeld(MOUSE_SOURCE, true)
		elseif GAMEPAD_ATTACK_KEYS[input.KeyCode] then
			setHeld(GAMEPAD_SOURCE, true)
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 then
			setHeld(MOUSE_SOURCE, false)
		elseif GAMEPAD_ATTACK_KEYS[input.KeyCode] then
			setHeld(GAMEPAD_SOURCE, false)
		end
	end)
	-- Releasing input while the window is unfocused never fires InputEnded.
	UserInputService.WindowFocusReleased:Connect(function()
		table.clear(heldSources)
	end)

	player.CharacterAdded:Connect(function(character)
		comboIndex = 0
		loadAnimations(character)
	end)
	if player.Character then
		task.spawn(loadAnimations, player.Character)
	end

	Net.HitConfirmed.OnClientEvent:Connect(onHitConfirmed)

	if UserInputService.TouchEnabled then
		buildTouchButton()
	end
end

return CombatController
