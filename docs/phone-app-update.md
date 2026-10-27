## Refresh an old iPhone app

If Account is missing, keep the Mac preview running and open
`https://anurags-macbook-air.local:5443/api/app-update` on the iPhone.
Use the same hostname as the saved app; IP addresses have separate browser storage.
Save any unfinished set and close other workout tabs, then tap **Refresh app**.
The Account row appears below Home / Current workout and History; tap it to sign in.

This recovery page and its downloads bypass the offline worker through `/api`.
It downloads the whole current build before replacing cached HTML, preserves
IndexedDB workouts, cookies, and the existing worker registration.
The app checks for its current worker on opening. Wait for **Ready for offline use**.
An interrupted download keeps the previous cached HTML and saved workouts.

If the recovery page itself cannot open, the phone is not reaching this Mac
preview. Check the Mac is awake, `npm run phone` is running, both devices are
on the same Wi-Fi, and the local certificate is still trusted. Keep the saved
app and its website data; removing them could remove local workouts.

Safari tabs and installed Home Screen apps may have separate storage. A Safari
refresh applies to that browser's storage. Close and reopen the Home Screen app
online as well. If it still shows an older version, report that separately.

Verification: Safari/WebKit and Chromium at iPhone size, including an old cached
navigation that ignores new query strings, interrupted download, successful
refresh with active workout/history/cookies unchanged, and offline reopening.
