export const appConfig = {
  appName: "mesh-bench-archive",
  storagePrefix: "mesh-bench-archive",
  description:
    "Peer-to-peer mesh: voice notes tied to a place. Scan a QR sticker on a bench, hear the last visitors. Audio lives only in browsers that have scanned.",
  accentHex: "#d8b85a",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
  repositoryUrl: "https://github.com/baditaflorin/mesh-bench-archive",
  pagesUrl: "https://baditaflorin.github.io/mesh-bench-archive/",
  signalingUrl:
    (import.meta.env.VITE_WEBRTC_SIGNALING as string | undefined) ?? "wss://turn.0docker.com/ws",
  turnTokenUrl:
    (import.meta.env.VITE_TURN_TOKEN_URL as string | undefined) ??
    "https://turn.0docker.com/credentials",
  paypalUrl: "https://www.paypal.com/paypalme/florinbadita",
} as const;
