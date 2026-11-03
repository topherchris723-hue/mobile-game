#!/bin/bash
# QA 7d perf A/B, method fixed in advance: 4 alternating cycles x 2 runs = 8 runs each; Canvas, 4x CPU; tools=6a4d7d0, base=1b34594.
S=/tmp/claude-0/-home-user-mobile-game/0ccd7f5b-40f0-5bc7-95d2-5aaebf0b5643/scratchpad/r7f
export PW_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
for c in 1 2 3 4; do
  for t in tools base; do
    echo "=== cycle $c $t"
    (cd $S/$t && npx playwright test tests/e2e/qa-perf.spec.js --project phone-360x640 -g "canvas cpu×4" --repeat-each 2 2>&1 | grep -E "perf canvas|passed|failed|p95")
  done
done
echo done
