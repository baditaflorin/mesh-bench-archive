import { useEffect, useMemo, useRef, useState } from "react";
import { createRoomSync } from "../sync/yjsRoom";
import { maybeFetchTurnCredentials } from "../sync/iceConfig";
import { enforceClipCap, pushClipCapped, type Clip } from "./clipCap";

const MAX_CLIP_MS = 30_000;
const MAX_CLIPS = 30;

type Props = {
  benchId: string;
};

export function Bench({ benchId }: Props) {
  const [armed, setArmed] = useState(false);
  const [clips, setClips] = useState<Clip[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const [peers, setPeers] = useState(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordStartRef = useRef(0);
  const recordTimerRef = useRef<number | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const mesh = useMemo(() => {
    if (!armed) return null;
    const room = createRoomSync(benchId);
    const yClips = room.doc.getArray<Clip>("clips");
    return { room, yClips };
  }, [armed, benchId]);

  // Push a finished clip into the shared Yjs array, enforcing the FIFO cap.
  // Both the real MediaRecorder path and the headless test hook funnel through
  // here so they exercise the identical cross-peer shared-state mutation.
  //
  // See clipCap.ts for why this alone isn't sufficient under concurrent
  // writers — the yClips.observe(refresh) effect below also calls
  // enforceClipCap so overshoot from simultaneous publishes on other peers
  // self-heals as soon as the merge is observed, not just on the next publish.
  const publishClip = (clip: Clip) => {
    if (!mesh) return;
    pushClipCapped(mesh.room.doc, mesh.yClips, clip, MAX_CLIPS);
  };

  // Headless / desktop fallback: drive the advertised "leave a voice note"
  // action without real microphone hardware. The cross-peer e2e test calls
  // this so the assertion exercises the same Yjs propagation a real recording
  // would — a real device still uses the MediaRecorder path below.
  useEffect(() => {
    if (!mesh) return undefined;
    const hook = (payload?: { mime?: string; data?: string }) => {
      const clip: Clip = {
        id: crypto.randomUUID(),
        ts: Date.now(),
        mime: payload?.mime ?? "audio/webm",
        data: payload?.data ?? "",
      };
      publishClip(clip);
      return clip.id;
    };
    (window as unknown as { __benchPublishClip?: typeof hook }).__benchPublishClip = hook;
    return () => {
      delete (window as unknown as { __benchPublishClip?: typeof hook }).__benchPublishClip;
    };
  }, [mesh]);

  useEffect(() => {
    if (!armed) return;
    void maybeFetchTurnCredentials();
  }, [armed]);

  useEffect(() => {
    return () => {
      mesh?.room.provider?.destroy();
    };
  }, [mesh]);

  useEffect(() => {
    if (!mesh) return undefined;
    const refresh = () => {
      // Self-heal: this fires for local pushes AND remote merges, so any
      // cap overshoot from concurrent publishers on other peers gets
      // trimmed as soon as this peer observes the converged state.
      enforceClipCap(mesh.room.doc, mesh.yClips, MAX_CLIPS);
      const arr = mesh.yClips
        .toArray()
        .slice()
        .sort((a, b) => b.ts - a.ts);
      setClips(arr);
    };
    mesh.yClips.observe(refresh);
    refresh();
    const presence = setInterval(() => {
      const p = (
        mesh.room.provider as unknown as {
          awareness?: { getStates: () => Map<unknown, unknown> };
        } | null
      )?.awareness;
      if (p) setPeers(Math.max(0, p.getStates().size - 1));
    }, 1000);
    return () => {
      mesh.yClips.unobserve(refresh);
      clearInterval(presence);
    };
  }, [mesh]);

  const startRecord = async () => {
    if (!mesh) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      let mime = "";
      for (const m of mimeCandidates) {
        if (MediaRecorder.isTypeSupported(m)) {
          mime = m;
          break;
        }
      }
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recordChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(recordChunksRef.current, { type: rec.mimeType });
        stream.getTracks().forEach((t) => t.stop());
        const data = await blobToBase64(blob);
        const clip: Clip = {
          id: crypto.randomUUID(),
          ts: Date.now(),
          mime: rec.mimeType,
          data,
        };
        publishClip(clip);
      };
      rec.start();
      mediaRecorderRef.current = rec;
      setRecording(true);
      recordStartRef.current = Date.now();
      setRecordMs(0);
      recordTimerRef.current = window.setInterval(() => {
        const ms = Date.now() - recordStartRef.current;
        setRecordMs(ms);
        if (ms >= MAX_CLIP_MS) stopRecord();
      }, 100);
    } catch (err) {
      alert(`Microphone access failed: ${err}`);
    }
  };

  const stopRecord = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    if (recordTimerRef.current !== null) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecording(false);
  };

  const playClip = (clip: Clip) => {
    if (playing === clip.id) {
      audioElRef.current?.pause();
      setPlaying(null);
      return;
    }
    const audio = audioElRef.current ?? new Audio();
    audioElRef.current = audio;
    audio.src = `data:${clip.mime};base64,${clip.data}`;
    audio.onended = () => setPlaying(null);
    void audio.play();
    setPlaying(clip.id);
  };

  if (!armed) {
    return (
      <div className="bench-arm">
        <h1>mesh-bench-archive</h1>
        <p>
          Bench: <strong>{benchId}</strong>
        </p>
        <p>
          Leave a 30-second voice note for the next person who scans this sticker. Hear what recent
          visitors left. The audio lives only in browsers that have scanned — when everyone leaves,
          it's gone.
        </p>
        <button type="button" className="bench-arm-button" onClick={() => setArmed(true)}>
          Open this bench's archive
        </button>
      </div>
    );
  }

  return (
    <div className="bench-stage">
      <div className="bench-hud">
        <strong>{benchId}</strong> · {clips.length} clip{clips.length === 1 ? "" : "s"} ·{" "}
        {peers + 1} listening
      </div>

      <div className="bench-clips" data-testid="bench-clips" data-clip-count={clips.length}>
        {clips.length === 0 && (
          <p className="bench-empty">No clips yet. Be the first to leave a note.</p>
        )}
        {clips.map((c) => (
          <button
            key={c.id}
            type="button"
            data-testid="bench-clip"
            data-clip-id={c.id}
            className={`bench-clip ${playing === c.id ? "playing" : ""}`}
            onClick={() => playClip(c)}
          >
            <span className="bench-clip-icon">{playing === c.id ? "⏸" : "▶"}</span>
            <span className="bench-clip-meta">
              {timeAgo(c.ts)} · {Math.round((c.data.length * 0.75) / 1024)} KB
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`bench-record ${recording ? "recording" : ""}`}
        onClick={recording ? stopRecord : startRecord}
      >
        {recording ? `Stop (${(recordMs / 1000).toFixed(1)} s)` : "Record 30 s"}
      </button>
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)} s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} h ago`;
  return `${Math.floor(diff / 86400_000)} d ago`;
}
