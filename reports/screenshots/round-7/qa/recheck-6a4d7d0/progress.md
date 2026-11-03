# QA 7d progress (6a4d7d0)
- scratch: /tmp/claude-0/-home-user-mobile-game/0ccd7f5b-40f0-5bc7-95d2-5aaebf0b5643/scratchpad/r7f (tree/tools/bld = 6a4d7d0, base = 1b34594)
- DONE: validate-data PASS; check-identity PASS 46 (neg appName FAIL exit 1); banned-grep 0 hits (neg probe 3 hits); placeholder 0 (proof 2/3)
- DONE: release bundle, own derivation reports/qa/round-7d-tools/hook-list.mjs: clean 0 for all distinctive hook/switch names (incl disableComboZones, cinFadeMs, disablePopClamp, disableShoutFit), hooks build >0, clean2 0. Generic names (data, game, save...) reviewed = game/Phaser fields. Planted must-FAIL: qaPlantA (sc.) + qaPlantB (scene.) -> my tool 1/1; project test fails for A only (misses scene. handle) -> POLISH coverage note
- [running] vitest + full e2e in r7f/tree (phase1.sh)
- [queued] phase2.sh (waits for e2e): shout-drop, smoke 7c01 x3+neg, shout-live x3+neg, perframe x3+neg, forced x3+neg, qa-busy x3, smoke 7b01 x3+neg, perf A/B 8v8 vs 1b34594, base shout-live
