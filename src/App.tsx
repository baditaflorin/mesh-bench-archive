import { useEffect, useState } from "react";
import { InviteShareButton, MeshBeacon } from "@baditaflorin/mesh-common";
import { Bench } from "./features/bench/Bench";
import { SettingsDrawer } from "./features/settings/SettingsDrawer";
import { appConfig } from "./shared/config";

function readBenchId(): string {
  const hash = window.location.hash.replace(/^#/, "").trim();
  if (hash) return hash;
  return localStorage.getItem(`${appConfig.storagePrefix}:lastBench`) ?? "demo-bench";
}

export function App() {
  const [benchId, setBenchId] = useState(() => readBenchId());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(`${appConfig.storagePrefix}:lastBench`, benchId);
  }, [benchId]);

  useEffect(() => {
    const onHash = () => setBenchId(readBenchId());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="app-root">
      <Bench benchId={benchId} />

      <InviteShareButton appName={appConfig.appName} roomId={benchId} />
      <MeshBeacon app={appConfig.appName} room={benchId} />

      <button
        type="button"
        className="settings-fab"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
      >
        ⚙
      </button>

      <div className="self-ref">
        <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
          source
        </a>
        <span aria-hidden="true">·</span>
        <a href={appConfig.paypalUrl} target="_blank" rel="noreferrer">
          tip ♥
        </a>
        <span aria-hidden="true">·</span>
        <span>
          v{appConfig.version} · {appConfig.commit}
        </span>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        benchId={benchId}
        onBenchChange={(next) => {
          window.location.hash = next;
          setBenchId(next);
        }}
      />
    </div>
  );
}
