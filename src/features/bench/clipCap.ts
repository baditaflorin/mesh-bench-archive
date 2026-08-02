import type * as Y from "yjs";

export type Clip = {
  id: string;
  ts: number;
  mime: string;
  data: string; // base64
};

/**
 * Push a new clip into the shared archive, trimming from the front so the
 * array never grows past `cap` *from this peer's point of view*.
 *
 * Concurrency note: the trim-then-push here is computed against this
 * peer's local (possibly stale) view of `yClips`. If two or more peers each
 * publish a clip inside the same round-trip window — the exact scenario a
 * busy bench produces — every peer independently decides "the array is at
 * cap, remove exactly one to make room" using an array length that hasn't
 * yet seen the *other* peer's simultaneous push. After the writes merge,
 * only one old clip actually got removed (both peers targeted the same
 * "oldest" slot) while N new clips got appended, so the converged archive
 * can briefly hold `cap + (writers - 1)` entries instead of `cap`.
 *
 * That's expected and harmless *by itself* (Yjs still converges: nothing is
 * lost or duplicated). But left alone, the overshoot only gets corrected by
 * the *next* manual publish — at a quiet bench that might never happen,
 * silently doubling the archive's advertised memory footprint. Pair this
 * with `enforceClipCap`, called from a `Y.Array` observer (which also fires
 * right after a remote merge is applied), so every peer re-checks the
 * *converged* length and self-heals any overshoot immediately.
 */
export function pushClipCapped<T extends Clip>(
  doc: Y.Doc,
  yClips: Y.Array<T>,
  clip: T,
  cap: number,
): void {
  doc.transact(() => {
    if (yClips.length >= cap) {
      yClips.delete(0, yClips.length - cap + 1);
    }
    yClips.push([clip]);
  });
}

/**
 * Self-healing cap enforcement. Call this from a `Y.Array.observe` callback
 * (it fires for local pushes *and* for remote merges) so any cap overshoot
 * caused by concurrent writers on other peers gets trimmed as soon as this
 * peer observes the merged state, rather than waiting for the next publish.
 *
 * Every peer runs this against the same converged array content, so they
 * all compute the same "delete the oldest `excess` entries" operation —
 * repeat application is a safe no-op once a peer is already at/under cap.
 */
export function enforceClipCap<T extends Clip>(doc: Y.Doc, yClips: Y.Array<T>, cap: number): void {
  const excess = yClips.length - cap;
  if (excess <= 0) return;
  doc.transact(() => {
    // Re-read inside the transaction: a nested/re-entrant call (this same
    // function invoked again by the observer this transaction triggers) may
    // have already resolved the overshoot by the time this runs.
    const stillExcess = yClips.length - cap;
    if (stillExcess > 0) yClips.delete(0, stillExcess);
  });
}
