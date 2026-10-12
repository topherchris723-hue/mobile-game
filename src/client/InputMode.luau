--!strict
-- Tracks which input family the player is currently using so UI can show the right prompts
-- (key hints, gamepad glyphs, touch buttons) and switch live when they change devices.

local UserInputService = game:GetService("UserInputService")

export type Mode = "KeyboardMouse" | "Gamepad" | "Touch"

local InputMode = {}

local listeners: { (Mode) -> () } = {}

local function classify(inputType: Enum.UserInputType): Mode?
	if inputType == Enum.UserInputType.Touch then
		return "Touch" :: Mode
	end
	if string.find(inputType.Name, "^Gamepad") then
		return "Gamepad" :: Mode
	end
	if inputType == Enum.UserInputType.Keyboard or string.find(inputType.Name, "^Mouse") then
		return "KeyboardMouse" :: Mode
	end
	return nil
end

local function guessInitialMode(): Mode
	local fromLastInput = classify(UserInputService:GetLastInputType())
	if fromLastInput then
		return fromLastInput :: Mode
	end
	if UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled then
		return "Touch" :: Mode
	end
	if UserInputService.GamepadEnabled and not UserInputService.KeyboardEnabled then
		return "Gamepad" :: Mode
	end
	return "KeyboardMouse" :: Mode
end

local current: Mode = guessInitialMode()

-- Accepts nil for input types that do not imply a device change (focus, accelerometer, ...).
local function setMode(mode: Mode?)
	if mode == nil or mode == current then
		return
	end
	current = mode
	for _, listener in listeners do
		task.spawn(listener, mode)
	end
end

UserInputService.LastInputTypeChanged:Connect(function(inputType: Enum.UserInputType)
	setMode(classify(inputType))
end)

function InputMode.Get(): Mode
	return current
end

-- Calls `listener` now and whenever the mode changes.
function InputMode.Observe(listener: (Mode) -> ())
	table.insert(listeners, listener)
	task.spawn(listener, current)
end

return InputMode
