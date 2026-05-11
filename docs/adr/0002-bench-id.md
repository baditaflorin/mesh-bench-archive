---
status: accepted
date: 2026-05-11
---

# 0002 — Bench ID in URL hash

## Context

A physical bench needs a way to map to a Yjs room ID. The mapping has to fit in a QR sticker and be impossible to confuse with another bench.

## Decision

- **Bench ID = URL hash fragment** of the Pages URL. Example: `https://baditaflorin.github.io/mesh-bench-archive/#park-bench-A`.
- The hash is never sent to the GitHub Pages server — it's purely client-side, which is perfect.
- Two stickers with the same hash share an archive. Two stickers with different hashes share nothing.

The page reads the hash on load, listens for `hashchange`, and persists the last bench ID in localStorage so the same phone returning to the live URL without scanning the sticker still sees its last bench.

## Consequences

- **No registry of benches.** Anyone can mint a bench ID by writing one in a QR. We make no attempt to namespace or reserve names — the human factor of "is there already a `park-bench-A` sticker in some city?" is the user's problem. Collisions are mostly harmless (you'd just join their archive too).
- **The QR sticker has to encode the full URL**, not just the ID. Stickers are usually printed with a URL-encoding QR generator and don't need a special protocol.
- **No discovery**. You only find a bench's archive by scanning *that* bench's sticker (or knowing its ID from a friend).

## Alternatives considered

- **Bench ID in a path segment** (`/bench/park-A`). Rejected — would require SPA routing and a 404 fallback. The hash is simpler and Pages-friendly.
- **Geolocation-based room IDs** (round GPS coordinates to ~10 m). Rejected — phones in pockets don't have reliable indoor GPS, and reading geolocation requires a permission prompt that defeats the casual-scan experience.
