--!strict
-- Server entry point. Starts services in dependency order; DataService starts last so every
-- OnProfileLoaded listener is registered before the first player loads.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

-- Creates the remotes before any client asks for them.
require(ReplicatedStorage.Shared.Net)

local Services = script.Parent.Services
local DataService = require(Services.DataService)
local ProgressionService = require(Services.ProgressionService)
local EnemyService = require(Services.EnemyService)
local CombatService = require(Services.CombatService)

ProgressionService.Start()
EnemyService.Start()
CombatService.Start()
DataService.Start()
