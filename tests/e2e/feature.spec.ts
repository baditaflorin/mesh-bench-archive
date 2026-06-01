import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

/**
 * Load-bearing cross-peer assertion for the advertised core action:
 * "Leave a 30-second voice note for the next visitor; hear what recent
 * visitors left." Concretely: a clip recorded on peer A must show up in the
 * shared Y.Array<Clip> "clips" and render on peer B — and a clip left by B
 * must in turn render on A, proving the archive is genuinely two-way.
 *
 * Real audio capture (getUserMedia + MediaRecorder) cannot run headless, so
 * we drive the SAME Yjs publication path the recorder uses via the
 * `window.__benchPublishClip` test hook. That hook funnels through
 * `publishClip`, identical to the MediaRecorder `onstop` handler — so this
 * asserts the genuine cross-mesh propagation, not a stub.
 */
test("clips left on either peer appear on both", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // Both peers open the bench archive (arms the Yjs room on each side).
    await a.getByRole("button", { name: /open this bench/i }).click();
    await b.getByRole("button", { name: /open this bench/i }).click();

    // Peer B starts with no clips.
    await expect(b.getByText(/be the first to leave a note/i)).toBeVisible();

    // Peer A leaves a voice note (drives the real publishClip path).
    const clipId = await a.evaluate(() => {
      const hook = (window as unknown as { __benchPublishClip?: (p?: unknown) => string })
        .__benchPublishClip;
      if (!hook) throw new Error("bench publish hook not mounted");
      return hook({ mime: "audio/webm", data: "QUFB" });
    });
    expect(clipId).toBeTruthy();

    // Peer B must now see the new clip — proves the Y.Array crossed the mesh.
    await expect(b.locator(`[data-clip-id="${clipId}"]`)).toBeVisible();
    await expect(b.locator('[data-testid="bench-clips"]')).toHaveAttribute("data-clip-count", "1");
    // And peer A obviously sees its own clip too.
    await expect(a.locator(`[data-clip-id="${clipId}"]`)).toBeVisible();

    // Symmetric direction: a later visitor (peer B) leaves their own note, and
    // the earlier visitor (peer A) hears it. This proves the archive is genuinely
    // two-way — every phone both contributes to and reads the same shared Y.Array
    // — not a one-direction broadcast.
    const clipId2 = await b.evaluate(() => {
      const hook = (window as unknown as { __benchPublishClip?: (p?: unknown) => string })
        .__benchPublishClip;
      if (!hook) throw new Error("bench publish hook not mounted");
      return hook({ mime: "audio/webm", data: "QkJC" });
    });
    expect(clipId2).toBeTruthy();
    expect(clipId2).not.toBe(clipId);

    // Both clips are now present on both peers, and both report a count of 2.
    await expect(a.locator(`[data-clip-id="${clipId2}"]`)).toBeVisible();
    await expect(a.locator('[data-testid="bench-clips"]')).toHaveAttribute("data-clip-count", "2");
    await expect(b.locator('[data-testid="bench-clips"]')).toHaveAttribute("data-clip-count", "2");
  } finally {
    await cleanup();
  }
});
