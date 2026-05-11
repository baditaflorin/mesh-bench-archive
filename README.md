# mesh-bench-archive

[![Live](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh--bench--archive-D8B85A?style=flat-square)](https://baditaflorin.github.io/mesh-bench-archive/)
[![Version](https://img.shields.io/github/package-json/v/baditaflorin/mesh-bench-archive?style=flat-square&color=786e54)](https://github.com/baditaflorin/mesh-bench-archive/blob/main/package.json)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![No backend](https://img.shields.io/badge/backend-none-1a160a?style=flat-square)](docs/adr/0001-deployment-mode.md)

> Peer-to-peer mesh: voice notes tied to a place. Scan a QR sticker on a bench, hear the last visitors. Audio lives only in browsers that have scanned.

**Live:** https://baditaflorin.github.io/mesh-bench-archive/

Print a small QR sticker that encodes `https://baditaflorin.github.io/mesh-bench-archive/#park-bench-A`. Stick it on a public bench. Anyone who scans the sticker lands on this page, hears whatever recent voice notes are still alive in the mesh, and can leave their own 30-second note for the next visitor.

When everyone who scanned the bench eventually closes their browser, the archive evaporates. Memory is tied to a place — not to a server.

## How it works

- **Bench ID is the URL hash**, e.g. `/#park-bench-A`. Different stickers = different rooms = different archives. Phones with the same hash share a Yjs document.
- **30-second clips** are recorded with `MediaRecorder`, base64-encoded, and pushed into a shared `Y.Array<{ id, ts, mime, data }>`.
- **No server stores anything.** As soon as the last phone in the room closes its tab, the audio is gone. Other phones can repopulate the archive only by re-joining while at least one phone with cached state is still in the room.
- **Cap**: at most 30 clips in the buffer. New clips push old ones out (FIFO).

## Limits

- Audio sits in Yjs memory on every connected phone. 30 × 30-second Opus clips ≈ 7–9 MB per phone, which is fine for a phone with the tab open but you should not bench-archive a hundred clips.
- Audio is base64-text on the wire — Yjs doesn't speak binary buffers idiomatically. This roughly doubles the byte cost. Acceptable for ~9 MB total.
- If you want the archive to survive an empty room, that's a different app — it needs a server. This one is intentionally place-and-time-bound.

## Privacy threat model

See [docs/privacy.md](docs/privacy.md). What's on the wire: your audio (encrypted in transit via WebRTC DTLS, then sitting in Yjs on other connected phones). No name, no location data, no identity.

## Architecture

- **Mode A** — pure GitHub Pages.
- **WebRTC** — Yjs + y-webrtc with self-hosted signaling and TURN.

## Run it locally

```bash
git clone https://github.com/baditaflorin/mesh-bench-archive.git
cd mesh-bench-archive
npm install
npm run dev
```

## Self-hosted infrastructure

| Repo                                                                   | Endpoint                               | Role                      |
| ---------------------------------------------------------------------- | -------------------------------------- | ------------------------- |
| [signaling-server](https://github.com/baditaflorin/signaling-server)   | `wss://turn.0docker.com/ws`            | y-webrtc protocol fan-out |
| [turn-token-server](https://github.com/baditaflorin/turn-token-server) | `https://turn.0docker.com/credentials` | HMAC TURN creds           |
| [coturn-hetzner](https://github.com/baditaflorin/coturn-hetzner)       | `turn:turn.0docker.com:3479`           | TURN relay                |

## ADRs

- [0001 — Deployment mode](docs/adr/0001-deployment-mode.md)
- [0002 — Bench ID in URL hash](docs/adr/0002-bench-id.md)
- [0003 — Audio storage and lifetime](docs/adr/0003-audio.md)
- [0010 — GitHub Pages publishing](docs/adr/0010-pages-publishing.md)

## License

[MIT](LICENSE) © 2026 Florin Badita
