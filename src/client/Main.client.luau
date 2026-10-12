--!strict
-- Client entry point. Controllers own presentation and input only; all game state is server-side.

local Controllers = script.Parent.Controllers

local StatsPanelController = require(Controllers.StatsPanelController)
local HudController = require(Controllers.HudController)
local CombatController = require(Controllers.CombatController)
local EnemyBarsController = require(Controllers.EnemyBarsController)

StatsPanelController.Start()
HudController.Start()
EnemyBarsController.Start()
CombatController.Start()
