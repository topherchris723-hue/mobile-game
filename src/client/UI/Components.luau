--!strict
-- Small set of reusable UI building blocks that apply the Theme consistently.

local TweenService = game:GetService("TweenService")

local Theme = require(script.Parent.Theme)

local Components = {}

-- Applies properties then parents, so the instance is fully configured before it renders.
function Components.create<T>(instance: T, props: { [string]: any }, children: { any }?): T
	local parent = props.Parent
	for key, value in props do
		if key ~= "Parent" then
			(instance :: any)[key] = value
		end
	end
	if children then
		for _, child in children do
			child.Parent = instance :: any
		end
	end
	if parent then
		(instance :: any).Parent = parent
	end
	return instance
end

local create = Components.create

function Components.corner(radius: UDim?): UICorner
	return create(Instance.new("UICorner"), { CornerRadius = radius or Theme.CornerRadius })
end

function Components.stroke(color: Color3?, thickness: number?): UIStroke
	return create(Instance.new("UIStroke"), {
		Color = color or Theme.Colors.Stroke,
		Thickness = thickness or 1,
		Transparency = Theme.Transparency.Stroke,
		ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
	})
end

function Components.padding(all: number): UIPadding
	local offset = UDim.new(0, all)
	return create(Instance.new("UIPadding"), {
		PaddingTop = offset,
		PaddingBottom = offset,
		PaddingLeft = offset,
		PaddingRight = offset,
	})
end

-- A dark outline behind floating text so it stays legible over any scene.
function Components.textShadow(): UIStroke
	return create(Instance.new("UIStroke"), {
		Color = Theme.Colors.TextShadow,
		Thickness = 1.5,
		Transparency = 0.35,
		ApplyStrokeMode = Enum.ApplyStrokeMode.Contextual,
	})
end

function Components.panel(props: { [string]: any }): Frame
	local frame = create(Instance.new("Frame"), {
		BackgroundColor3 = Theme.Colors.Surface,
		BackgroundTransparency = Theme.Transparency.Surface,
		BorderSizePixel = 0,
	}, { Components.corner() :: Instance, Components.stroke() })
	return create(frame, props)
end

function Components.label(props: { [string]: any }): TextLabel
	local label = create(Instance.new("TextLabel"), {
		BackgroundTransparency = 1,
		FontFace = Theme.Fonts.Body,
		TextSize = Theme.TextSize.Body,
		TextColor3 = Theme.Colors.TextPrimary,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextYAlignment = Enum.TextYAlignment.Center,
		Size = UDim2.fromScale(1, 1),
	})
	return create(label, props)
end

-- Rescales a ScreenGui with the viewport so layouts authored at Theme.ReferenceViewport fit phones,
-- tablets, monitors and TVs alike.
function Components.attachResponsiveScale(screenGui: ScreenGui): UIScale
	local scale = create(Instance.new("UIScale"), { Parent = screenGui })
	local viewportConnection: RBXScriptConnection? = nil

	local function update()
		local camera = workspace.CurrentCamera
		if not camera then
			return
		end
		local viewport = camera.ViewportSize
		local ratio = math.min(viewport.X / Theme.ReferenceViewport.X, viewport.Y / Theme.ReferenceViewport.Y)
		scale.Scale = math.clamp(ratio, Theme.MinScale, Theme.MaxScale)
	end

	local function bindCamera()
		if viewportConnection then
			viewportConnection:Disconnect()
			viewportConnection = nil
		end
		local camera = workspace.CurrentCamera
		if camera then
			viewportConnection = camera:GetPropertyChangedSignal("ViewportSize"):Connect(update)
		end
		update()
	end

	workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(bindCamera)
	bindCamera()
	return scale
end

export type Bar = {
	Frame: Frame,
	Label: TextLabel,
	SetProgress: (alpha: number, instant: boolean?) -> (),
}

