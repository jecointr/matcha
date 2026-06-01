# Note — Content-Security-Policy (CSP) à ajouter (nginx)

> Objectif : ceinture-bretelles contre le XSS. Même si un point d'injection est
> raté, une CSP stricte empêche l'exécution de scripts/handlers injectés
> (`<script>`, `onerror=…`, `javascript:`…). À poser dans `nginx/nginx.conf`,
> dans le bloc `server { … }`, à côté des autres `add_header` (lignes 14-18).
>
> **Non appliqué pour l'instant** : voir le piège « Vite dev » ci-dessous.

---

## ⚠️ Le piège : on tourne en Vite **dev**, pas en build statique

Le front est servi par le **serveur de dev Vite** (`frontend:5173`). Or Vite dev :
- injecte un **script inline** (préambule React Fast Refresh) → exige
  `script-src 'unsafe-inline'` ;
- utilise des mécanismes qui réclament souvent `'unsafe-eval'` ;
- pousse des styles inline (HMR) → `style-src 'unsafe-inline'`.

**Conséquence :** en dev, une CSP assez stricte pour **bloquer `onerror`** casse
l'app (page blanche / HMR mort). Et une CSP avec `script-src 'unsafe-inline'`
laisse passer `onerror` → elle ne protège plus de grand-chose.

➡️ **La CSP n'a de vraie valeur que sur le build de PRODUCTION** (fichiers
statiques, plus aucun script inline). C'est là qu'il faut mettre `script-src 'self'`.

---

## ⚠️ Vérifier d'abord l'origine de l'API (`connect-src`)

`frontend/src/config.js` :
```js
export const API_URL = import.meta.env.VITE_API_URL || `http://${host}:3000/api`;
export const WS_URL  = import.meta.env.VITE_WS_URL  || `http://${host}:3000`;
```

- Si `VITE_API_URL` / `VITE_WS_URL` **ne sont pas définis** → le front tape en
  **cross-origin** sur `http://<host>:3000`. Une CSP `connect-src 'self'`
  **bloquerait** toutes les requêtes API + le socket.io → app cassée.
- **Reco** : passer le front en **same-origin** via nginx (`VITE_API_URL=/api`,
  WS sur la même origine). Alors `connect-src 'self'` suffit (cf.
  `RAPPORT_AUDIT_UX.md`, section « Same-origin via nginx »).

Tant que l'API est sur `:3000`, il faut élargir `connect-src` à cette origine
(et au `ws://`), ce qui est plus fragile.

---

## CSP recommandée — PRODUCTION (build statique, API same-origin)

```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://*.tile.openstreetmap.org;
  font-src 'self' data:;
  connect-src 'self' ws: wss:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'self';
  upgrade-insecure-requests
" always;
```

Justification ligne par ligne :
- `script-src 'self'` → **bloque** `<script>` injecté, `onerror=`, `javascript:`.
  C'est LE rempart anti-XSS. (Possible uniquement en build prod.)
- `style-src 'self' 'unsafe-inline'` → Tailwind / styles inline (`style={{…}}`,
  délais d'animation, hauteur de la map). On garde `'unsafe-inline'` ici car le
  CSS inline ne permet pas d'exécuter du JS (risque faible).
- `img-src … https://*.tile.openstreetmap.org` → **tuiles Leaflet** (carte) +
  `data:` (avatars/placeholders) + `'self'` (uploads).
- `connect-src 'self' ws: wss:` → API same-origin + WebSocket socket.io / appels.
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `frame-ancestors 'self'` → durcissements classiques (anti-clickjacking,
  anti-`<base>` hijack, plugins).

> Le `frame-ancestors 'self'` recoupe le `X-Frame-Options: SAMEORIGIN` déjà
> présent — garder les deux est OK.

---

## CSP « dev-friendly » (si on veut un header même en Vite dev)

À utiliser **seulement** en dev. Elle NE bloque PAS `onerror` (à cause de
`'unsafe-inline'`), mais conserve les autres durcissements :

```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://*.tile.openstreetmap.org;
  font-src 'self' data:;
  connect-src 'self' ws: wss: http://localhost:3000 http://127.0.0.1:3000;
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'self'
" always;
```
(adapter `connect-src` à l'IP/host réel si on n'est pas en same-origin)

---

## Test après application
1. Recharger l'app, ouvrir la console → **aucune** erreur `Refused to … because it violates the … Content Security Policy`.
2. Vérifier : login, chat (socket.io), **carte** (tuiles OSM), **appel vidéo**
   (caméra/son), upload photo, emails.
3. Injecter `<img src=x onerror=alert(1)>` dans un champ et confirmer qu'en
   **prod** la CSP bloque l'exécution (console : violation `script-src`).

---

## TL;DR
- **Maintenant (Vite dev)** : on ne met PAS la CSP stricte (ça casserait l'app).
- **Au passage en build prod** : ajouter la CSP « production » ci-dessus dans
  `nginx/nginx.conf`, après avoir mis l'API en **same-origin** (`VITE_API_URL=/api`).
- Le code applicatif est déjà durci (mailer/oauth/events assainis), la CSP n'est
  que la couche de secours.
