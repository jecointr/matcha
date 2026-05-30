# Dev vs Prod — différences concrètes

Tout est piloté par une seule variable : `NODE_ENV` (+ le bloc PRODUCTION du `.env`).

## 1. URLs API / WebSocket (frontend) — `frontend/src/config.js`

- **Dev** : `VITE_API_URL` / `VITE_WS_URL` **vides**. Le front déduit l'URL depuis
  l'hôte du navigateur (`window.location.hostname`). → marche sur `localhost` **ou**
  sur `192.168.x.x` sans rebuild.
- **Prod** : URLs fixes (`https://api.tondomaine.com`…), figées dans le build, qui
  passent par le reverse proxy nginx.

## 2. CORS (backend) — `backend/src/index.js:35-50`

- **Dev** : reflète **n'importe quelle origine** (`callback(null, true)`). Connexion
  depuis n'importe quelle IP/wifi sans rien changer.
- **Prod** : **liste blanche stricte** via `CORS_ORIGINS` (ou `FRONTEND_URL`). Toute
  origine non listée → `Not allowed by CORS`.

## 3. Rate limiting — `backend/src/index.js:78`

- **Dev** : limiter global **désactivé** (`skip: NODE_ENV === 'development'`).
- **Prod** : 3000 req / 15 min.
- ⚠️ Le `authLimiter` sur `/auth/login` (10 essais/h) s'applique **toujours**, même en dev.

## 4. Messages d'erreur — `backend/src/index.js:127`

- **Dev** : erreur réelle renvoyée au client (`err.message`).
- **Prod** : message générique `Internal server error` (pas de fuite d'infos internes).

## 5. Mail — `.env`

- **Dev** : `maildev` (faux SMTP, interface web sur `:1080`, rien ne part vraiment).
- **Prod** : vrai SMTP (`smtp.tonprovider.com:587` + identifiants).

## 6. Secrets — `.env`

- **Dev** : valeurs par défaut (`change_this_to_...`, mdp DB factice).
- **Prod** : `JWT_SECRET` aléatoire 64+ caractères, vrai mdp DB. À **ne pas** committer.

## 7. Serving du frontend (Docker)

- **Dev** : conteneur `frontend` = serveur Vite (`:5173`) avec hot-reload
  (`usePolling: true`, volumes montés sur `./src`).
- **Prod** : `nginx` (`:80`) sert le build statique (`dist/`) + reverse proxy vers le backend.

---

## Bascule en prod

Mettre `NODE_ENV=production` + décommenter le bloc PRODUCTION du `.env`
(secrets, SMTP, URLs, `CORS_ORIGINS`, `VITE_API_URL/WS_URL`). Le code s'adapte seul :
CORS strict, rate limit actif, erreurs masquées, nginx sert le front buildé.

---

## Qui peut se connecter via l'URL "network" ?

Le backend écoute sur `0.0.0.0:3000` et Vite sur `0.0.0.0:5173` (bind toutes interfaces),
ports exposés par Docker. Conséquence :

- **N'importe quel appareil sur le MÊME réseau local (LAN)** peut ouvrir l'URL et se
  connecter. Il n'y a **aucun filtrage par IP** côté app.
- **Internet (extérieur)** : NON, sauf si le routeur fait du port-forwarding vers ta
  machine, ou si la machine a une IP publique directe. Derrière une box/NAT classique,
  tu es protégé par le routeur, pas par l'app.

Le CORS "accept any" en dev ne change rien à ça : CORS ne vérifie que l'en-tête `Origin`
(posé par le navigateur) et ne bloque pas un client non-navigateur (curl, Postman…).
Ce n'est **pas** une frontière de sécurité réseau.

## Faut-il n'accepter que le LAN privé en dev ?

Intérêt **marginal** :
- CORS est la mauvaise couche pour ça (en-tête falsifiable, n'arrête pas curl/Postman).
- La vraie exposition vient du bind `0.0.0.0` + port-forwarding. En dev derrière un NAT,
  tu n'es de toute façon pas joignable depuis Internet.
- Restreindre apporte surtout de la friction (re-tester depuis le tel, etc.).

Si on veut quand même durcir, la bonne couche n'est pas CORS mais soit :
- binder sur `127.0.0.1` quand on n'a pas besoin du réseau (mais ça casse le test multi-appareils),
- filtrer les plages privées (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) au niveau
  d'un middleware/pare-feu si on veut être joignable en LAN mais jamais depuis une IP publique.

**Conclusion** : en dev, ce n'est pas nécessaire ni vraiment utile. Le risque réel est
géré par le NAT du routeur. Garder l'ouverture facilite le dev multi-appareils.
