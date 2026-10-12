--!strict
-- Visual design system. Every client UI pulls colours, type, spacing and motion from here so the
-- game reads as one product. Direction: weathered nautical — deep sea navy panels, parchment text,
-- brass accents. Square-ish corners and thin strokes; no gradients or glow.

local Theme = {}

Theme.Colors = {
	Surface = Color3.fromRGB(14, 23, 32),
	SurfaceRaised = Color3.fromRGB(24, 37, 50),
	SurfaceHover = Color3.fromRGB(33, 50, 66),
	Stroke = Color3.fromRGB(56, 72, 86),
	TextPrimary = Color3.fromRGB(237, 230, 214),
	TextMuted = Color3.fromRGB(146, 160, 172),
	TextOnAccent = Color3.fromRGB(26, 20, 10),
	Accent = Color3.fromRGB(212, 168, 75),
	AccentHover = Color3.fromRGB(228, 187, 98),
	AccentPressed = Color3.fromRGB(170, 132, 55),
	Health = Color3.fromRGB(196, 66, 58),
	Experience = Color3.fromRGB(63, 184, 169),
	BarTrack = Color3.fromRGB(6, 11, 16),
	BarTrail = Color3.fromRGB(236, 214, 176),
	Disabled = Color3.fromRGB(52, 62, 72),
	Danger = Color3.fromRGB(226, 72, 60),
	Damage = Color3.fromRGB(255, 240, 214),
	TextShadow = Color3.fromRGB(0, 0, 0),
}

Theme.Transparency = {
	Surface = 0.1,
	Stroke = 0.2,
}

Theme.Fonts = {
	Heading = Font.new("rbxasset://fonts/families/BuilderSans.json", Enum.FontWeight.Bold),
	Body = Font.new("rbxasset://fonts/families/BuilderSans.json", Enum.FontWeight.Medium),
	Numeric = Font.new("rbxasset://fonts/families/BuilderSans.json", Enum.FontWeight.SemiBold),
}

Theme.TextSize = {
	Caption = 13,
	Body = 15,
	Label = 17,
	Title = 22,
	Display = 44,
}

Theme.Spacing = {
	XS = 4,
	S = 8,
	M = 12,
	L = 16,
	XL = 24,
}

Theme.CornerRadius = UDim.new(0, 4)

Theme.Motion = {
	-- Hover / press feedback.
	Fast = TweenInfo.new(0.1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
	-- Panels opening, bars filling.
	Medium = TweenInfo.new(0.22, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
	-- Banners and fades.
	Slow = TweenInfo.new(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
	-- Health-bar trail: holds, then catches up, so the size of a hit stays readable.
	Trail = TweenInfo.new(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.Out, 0, false, 0.25),
}

-- The reference resolution UI is designed at. UIScale maps it to the real viewport.
Theme.ReferenceViewport = Vector2.new(1600, 900)
Theme.MinScale = 0.72
Theme.MaxScale = 1.25

return Theme
