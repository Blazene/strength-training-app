# Day 14: iPhone workout test

Status: setup prepared; your actual iPhone workout is still pending.

The Mac's localhost URL is not the Mac when opened on an iPhone. To test offline
reopening before deployment, use the secure local preview on the same Wi-Fi.
Service workers require a secure context; see the [service worker requirements](https://www.w3.org/TR/service-workers/#secure-context).

## Start the phone preview

Use a **free terminal** on your Mac. You can leave the existing frontend terminal
running:

```sh
cd /Users/anurag/Projects/strength-training-app/frontend
npm run phone
```

Expected: a successful build, an HTTP setup address on port 5080, an HTTPS app
address on port 5443, and the test certificate's fingerprint. Leave this terminal
running during setup. Control + C stops both local servers.

The command uses Node and OpenSSL. It stores local certificate files under the
project's ignored `.local/phone-preview/` folder with private-key permissions.
It does not install certificates into your Mac or phone. The setup server serves
only instructions and the public certificate; HTTPS serves only built app files.
It is a local preview, not public hosting, and does not expose backend routes.

## One-time iPhone setup

1. Connect Mac and iPhone to the same Wi-Fi. Open the printed HTTP setup address
   in **Safari on your iPhone**. The page also provides an IP fallback if the
   computer name does not resolve.
2. Download the **Strength Training Local Test CA** certificate from your Mac's
   setup page and allow the profile download.
3. In Settings → General → VPN & Device Management, install the downloaded test
   profile. Then, in Settings → General → About → Certificate Trust Settings,
   enable full trust for that certificate. [Apple's certificate instructions](https://support.apple.com/en-us/102390)
4. Return to Safari and open the printed HTTPS app address. If macOS asks about
   local network access for the preview, allow it for this test.
5. Choose Share → Add to Home Screen. If offered, enable Open as Web App and Add.
   Open that icon once while connected and wait for Ready for offline use.
   [Apple's Home Screen guide](https://support.apple.com/guide/iphone/iphea86e5236/ios)

Use your own Mac's test certificate, whose fingerprint is printed in the terminal
and setup page. Remove its profile after testing. The local CA expires in 90 days.
Keep using the same app address and Home Screen icon throughout the test. Mac
workouts do not transfer to the phone yet; account sync is planned for Week 3.

## Mock workout

Run the entire test from the Home Screen app. Use mock weights and reps; this
check is about the logger.

- [ ] Add Bench Press. Confirm the decimal and numeric keyboards are comfortable.
- [ ] Log 60 kg × 8, repeat it with one Add set tap, then change to 62.5 kg × 6.
- [ ] Edit a set; delete a different set. Check the counts and values.
- [ ] Switch to History and return. Check that an unfinished form remains intact.
- [ ] Wait for Saved on this device, then turn on Airplane Mode and turn Wi-Fi off.
- [ ] Close the app from the app switcher and reopen its icon. Saved sets remain.
- [ ] Log another set offline and finish the workout. Check it in History.
- [ ] Start a second workout with Bench Press. Check the previous-session values
      and Copy previous set action.
- [ ] Re-enable connectivity. Confirm the local app still works. It should not
      claim that anything has synced; server synchronization is not built yet.

Record the iPhone model, iOS version, and any problem below, especially lost sets,
wrong copy values, keyboard friction, small targets, or excessive scrolling.

## Test result

- Date:
- iPhone model / iOS:
- Address used:
- Offline reopening passed:
- Workout saved and history correct:
- Problems observed:
- Follow-up fixes:

Until this result is filled from a real device test, Day 14 remains pending.
