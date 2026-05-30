# À creuser après la soutenance

Notes pour améliorer le projet une fois la pression de la deadline passée.
Ne rien toucher avant : l'app marche, elle est sécurisée, le temps réel socket.io
fonctionne. On ne casse pas ce qui marche pour de l'élégance.

---

## 1. Migrer vers le pattern "same-origin" (proxy Vite + nginx)

**Objectif** : faire disparaître complètement le CORS en mettant front et back sur
la même origine, en dev comme en prod.

### Dev — proxy Vite
Dans `frontend/vite.config.js`, ajouter sous `server` :
```js
server: {
  host: '0.0.0.0',
  port: 5173,
  proxy: {
    '/api':       { target: 'http://backend:3000', changeOrigin: true },
    '/socket.io': { target: 'http://backend:3000', ws: true },   // WebSocket
    '/uploads':   { target: 'http://backend:3000', changeOrigin: true },
  },
}
```
- `target` = `backend:3000` (nom du service Docker), pas `localhost`.
- `ws: true` est indispensable pour proxifier socket.io (sinon le temps réel casse).

### Front — passer aux URLs relatives
Dans `frontend/src/config.js`, remplacer la déduction par hôte :
```js
export const API_URL = import.meta.env.VITE_API_URL || '/api';
export const WS_URL  = import.meta.env.VITE_WS_URL  || '/';   // socket.io même origine
```
Vérifier la config socket.io côté client (probablement `SocketContext.jsx`) :
le client doit se connecter à l'origine courante avec `path: '/socket.io'`.

### Prod — nginx reverse-proxy
nginx sert `dist/` ET relaie `/api` + `/socket.io` vers le backend, sous le même
domaine. (Le conteneur nginx existe déjà : `nginx/Dockerfile`, `docker-compose.yml`.)
À configurer dans le `nginx.conf` : `location /api { proxy_pass http://backend:3000; }`
+ le bloc `location /socket.io` avec les headers `Upgrade`/`Connection` pour le WS.

### Points de vigilance
- **Tester le chat temps réel** après migration (c'est le plus fragile : WebSocket
  à travers le proxy). C'est une feature notée < 10s.
- Une fois same-origin partout, le middleware `cors()` et `CORS_ORIGINS` deviennent
  inutiles → on peut les retirer (ou les garder en défense, inoffensifs).
- Le multi-appareils LAN continue de marcher : le proxy relaie côté serveur.

---

## 2. À creuser : comprendre le CORS (modèle mental)

**Le CORS n'est pas un truc qu'on "active pour communiquer". C'est une restriction
du navigateur.** Par défaut le navigateur bloque les requêtes JS vers une origine
*différente* de celle de la page. Le CORS = le serveur qui dit "autorise cette origine".

Une **origine** = `scheme://host:port` depuis lequel la page a été chargée
(= la machine qui sert le front, PAS l'appareil client).

La seule question qui compte : **front et back sont-ils sur la même origine ?**

| Cas | Origines | CORS nécessaire ? |
|---|---|---|
| Notre archi actuelle (front `:5173` / back `:3000` ; prod `domaine` / `api.domaine`) | différentes | **OUI** (dev + prod) |
| Pattern proxy/reverse-proxy (point 1 ci-dessus) | identiques | NON (dev + prod) |

À approfondir plus tard :
- preflight `OPTIONS` (quand le navigateur envoie une requête de pré-vérification) ;
- `Access-Control-Allow-Credentials` + pourquoi `*` est interdit avec credentials
  (raison pour laquelle notre back reflète l'origine au lieu de renvoyer `*` en dev) ;
- différence CORS (navigateur) vs vraie sécurité réseau (le CORS n'arrête PAS
  curl/Postman — ce n'est pas un pare-feu).

Réfs : voir aussi `docs/DEV_VS_PROD.md` (section CORS) et `backend/src/index.js:35-50`.
