import { useEffect, useState } from "react";
import {
  loadSignalingUrl,
  loadTurnTokenUrl,
  resetIceServers,
  saveSignalingUrl,
  saveTurnTokenUrl,
} from "../sync/iceConfig";
import { appConfig } from "../../shared/config";

type Props = {
  open: boolean;
  onClose: () => void;
  benchId: string;
  onBenchChange: (next: string) => void;
};

export function SettingsDrawer({ open, onClose, benchId, onBenchChange }: Props) {
  const [signaling, setSignaling] = useState(loadSignalingUrl());
  const [tokenUrl, setTokenUrl] = useState(loadTurnTokenUrl());
  const [draftBench, setDraftBench] = useState(benchId);

  useEffect(() => {
    if (open) {
      setSignaling(loadSignalingUrl());
      setTokenUrl(loadTurnTokenUrl());
      setDraftBench(benchId);
    }
  }, [open, benchId]);

  if (!open) return null;

  const shareUrl = `${appConfig.pagesUrl}#${encodeURIComponent(benchId)}`;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <label>
          <span>Bench ID</span>
          <input
            value={draftBench}
            onChange={(e) => setDraftBench(e.target.value)}
            placeholder="park-bench-A"
          />
          <button
            type="button"
            className="settings-inline-button"
            onClick={() => onBenchChange(draftBench || "demo-bench")}
          >
            Switch to this bench
          </button>
        </label>

        <p className="settings-help">
          Encode this URL in a QR sticker and put it on a physical bench:
        </p>
        <code className="settings-code">{shareUrl}</code>

        <hr />

        <h3>Self-hosted infra (advanced)</h3>

        <label>
          <span>Signaling URL</span>
          <input
            value={signaling}
            onChange={(e) => setSignaling(e.target.value)}
            placeholder={appConfig.signalingUrl}
          />
        </label>

        <label>
          <span>TURN credentials URL</span>
          <input
            value={tokenUrl}
            onChange={(e) => setTokenUrl(e.target.value)}
            placeholder={appConfig.turnTokenUrl}
          />
        </label>

        <div className="settings-actions">
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl(signaling);
              saveTurnTokenUrl(tokenUrl);
              onClose();
              location.reload();
            }}
          >
            Save and reload
          </button>
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl("");
              saveTurnTokenUrl("");
              resetIceServers();
              onClose();
              location.reload();
            }}
          >
            Reset
          </button>
        </div>

        <hr />

        <footer className="settings-footer">
          <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
            source on github
          </a>
          <span>
            v{appConfig.version} · {appConfig.commit}
          </span>
        </footer>
      </div>
    </div>
  );
}
