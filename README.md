# Matcha

Application de rencontre : profils, suggestions géolocalisées, likes mutuels, chat en temps réel. Un match débloque la conversation — et, au-delà du sujet, les appels audio/vidéo et les propositions de rendez-vous.

Projet [42](https://www.42.fr) (Matcha). Usage éducatif uniquement.

## Fonctionnalités

- Compte local (email, username, nom, mot de passe) ou OAuth **Google** et **GitHub**
- Vérification d’email et réinitialisation de mot de passe
- Profil : genre, préférences, bio, tags, jusqu’à 5 photos, localisation GPS ou manuelle
- Suggestions selon préférences, distance, tags en commun et fame rating
- Recherche avancée, filtres (âge, distance, fame, tags) et tris
- Carte Leaflet des profils à proximité
- Like / unlike, match mutuel, visites, blocage, signalement
- Chat temps réel (Socket.io) : messages, réponses, édition, réactions, typing, badges
- Appels audio et vidéo WebRTC entre personnes matchées
- Notifications live (like, visite, match, message, unlike)
- Propositions de rendez-vous (date, lieu, acceptation / refus)
- Thème clair / sombre, interface responsive (Chrome et Firefox)

## Stack

| Couche | Choix |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS 4, Leaflet, Socket.io-client, simple-peer |
| Backend | Node.js, Express 5, PostgreSQL 18, Socket.io |
| Auth | JWT (`Authorization: Bearer`), bcryptjs (12 rounds) |
| Mail (dev) | MailDev |
| Infra | Docker Compose, Nginx (reverse proxy) |

Contraintes du sujet 42 : SQL à la main (`pg`, requêtes paramétrées), validateurs maison (`backend/src/utils/validators.js`), pas d’ORM ni de librairie de validation.

## Architecture

```
Navigateur (Vite :5173  ou  Nginx :8080)
        │  JWT Bearer
        ▼
API Express + Socket.io (:3000)
        │
        ├── PostgreSQL (:5432)     comptes, photos, likes, chat, events
        ├── MailDev (:1025 / :1080)
        ├── Google / GitHub        OAuth (optionnel)
        └── Disque local           ./backend/uploads  (photos)
```

Docker lance **toute** la stack : Postgres, API, frontend Vite, Nginx et MailDev.

En dev, le navigateur parle à l’API sur `:3000`. Derrière Nginx, `/api`, `/socket.io` et `/uploads` sont same-origin. Un like mutuel crée la conversation ; un unlike la coupe et mute les notifications suivantes de cette personne. Le fame rating (0–100) est recalculé à partir des likes, visites, matchs et signalements.

## Prérequis

- Docker et Compose
- Git
- Applications OAuth Google et GitHub — optionnelles ; sans elles, seul le compte local fonctionne

Node.js 22+ n’est nécessaire que pour lancer l’API ou le front **hors** Docker.

## Démarrage

```bash
git clone <url-du-repo>
cd matcha
cp .env.example .env
```

Remplis `.env` : `DB_PASSWORD` et `JWT_SECRET` (≥ 64 caractères). Les identifiants OAuth peuvent rester vides au début.

```bash
docker compose up --build
```

Une fois les services prêts, seed des profils de démo :

```bash
docker exec -it matcha_backend npm run seed
docker exec -it matcha_backend npm run seed:photos
```

| Service | URL |
| --- | --- |
| Frontend (Vite) | [http://localhost:5173](http://localhost:5173) |
| API | [http://localhost:3000](http://localhost:3000) |
| Nginx | [http://localhost:8080](http://localhost:8080) |
| MailDev | [http://localhost:1080](http://localhost:1080) |

Le seed crée **520** profils (France, moitié autour de Paris). Mot de passe commun :

| | |
| --- | --- |
| Username | `firstname_lastname_<index>` (ex. `sarah_martin_42`) |
| Mot de passe | `Password123!` |

Les mails de vérif / reset apparaissent dans MailDev : [http://localhost:1080](http://localhost:1080).

Callbacks OAuth locaux (à déclarer côté provider) :

```
http://localhost:3000/api/auth/google/callback
http://localhost:3000/api/auth/github/callback
```

## Configuration

Les variables vivent dans `.env` à la racine (pas de fichiers séparés front / back).

| Variable | Rôle |
| --- | --- |
| `DB_*` | Postgres — port hôte **5432** |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Sessions (défaut 7 jours) |
| `MAIL_*` / `MAIL_FROM` | Mail (MailDev en local) |
| `FRONTEND_URL` | Liens des emails, redirects OAuth |
| `BACKEND_URL` | Callbacks OAuth |
| `CORS_ORIGINS` | Origines autorisées en production |
| `GOOGLE_*` / `GITHUB_*` | OAuth navigateur |
| `VITE_API_URL` / `VITE_WS_URL` | Vides en dev (déduits de l’hôte) ; figés au build en prod |
| `RATE_LIMIT_*` | 3000 req / 15 min (prod) ; login 10 essais / heure (toujours actif) |

En production : `NODE_ENV=production`, SMTP réel, secrets uniques, `CORS_ORIGINS` strict, et URLs Vite pointant vers le reverse proxy. Nginx sert alors le front et proxifie l’API.

## API

JWT dans `Authorization: Bearer` (stocké côté SPA). Le middleware JWT est global hors des routes publiques d’auth. Une route inconnue répond **404**. Rate limit login : 10 essais / heure par couple IP + username.

**Auth**

| | |
| --- | --- |
| `POST /api/auth/register` | Inscription |
| `POST /api/auth/login` | Login |
| `POST /api/auth/logout` | Logout |
| `GET /api/auth/verify-email` · `POST /api/auth/resend-verification` | Email |
| `POST /api/auth/forgot-password` · `POST /api/auth/reset-password` | Mot de passe |
| `GET /api/auth/me` | Compte courant |
| `GET /api/auth/{google,github}` · `…/callback` | OAuth |
| `GET /api/health` | Santé API + Postgres |

**Ressources**

| | |
| --- | --- |
| `PUT /api/users/profile` · `PUT /api/users/location` | Profil, GPS |
| `POST /api/users/photos` · `DELETE /api/users/photos/:id` · `PUT …/profile` | Photos (jpeg/png/webp, 5 Mo, 5 max, EXIF retiré) |
| `GET/PUT /api/users/tags` | Intérêts |
| `GET /api/users/blocked` · `POST/DELETE /api/users/:id/block` · `DELETE /api/users/me` | Blocage, suppression |
| `GET /api/profiles/browse` · `GET /api/profiles/search` · `GET /api/profiles/map` | Catalogue |
| `GET /api/profiles/:id` · `POST/DELETE /api/profiles/:id/like` · `POST …/report` | Fiche, like, signalement |
| `GET /api/matches` · `…/likes` · `…/visits` · `…/my-likes` | Matchs, likes, visites |
| `GET /api/chat/conversations` · `GET/POST /api/chat/:id/messages` | Chat |
| `PUT /api/chat/messages/:id` · `POST /api/chat/messages/:id/react` | Édition, réactions |
| `GET /api/notifications` · `PUT …/read` · `PUT …/read-all` | Notifications |
| `POST /api/events` · `GET /api/events/:targetId` · `PUT /api/events/:id/status` | Rendez-vous |

Mot de passe local : 8–128 caractères, majuscule, minuscule, chiffre, caractère spécial, aucun mot de dictionnaire (listes EN/FR) en séquence de lettres.

## Structure

```
matcha/
├── backend/                 API Express
│   ├── seeds/               520 profils + photos
│   └── src/
│       ├── config/          Postgres, Socket.io
│       ├── routes/          auth, users, profiles, matches, chat, notifications, events
│       ├── controllers/
│       ├── middlewares/     JWT, upload, images
│       ├── lib/             JWT, OAuth, bcrypt, mailer
│       └── utils/           validateurs
├── frontend/                SPA React
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── context/         Auth, Socket, Call
│       └── services/        axios + JWT
├── database/                init.sql (schéma + tags)
├── nginx/                   reverse proxy
├── docker-compose.yml       Postgres 5432, API 3000, Vite 5173, Nginx 8080, MailDev 1080
└── .env.example
```

## Scripts

| Commande | Effet |
| --- | --- |
| `docker compose up --build` | Stack complète |
| `docker compose down` | Arrêt |
| `docker exec -it matcha_backend npm run seed` | 520 profils |
| `docker exec -it matcha_backend npm run seed:photos` | Avatars |
| `docker exec -it matcha_backend npm run seed:all` | Les deux |
| `docker exec -it matcha_backend npm run security:check` | Contrôles de sécu |
| `docker exec -it matcha_db psql -U matcha_user -d matcha_db` | CLI Postgres |
| `cd backend && npm run dev` | API hors Docker |
| `cd frontend && npm run dev` | Vite hors Docker |
| `cd frontend && npm run build` | Build front |

Hors Docker, pointer `DB_HOST=localhost` et lancer Postgres (ou le seul service `db` du compose).

## Licence

Projet pédagogique 42.
