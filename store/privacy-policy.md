# Privacy policy — DRAFT for the owner to review

Owner: compliance-checker (draft). Round 6, re-checked round 7 (2026-11-02) against `d09623e` and again (2026-11-03)
against build commit `6a4d7d0` (clean `npm run build`, bundle `index-CIYCSK_g.js`, Android project in `android/`;
evidence `reports/compliance/round-7b.md` item 3). No privacy fact changed between the two commits. This is not legal advice. The owner must review it,
fill in the bracketed fields, and host it at a public, non-PDF web address (for example GitHub Pages) before
entering that address in Play Console. If the app ever adds ads, analytics, accounts, cloud saves, online play
or purchases, this policy and the Data safety answers must be redone before that build ships.

Facts this draft relies on (evidence in `reports/compliance/round-6.md`, item 3):
- The built app made 3 requests, all to its own files (page, script, stylesheet). It made 0 requests to any other
  server in a scripted session of about 25 seconds with 40 taps. A planted request was caught, so the probe can detect one.
- `src/` contains no `XMLHttpRequest`, `WebSocket`, `sendBeacon`, analytics, ads or account code. Its only `fetch` reads
  the app's own bundled `THIRD_PARTY_LICENSES.txt` (Settings → Licenses). The Android app declares only the VIBRATE
  permission; INTERNET is removed (round 7), and it has no Google services or Capacitor plugins.
- The Android manifest keeps `android:allowBackup="true"`, so Android's own Auto Backup may copy the save to the
  player's Google account. The developer never receives that copy. Section 2 of the policy says so.
- The only thing stored is one local-storage entry, `game_save` (plus `game_save_corrupt_<time>` backups if a save
  is damaged). It holds game progress and settings only (GDD §13). The app sets no cookies.
- The only device features used are vibration (haptics, can be turned off in Settings), the reduced-motion
  preference (to pick a default) and the device clock and random-number generator (for summon timing and draws).

---

```
Privacy Policy for Fyrenza: Card Duels

Last updated: [DATE OF PUBLICATION]

[DEVELOPER NAME] ("we") made Fyrenza, a game for Android. This policy explains what happens to your
information when you play it.

The short version: Fyrenza does not collect, store on our servers, share or sell any personal or
device information. The game works fully offline.

1. Information we collect
We do not collect any information. The game has no accounts, no sign-in, no advertising, no analytics,
no crash-reporting service and no online features. It does not send any data from your device to us or
to anyone else.

2. Information saved on your device
To remember your progress, the game saves a small file on your device. It contains your game progress
(fighters, team, cleared stages, missions, the in-game currency Jade, summon counters), your settings
(volume, mute, vibration, reduce motion) and the dates this save was created and last changed. This file
stays on your device. We cannot see it. If the save is damaged, the game keeps a backup copy of it on
your device. If Android backup is turned on for your Google account, Android may include this file in
your device backup; that backup is handled by Google, and we cannot access it. Uninstalling the game or
clearing its storage deletes the data on your device.

3. Device features
The game can vibrate your device as feedback during fights. You can turn this off in Settings. The game
checks your device's "reduce motion" setting once, to choose a default for its own Reduce motion option.
Neither of these sends anything off your device.

4. Purchases and advertising
There are no in-app purchases and no ads. The only currency, Jade, is earned by playing and cannot be
bought with real money.

5. Sharing and selling
We do not share or sell any information, because we do not collect any.

6. Google Play
You download the game from Google Play. Google may collect information about your download and device
under its own privacy policy (https://policies.google.com/privacy). We do not receive personal information
about you from Google.

7. Children
The game does not collect personal information from anyone, including children.

8. Changes to this policy
If a future version of the game changes what happens to your information (for example, by adding online
features), we will update this policy and the date above before that version is released.

9. Contact
Questions about this policy: [CONTACT EMAIL]
```

---

## Notes for the owner

- Fill in `[DEVELOPER NAME]` (must match the Play Console developer name), `[CONTACT EMAIL]` and the date.
- The policy must be reachable at a public URL that is not a PDF and not geo-blocked, and be linked both in
  Play Console (App content → Privacy policy) and, recommended, inside the app (for example a "Privacy" link in
  Settings — ui-developer can add it once the URL exists).
- The policy names the game "Fyrenza: Card Duels" (store title) and "Fyrenza" (in-game title), per GDD §1 (round 7).
  The old round-3 title failed the round-6/7 trademark check and was replaced. "Fyrenza" is cleared for internal
  testing only (`reports/compliance/round-7-title.md`). Do not publish this policy or use it on a public track until a
  human has run registry clearance and recorded it in `docs/STATUS.md`. If the title changes again, change the name
  here too.
- Round 7 title change only (store-writer, at the Producer's request): no privacy facts or policy wording other than
  the game name were changed. compliance-checker still owns the facts in this draft.
- Google Play's own data handling (installs, Android vitals) is covered by Google's policy, not this one.