-- A horizontal meter. With a trail, losses leave a pale segment that catches up after a beat.
function Components.bar(fillColor: Color3, withTrail: boolean): Bar
	local track = create(Instance.new("Frame"), {
		BackgroundColor3 = Theme.Colors.BarTrack,
		BackgroundTransparency = 0.15,
		BorderSizePixel = 0,
		ClipsDescendants = true,
	}, { Components.corner(UDim.new(0, 2)) })

	local trail = create(Instance.new("Frame"), {
		Name = "Trail",
		BackgroundColor3 = Theme.Colors.BarTrail,
		BorderSizePixel = 0,
		Size = UDim2.fromScale(1, 1),
		Visible = withTrail,
		ZIndex = 1,
		Parent = track,
	}, { Components.corner(UDim.new(0, 2)) })

	local fill = create(Instance.new("Frame"), {
		Name = "Fill",
		BackgroundColor3 = fillColor,
		BorderSizePixel = 0,
		Size = UDim2.fromScale(1, 1),
		ZIndex = 2,
		Parent = track,
	}, { Components.corner(UDim.new(0, 2)) })

	local label = Components.label({
		Name = "Value",
		FontFace = Theme.Fonts.Numeric,
		TextSize = Theme.TextSize.Caption,
		TextXAlignment = Enum.TextXAlignment.Center,
		ZIndex = 3,
		Parent = track,
	})
	Components.textShadow().Parent = label

	local current = 1
	local fillTween: Tween? = nil
	local trailTween: Tween? = nil

	local function setProgress(alpha: number, instant: boolean?)
		alpha = math.clamp(if alpha == alpha then alpha else 0, 0, 1)
		local target = UDim2.fromScale(alpha, 1)
		local previousFill = fillTween
		if previousFill then
			previousFill:Cancel()
		end
		local previousTrail = trailTween
		if previousTrail then
			previousTrail:Cancel()
		end

		if instant then
			fill.Size = target
			trail.Size = target
		else
			local newFill = TweenService:Create(fill, Theme.Motion.Medium, { Size = target })
			newFill:Play()
			fillTween = newFill
			if alpha < current then
				local newTrail = TweenService:Create(trail, Theme.Motion.Trail, { Size = target })
				newTrail:Play()
				trailTween = newTrail
			else
				trail.Size = target
			end
		end
		current = alpha
	end

	return { Frame = track, Label = label, SetProgress = setProgress }
end

export type ButtonVariant = "Primary" | "Secondary"

export type Button = {
	Instance: TextButton,
	SetEnabled: (enabled: boolean) -> (),
	SetText: (text: string) -> (),
	OnActivated: (callback: () -> ()) -> RBXScriptConnection,
}

-- Themed button with hover, press, gamepad-selection and disabled states.
function Components.button(text: string, variant: ButtonVariant, props: { [string]: any }): Button
	local isPrimary = variant == "Primary"
	local idleColor = if isPrimary then Theme.Colors.Accent else Theme.Colors.SurfaceRaised
	local hoverColor = if isPrimary then Theme.Colors.AccentHover else Theme.Colors.SurfaceHover
	local pressColor = if isPrimary then Theme.Colors.AccentPressed else Theme.Colors.Surface
	local textColor = if isPrimary then Theme.Colors.TextOnAccent else Theme.Colors.TextPrimary

	local stroke = Components.stroke(if isPrimary then Theme.Colors.AccentPressed else nil)
	local button = create(Instance.new("TextButton"), {
		AutoButtonColor = false,
		BackgroundColor3 = idleColor,
		BorderSizePixel = 0,
		FontFace = Theme.Fonts.Heading,
		Text = text,
		TextColor3 = textColor,
		TextSize = Theme.TextSize.Body,
	}, { Components.corner() :: Instance, stroke })
	create(button, props)

	local enabled = true
	local hovered = false
	local pressed = false

	local function refresh()
		local color = if not enabled
			then Theme.Colors.Disabled
			elseif pressed then pressColor
			elseif hovered then hoverColor
			else idleColor
		TweenService:Create(button, Theme.Motion.Fast, { BackgroundColor3 = color }):Play()
		button.TextColor3 = if enabled then textColor else Theme.Colors.TextMuted
	end

	local function setHovered(value: boolean)
		hovered = value
		if not value then
			pressed = false
		end
		refresh()
	end

	button.MouseEnter:Connect(function()
		setHovered(true)
	end)
	button.MouseLeave:Connect(function()
		setHovered(false)
	end)
	button.SelectionGained:Connect(function()
		setHovered(true)
	end)
	button.SelectionLost:Connect(function()
		setHovered(false)
	end)
	button.MouseButton1Down:Connect(function()
		pressed = true
		refresh()
	end)
	button.MouseButton1Up:Connect(function()
		pressed = false
		refresh()
	end)

	return {
		Instance = button,
		SetEnabled = function(value: boolean)
			if enabled == value then
				return
			end
			enabled = value
			button.Selectable = value
			refresh()
		end,
		SetText = function(value: string)
			button.Text = value
		end,
		OnActivated = function(callback: () -> ())
			return button.Activated:Connect(function()
				if enabled then
					callback()
				end
			end)
		end,
	}
end

return Components
