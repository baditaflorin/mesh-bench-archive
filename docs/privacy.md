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

## Permission asked

`navigator.mediaDevices.getUserMedia({ audio: true })`. The browser shows the "microphone in use" indicator while you're recording.
