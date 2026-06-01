// Centralized resolution of the API / WebSocket URLs.
//
// Priority:
//   1. Explicit env var (VITE_API_URL / VITE_WS_URL) — useful for prod builds
//      (fixed domain, nginx reverse proxy, etc.).
//   2. Otherwise, derive from the host the browser is using
//      (window.location.hostname).
//
// Thanks to (2), the same build works on http://localhost and on
// http://<network-ip> without a rebuild: the API and WebSocket follow the host
// the page was opened from.
const host = window.location.hostname;

export const API_URL = import.meta.env.VITE_API_URL || `http://${host}:3000/api`;
export const WS_URL = import.meta.env.VITE_WS_URL || `http://${host}:3000`;
