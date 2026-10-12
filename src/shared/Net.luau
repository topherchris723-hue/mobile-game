--!strict
-- Single source of truth for remotes. The server creates them when this module is first required;
-- clients wait for them. Payload shapes are documented next to each remote.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local FOLDER_NAME = "Remotes"
local isServer = RunService:IsServer()

local folder: Instance
if isServer then
	local existing = ReplicatedStorage:FindFirstChild(FOLDER_NAME)
	if existing then
		folder = existing
	else
		local created = Instance.new("Folder")
		created.Name = FOLDER_NAME
		created.Parent = ReplicatedStorage
		folder = created
	end
else
	folder = ReplicatedStorage:WaitForChild(FOLDER_NAME)
end

local function remoteEvent(name: string): RemoteEvent
	if isServer then
		local event = Instance.new("RemoteEvent")
		event.Name = name
		event.Parent = folder
		return event
	end
	return folder:WaitForChild(name) :: RemoteEvent
end

local function unreliableRemoteEvent(name: string): UnreliableRemoteEvent
	if isServer then
		local event = Instance.new("UnreliableRemoteEvent")
		event.Name = name
		event.Parent = folder
		return event
	end
	return folder:WaitForChild(name) :: UnreliableRemoteEvent
end

export type HitInfo = {
	Model: Model,
	Damage: number,
	Finisher: boolean,
	Killed: boolean,
}

export type RewardInfo = {
	XP: number,
	LevelsGained: number,
	NewLevel: number,
}

return {
	-- Client -> Server. No arguments; the server decides combo step, hitbox and damage.
	RequestAttack = remoteEvent("RequestAttack"),
	-- Client -> Server. (statId: string, amount: number)
	RequestAllocateStat = remoteEvent("RequestAllocateStat"),
	-- Server -> attacking client. ({ HitInfo }). Cosmetic only, so dropped packets are acceptable.
	HitConfirmed = unreliableRemoteEvent("HitConfirmed"),
	-- Server -> Client. (RewardInfo). Drives XP toasts and the level-up banner.
	RewardGranted = remoteEvent("RewardGranted"),
}
