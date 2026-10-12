#!/usr/bin/env python3
"""Runs the plain-Luau tests for pure game logic outside Roblox.

The standalone `luau` CLI has no file I/O, so this script bundles the modules under test into one
chunk, stubbing the small part of the Roblox environment they touch at require time.

Usage: python3 tests/run_tests.py [path/to/luau]
"""
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Roblox require paths used by the modules under test -> bundle module names.
MODULES = {
    "ProgressionConfig": "src/shared/Config/ProgressionConfig.luau",
    "Progression": "src/shared/Progression.luau",
    "PlayerDataSchema": "src/server/Data/PlayerDataSchema.luau",
    "Spec": "tests/progression.spec.luau",
}

PRELUDE = """
local __modules = {}
local __cache = {}
local function __require(name)
    if __cache[name] == nil then __cache[name] = __modules[name]() end
    return __cache[name]
end
local __script = { Parent = { Config = { ProgressionConfig = "ProgressionConfig" } } }
local __game = {
    GetService = function(_, service)
        assert(service == "ReplicatedStorage", "service not stubbed: " .. service)
        return { Shared = { Config = { ProgressionConfig = "ProgressionConfig" } } }
    end,
}
"""

MODULE_TEMPLATE = """
__modules[{name!r}] = function()
    local script, game, require = __script, __game, __require
{body}
end
"""

FOOTER = """
local failures = __require("Spec")(__require("Progression"), __require("ProgressionConfig"), __require("PlayerDataSchema"))
print(if failures == 0 then "All tests passed." else failures .. " test(s) failed.")
if failures > 0 then error("tests failed") end
"""


def main() -> int:
    luau = sys.argv[1] if len(sys.argv) > 1 else "luau"
    parts = [PRELUDE]
    for name, path in MODULES.items():
        source = (ROOT / path).read_text().replace("--!strict", "")
        parts.append(MODULE_TEMPLATE.format(name=name, body=source))
    parts.append(FOOTER)

    with tempfile.NamedTemporaryFile("w", suffix=".luau", delete=False) as bundle:
        bundle.write("\n".join(parts))
    return subprocess.run([luau, bundle.name]).returncode


if __name__ == "__main__":
    sys.exit(main())
