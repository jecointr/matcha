// Résolution centralisée des URLs API / WebSocket.
//
// Priorité :
//   1. Variable d'env explicite (VITE_API_URL / VITE_WS_URL) — utile pour les
//      builds de prod (domaine fixe, reverse proxy nginx, etc.).
//   2. Sinon, déduction depuis l'hôte utilisé par le navigateur
//      (window.location.hostname).
//
// Grâce à (2), le même build fonctionne aussi bien sur http://localhost que
// sur http://<ip-réseau> sans rebuild : l'API et le WebSocket suivent l'hôte
// par lequel la page a été ouverte.
const host = window.location.hostname;

export const API_URL = import.meta.env.VITE_API_URL || `http://${host}:3000/api`;
export const WS_URL = import.meta.env.VITE_WS_URL || `http://${host}:3000`;
