import { useEffect, useState } from "react";
import { MeshShell } from "@baditaflorin/mesh-common";
import { Bench } from "./features/bench/Bench";
import { SettingsExtras } from "./features/settings/SettingsExtras";
import { appConfig } from "./shared/config";

function readBenchId(): string {
  const hash = window.location.hash.replace(/^#/, "").trim();
  if (hash) return hash;
  return localStorage.getItem(`${appConfig.storagePrefix}:lastBench`) ?? "demo-bench";
}

export function App() {
  const [benchId, setBenchId] = useState(() => readBenchId());

  useEffect(() => {
    localStorage.setItem(`${appConfig.storagePrefix}:lastBench`, benchId);
  }, [benchId]);

  useEffect(() => {
    const onHash = () => setBenchId(readBenchId());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const handleBenchChange = (next: string) => {
    const safe = next || "demo-bench";
    window.location.hash = safe;
    setBenchId(safe);
  };

  return (
    <MeshShell
      config={appConfig}
      roomId={benchId}
      onRoomChange={handleBenchChange}
      settingsExtras={<SettingsExtras benchId={benchId} />}
    >
      <Bench benchId={benchId} />
    </MeshShell>
  );
}
