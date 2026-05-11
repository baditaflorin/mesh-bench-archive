---
status: accepted
date: 2026-05-11
---

# 0003 — Audio storage and lifetime

## Context

We need to store voice clips that:
- Survive across users coming and going.
- Don't survive forever — when the room empties, the archive should evaporate.
- Don't require a server.
- Stay reasonably small.

## Decision

- **Storage**: shared `Y.Array<Clip>` where `Clip = { id, ts, mime, data: base64 }`.
- **Format**: Opus in WebM (where supported), AAC in MP4 fallback. The browser picks via `MediaRecorder.isTypeSupported`.
- **Encoding**: base64 — Yjs doesn't speak `Blob` idiomatically. Doubles the byte cost; we accept it.
- **Length cap**: 30 seconds per clip.
- **Buffer cap**: 30 clips max. New clips evict the oldest (FIFO).
- **Lifetime**: as long as at least one phone with the Yjs document open is in the room. When all phones leave, the CRDT state is no longer hosted anywhere and the archive is gone.

## Consequences

- **Memory footprint**: 30 × ~250 KB base64 ≈ 7.5 MB per connected phone. Fine for a phone with the tab open. We do not persist to IndexedDB; that would defeat the "evaporates when room empties" property.
- **No bench is forever.** A phone returning to a bench after a week may find nothing — that's the design.
- **A single connected phone keeps the archive alive.** If you really want to keep it longer, leave one tab open.

## Alternatives considered

- **Persist to IndexedDB on each phone, rebroadcast on rejoin.** Rejected — defeats the "evaporates" property and stores personal audio durably on devices the recorder didn't opt into.
- **Store an IPFS CID in Yjs, audio on IPFS.** Rejected — introduces a third-party network dependency. The app's spirit is "no third parties."
- **Store WAV instead of Opus.** Rejected — 10× the bytes.
- **Use ArrayBuffer in Yjs directly instead of base64.** Yjs supports `Uint8Array`, but the JSON-friendly base64 path is more portable across CRDT versions and easier to debug. The 33% size hit is acceptable here.
