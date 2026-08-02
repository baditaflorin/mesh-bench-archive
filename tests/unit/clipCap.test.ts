import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { enforceClipCap, pushClipCapped, type Clip } from "../../src/features/bench/clipCap";

const CAP = 30;

function makeClip(id: string, ts: number): Clip {
  return { id, ts, mime: "audio/webm", data: "" };
}

function sync(a: Y.Doc, b: Y.Doc): void {
  const updA = Y.encodeStateAsUpdate(a);
  const updB = Y.encodeStateAsUpdate(b);
  Y.applyUpdate(b, updA);
  Y.applyUpdate(a, updB);
}

describe("pushClipCapped", () => {
  it("keeps a single writer at exactly the cap (FIFO)", () => {
    const doc = new Y.Doc();
    const yClips = doc.getArray<Clip>("clips");
    for (let i = 0; i < CAP + 5; i++) {
      pushClipCapped(doc, yClips, makeClip(`c${i}`, i), CAP);
    }
    expect(yClips.length).toBe(CAP);
    // Oldest 5 were evicted; the archive holds the most recent CAP ids.
    const ids = yClips.toArray().map((c) => c.id);
    expect(ids).toEqual(Array.from({ length: CAP }, (_, i) => `c${i + 5}`));
  });

  it("never loses or duplicates clips under ordinary (non-cap) concurrent writes", () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const clipsA = docA.getArray<Clip>("clips");
    const clipsB = docB.getArray<Clip>("clips");

    // Both peers start from an empty, synced room.
    pushClipCapped(docA, clipsA, makeClip("a1", 1), CAP);
    pushClipCapped(docB, clipsB, makeClip("b1", 2), CAP);
    sync(docA, docB);

    expect(clipsA.length).toBe(2);
    expect(clipsB.length).toBe(2);
    const idsA = new Set(clipsA.toArray().map((c) => c.id));
    const idsB = new Set(clipsB.toArray().map((c) => c.id));
    expect(idsA).toEqual(new Set(["a1", "b1"]));
    expect(idsB).toEqual(new Set(["a1", "b1"]));
  });
});

describe("concurrent publishes at the cap boundary (the bug this fixes)", () => {
  function seedTwoSyncedPeersAtCap() {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const clipsA = docA.getArray<Clip>("clips");
    for (let i = 0; i < CAP; i++) {
      pushClipCapped(docA, clipsA, makeClip(`seed${i}`, i), CAP);
    }
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    const clipsB = docB.getArray<Clip>("clips");
    return { docA, docB, clipsA, clipsB };
  }

  it("demonstrates raw pushClipCapped can overshoot the cap when two peers publish simultaneously", () => {
    const { docA, docB, clipsA, clipsB } = seedTwoSyncedPeersAtCap();

    // Both peers are at the cap and publish before seeing each other's write.
    pushClipCapped(docA, clipsA, makeClip("new-A", 1000), CAP);
    pushClipCapped(docB, clipsB, makeClip("new-B", 1000), CAP);
    sync(docA, docB);

    // Documented behaviour without the self-healing observer: nothing is
    // lost or duplicated, but the archive can briefly exceed the cap.
    expect(clipsA.length).toBeGreaterThan(CAP);
    expect(clipsA.length).toBe(clipsB.length);
    expect(clipsA.toArray().map((c) => c.id)).toEqual(clipsB.toArray().map((c) => c.id));
  });

  it("enforceClipCap (as wired into the yClips observer) self-heals the overshoot on every peer, with no data loss beyond the cap", () => {
    const { docA, docB, clipsA, clipsB } = seedTwoSyncedPeersAtCap();

    pushClipCapped(docA, clipsA, makeClip("new-A", 1000), CAP);
    pushClipCapped(docB, clipsB, makeClip("new-B", 1000), CAP);
    sync(docA, docB);
    expect(clipsA.length).toBeGreaterThan(CAP);

    // Each peer independently observes the merged state and self-heals —
    // exactly what Bench.tsx's yClips.observe(refresh) callback now does.
    enforceClipCap(docA, clipsA, CAP);
    enforceClipCap(docB, clipsB, CAP);
    sync(docA, docB);

    expect(clipsA.length).toBe(CAP);
    expect(clipsB.length).toBe(CAP);
    // Both peers' newest clips survive the trim; only stale seed clips were evicted.
    const idsA = clipsA.toArray().map((c) => c.id);
    expect(idsA).toContain("new-A");
    expect(idsA).toContain("new-B");
  });

  it("self-heals a three-way concurrent burst back down to the cap", () => {
    const docSeed = new Y.Doc();
    const clipsSeed = docSeed.getArray<Clip>("clips");
    for (let i = 0; i < CAP; i++) {
      pushClipCapped(docSeed, clipsSeed, makeClip(`seed${i}`, i), CAP);
    }
    const seedUpdate = Y.encodeStateAsUpdate(docSeed);

    const docs = [docSeed, new Y.Doc(), new Y.Doc()];
    docs.slice(1).forEach((d) => Y.applyUpdate(d, seedUpdate));
    const arrays = docs.map((d) => d.getArray<Clip>("clips"));

    docs.forEach((d, i) => pushClipCapped(d, arrays[i]!, makeClip(`burst-${i}`, 5000), CAP));

    // Full pairwise merge (mesh gossip settles).
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < docs.length; i++) {
        for (let j = 0; j < docs.length; j++) {
          if (i === j) continue;
          Y.applyUpdate(docs[i]!, Y.encodeStateAsUpdate(docs[j]!));
        }
      }
    }

    expect(arrays[0]!.length).toBeGreaterThan(CAP); // overshoot before healing

    docs.forEach((d, i) => enforceClipCap(d, arrays[i]!, CAP));
    for (let i = 0; i < docs.length; i++) {
      for (let j = 0; j < docs.length; j++) {
        if (i === j) continue;
        Y.applyUpdate(docs[i]!, Y.encodeStateAsUpdate(docs[j]!));
      }
    }

    for (const arr of arrays) {
      expect(arr.length).toBe(CAP);
    }
    const idSets = arrays.map((arr) =>
      arr
        .toArray()
        .map((c) => c.id)
        .sort(),
    );
    expect(idSets[0]).toEqual(idSets[1]);
    expect(idSets[1]).toEqual(idSets[2]);
  });
});
