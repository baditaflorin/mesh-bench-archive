# Privacy threat model — mesh-bench-archive

## What other peers at this bench can see

- Every voice clip you record. They hear your voice and whatever you said.
- The timestamp at which the clip was recorded.
- Approximate clip size (in KB).

That's the whole point — leaving a voice note for strangers means strangers hear your voice. Don't say anything you wouldn't say in the open near the bench.

## What other peers CANNOT see

- Your identity. No name field. No persistent ID across sessions.
- Your location. The Bench ID is in the URL; the app does not read GPS.

## Lifetime

When every connected phone closes its tab, the archive evaporates. There is no server. We document this as a feature; you should consider it a privacy property:

- Voice clips you leave at a quiet bench probably outlive the night, because at least one person who scanned will be around.
- Voice clips you leave at a busy bench evaporate fast — every minute someone closes their tab, and eventually nobody's left.
- A voice clip you leave at a bench nobody visits for 24 hours is gone.

## What the signaling server sees

The bench ID (e.g. `mesh-bench-archive:park-bench-A`) and encrypted SDP offers/answers.

## What the TURN server sees

Encrypted DTLS bytes when peers can't connect directly. It cannot decrypt your audio.

## What the analytics beacon sees (this is not audio or the P2P mesh)

Separately from the WebRTC mesh above, every page load fires a 1×1 pixel
request to `https://pixel.0exec.com/pix.gif` (shared fleet-wide analytics
run by the same operator as this app). This is standalone HTTP tracking, not
part of the peer-to-peer archive — it happens even before you tap "Open this
bench's archive," and it is a real exception to "no server stores anything."

The request includes:

- `app` — this app's id (`mesh-bench-archive`).
- `room` — **the bench ID from the URL hash, up to 64 characters** (e.g.
  `park-bench-A`). Because the bench ID is exactly the place label printed on
  the sticker, this is a location proxy: the server operator can see which
  physical bench was opened and when, even without GPS.
- `peer` — the first 12 characters of your session's peer id, if the room has
  connected.
- `inviter`, app version, `document.referrer`, and a timestamp.
- Your IP address, inherent to any HTTP request (not explicitly logged by the
  app, but visible to the server the same way it is for any web request).

This beacon can be turned off per device via Settings → "Opt out of anonymous
pageview pings," and it is skipped automatically when the browser sends
Do-Not-Track. It is unrelated to voice-note transport and never touches audio
data or the Yjs document.

## Permission asked

`navigator.mediaDevices.getUserMedia({ audio: true })`. The browser shows the "microphone in use" indicator while you're recording.
