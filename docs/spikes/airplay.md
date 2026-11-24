# AirPlay device spike (L4, R16)

Status: not run. The button is hidden until the site flag `features.airplay` is turned on, and the flag stays off until both checks below pass.

## Checks

1. iPhone (Safari) with an Apple TV on the same network.
   - Play a video, open the AirPlay button, pick the Apple TV.
   - The picture and sound move to the TV, the phone shows "Playing on AirPlay" with a Bring back button.
   - Pause, seek and resume from the phone still work, and the position is kept.
   - Choosing the phone again brings playback back at the same time.
2. Mac (Safari) with an Apple TV.
   - Same steps. Also check picture in picture and that the AirPlay button hides when no device is on the network.
3. Failure case: switch the Apple TV off mid-play. The player should show "AirPlay could not start. Playing here." or carry on locally, with no stuck spinner.

## Why the engine switch exists

Safari only sends a video to AirPlay when it plays through the native `<video>` source, not through a Media Source stream. On AirPlay the controller therefore builds a native engine, loads it at the current time with the playback token, then destroys the old engine.

## Decision to make after the spike

If AirPlay works with the Media Source stream plus a native `<source>` fallback on the real devices, drop the engine switch (`switchToNative`, `createNativeEngine`) and keep only the button. Record the result here and in `docs/DECISIONS.md`.

## Not built

Chromecast. The Help page carries one line saying it is not supported yet.
