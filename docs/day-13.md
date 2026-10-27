# Day 13: offline reopening and recovery

Automated tests cover the current app in Chromium and WebKit with a mobile touch
viewport. WebKit is a useful Safari compatibility check, but it does not replace
the actual iPhone workout scheduled for Day 14.

Verified flows:

- Cache the built app, log sets, stop the server, and reopen the app.
- Log and finish a workout without a reachable server.
- Open history and use previous-session sets offline.
- Detect a missing active-cache file even with a complete update cache waiting.
- Reconnect, retry setup, and recover the file without changing saved workouts.
- Recover a cached page promptly when navigation stalls.
- Retain draft input while an update downloads, without a forced reload.
- Use numeric keyboard hints, copy shortcuts, edits/deletions, and save retries.
- Replace selected values after a tap in WebKit. A Safari native-tap selection
  issue discovered during testing was fixed by selecting after tap handling.

Chromium checks include simulated offline mode. WebKit transport checks stop the
actual HTTP server, because Playwright's simulated-offline reload reported an
internal navigation error. The app successfully reloads and logs with the server
stopped. Airplane-mode and app-switcher behavior still need the real iPhone test.

## Repeat source checks

Run in a **free terminal**:

```sh
cd /Users/anurag/Projects/strength-training-app/frontend
npm test
npm run lint
npm run build
```

Expected: eleven passing tests, no lint errors, and a build containing `dist/sw.js`.
The additional unit checks ensure the local phone preview serves build files with
correct MIME types and rejects path traversal, symlink escapes, private files,
and API routes.
