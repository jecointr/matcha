# 📋 Rapport UX & Audit — Matcha

> Document de référence (à re-consulter à volonté). Liste les constats UX et les
> audits de features. **La plupart des points ci-dessous ne sont PAS encore
> implémentés** — ce sont des recommandations. Le statut est indiqué par item.
>
> Légende sévérité : 🔴 important · 🟠 moyen · 🟢 confort

---

## 0. Déjà fait dans la session

- **UI 100 % anglais** ✅ (fait). Chaînes traduites :
  - `CallContext.jsx` — alerte accès caméra/micro.
  - `Profile.jsx` — confirm + erreur suppression de compte.
  - `Chat.jsx` — confirm + alertes de blocage, labels de réponse (« Vous/Répondre à » → « You/Replying to »), titres `Block this user` / `Reply`.
  - Reste uniquement des **commentaires de code** en français (dev-facing, non visibles par l'utilisateur). Non traduits pour l'instant.

---

## 1. Constats UX (recommandations)

### 1. Langue mélangée FR/EN — ✅ FAIT
L'UI mixait français et anglais. Désormais tout en anglais (voir section 0).

### 2. `alert()` / `confirm()` natifs partout — ✅ FAIT
> Système maison créé : `context/FeedbackContext.jsx` (`FeedbackProvider`, `useToast()` → success/error/info, `useConfirm()` → modale promise-based). Monté en haut de `App.jsx`.
> Tous les dialogues natifs remplacés (vérifié : 0 `alert`/`window.confirm` restant) :
> - **Toasts** : CallContext (media), Chat (block ok/échec, erreurs rdv, échec d'envoi incl. 403 unmatch), MapPage (géoloc), UserProfile (block/report).
> - **Modale de confirmation** : Chat (block), Profile (suppression compte), UserProfile (block), PhotoUpload (suppression photo).

### 3. Découvrabilité de la navigation — 🟠 À FAIRE
Likes/Matches, Visitors, Blocked ne sont accessibles que via des **boutons sur la page Browse**, pas dans la barre de nav du haut (qui n'a que Browse/Map/Chat/Notifications/Profile). Pour une app de rencontre, « qui m'a liké / mes matchs » est une **destination primaire**.
- **Reco :** remonter au moins **Likes/Matches** dans le menu principal (et éventuellement Visitors).

### 4. La bannière de rdv s'accumule — ✅ FAIT
> `loadEvents` (`Chat.jsx`) ne garde plus que le `pending` (actionnable) + les `accepted` **à venir**. Les `declined`/`cancelled`/passés sont masqués de la bannière (l'historique reste dans le fil de chat). Note : le système de rdv est un **bonus** → aucun historique requis par le sujet.

### 5. États d'appel manquants — ✅ FAIT
> Ajouté dans `CallContext` : **timeout de sonnerie** (30 s → toast « No answer » + `leaveCall`), **gestion d'erreur WebRTC** (`peer.on('error')` côté appel ET réponse → toast « Connection failed »), et message neutre **« No answer »** côté appelant (refus ET timeout = même message) / « Missed call » côté appelé. Choix de design : **on ne révèle jamais le refus explicite** (tact social, façon FaceTime/WhatsApp). teardown du peer réordonné (null avant destroy) pour éviter toute ré-entrance. (Rappel : sans TURN, l'appel échoue dès qu'il y a un NAT — cf. `COMPARATIF_TEMP_correctifs.md`.)

### 6. Hint géoloc proactif — 🟢 À FAIRE
Sur HTTP, le bouton « Use my current location » s'affiche puis retombe sur la saisie manuelle (grâce au fix #3). Mieux : afficher **d'emblée** un petit indice quand le contexte n'est pas sécurisé (`!window.isSecureContext`), pour expliquer pourquoi le GPS précis n'est pas dispo.

---

## 2. 🔍 Audit (a) — like / match / **unmatch** + accès chat

### 🔴 Bug majeur : l'unmatch ne coupe PAS le chat — ✅ CORRIGÉ (testé)
> Fix appliqué : helper `areMatched()` + re-vérification du match mutuel dans
> `GET /conversations` (filtre), `GET /:id/messages` (403) et `POST /:id/messages`
> (403). Conversation **non détruite** (re-match = accès restauré). Vérifié en runtime.
`DELETE /profiles/:id/like` (unlike) supprime juste le like + envoie la notif anonyme. Il **ne touche pas à la conversation**. Côté chat :
- `POST /:conversationId/messages` (`chat.js:291-299`) vérifie l'appartenance + le **blocage**, mais **PAS le match courant**.
- `GET /:conversationId/messages` (`chat.js:184-191`) ne vérifie que l'appartenance — pas le match.
- `GET /conversations` filtre les bloqués (`NOT EXISTS blocks`) mais **pas** les non-matchés.

**Conséquence :** après que A retire son like sur B, **la conversation persiste et les deux peuvent continuer à s'écrire**. Le sujet exige qu'on ne puisse **plus chatter** après un unmatch → **violation du sujet**.

> Le **blocage**, lui, fonctionne (il supprime les likes ET l'envoi vérifie `blocks`). C'est uniquement l'**unmatch** qui est incomplet.

**Correctif recommandé :** soit (i) supprimer la conversation au `unlike`, soit (ii) que `GET /conversations`, `GET messages` et `POST messages` re-vérifient le **match mutuel** (cohérent avec `GET /conversations/:otherUserId` qui le fait déjà). Préférence : **(ii)** — garder l'historique mais bloquer envoi/affichage tant qu'il n'y a pas de match.

---

## 3. 🔍 Audit (b) — système de notifications

### 🟠 Double insertion des notifs `message` — À FAIRE
Dans `chat.js`, l'envoi d'un message fait :
1. `sendNotification(io, ..., 'message', {...})` → qui **insère déjà** une ligne `notifications` (dans `socket.js`),
2. **puis** un `INSERT INTO notifications ... 'message'` explicite juste après.

→ **2 lignes par message.** Invisible dans la page Notifications (les `message` y sont filtrés), mais gaspillage + risque de fausser un comptage futur.
- **Reco :** supprimer l'`INSERT` explicite (garder `sendNotification` qui persiste déjà + émet en live).

### 🟢 Effet de bord positif d'Option A (rdv)
En supprimant les notifs `event_*`, il n'y a **plus de types orphelins** dans `getNotificationMessage`. Les types restants (`like/unlike/match/profile_view/message`) sont tous gérés. Le problème #3 (notifs de rdv génériques) est réellement **clos**, pas contourné.

### 🟢 À surveiller
Cohérence live-socket vs relu-BDD du `message` : ok aujourd'hui, à garder en tête si de nouveaux types de notifs sont ajoutés (toujours mettre à jour `getNotificationMessage`, `getNotificationIcon`, `getNotificationLink`).

---

## 4. 🔍 Audit (c) — chat / messagerie

### 🟠 Double émission socket d'un message — ✅ CORRIGÉ (testé socket)
> Avant : `chat:message` émis sur la room `chat:<id>` **ET** sur `user:<other>` → reçu 2× si le destinataire était dans la conv. **Et** double-comptage du badge non-lu (bumpé par `chat:message` **+** `notification`).
> Fix : **un seul** `chat:message` vers `user:<other>` (couvre les 3 cas : dans la conv / autre conv / hors chat) + **suppression des notifs `message`** (filtrées de la liste, inutiles pour le badge qui se recalcule depuis la table `messages`). Vérifié : 1 seul `chat:message` reçu, 0 notif `message`. Bug du badge (+2/message) corrigé au passage.
> Reste un code mort inoffensif : la branche `type==='message'` du handler `notification` (SocketContext) ne se déclenche plus.

### 🟠 Contrôle d'accès match — À FAIRE
L'envoi/lecture ne re-vérifie pas le match (recoupe l'audit a). À corriger en même temps que (a).

### 🟢 Ce qui est bon
Read receipts (`is_read` + socket `chat:read`), réactions, réponses/citations, indicateur de frappe, pagination `before`. La messagerie est globalement soignée.

---

## 5. Priorités recommandées

1. ✅ **(a) Unmatch coupe le chat** — FAIT (testé).
2. ✅ **UX#2 : toasts + modale de confirmation** — FAIT.
3. ✅ ~~(b) + (c) dédoublonnages~~ — notif `message` + émission socket — FAIT (+ bug badge corrigé).
4. **🟠 UX#3 nav** + ✅ ~~UX#4 bannière rdv~~ + ✅ ~~UX#5 états d'appel~~.
5. **🟢 UX#6 hint géoloc.** ✅ ~~Traduction des commentaires de code~~ — FAIT (src en anglais, markers/debug retirés).

---

## 6. À faire plus tard (reporté)

### #1 — Unlike doit empêcher les notifs de cette personne 🔴 (conformité IV.5)
Le sujet (IV.5) : retirer un like *« will prevent further notifications from that user »*.
Aujourd'hui, après que A unlike B, **B peut encore générer des notifs vers A** (B voit le
profil de A → `profile_view` ; B re-like A → `like`).
- **À faire :** à l'émission d'une notif, vérifier qu'aucun des deux n'a retiré son like
  (ou plus large : pas de notif si l'un a unliké/bloqué l'autre), comme pour le blocage.
  Point d'entrée : `sendNotification` / les appels d'émission dans `profiles.js`.

### Same-origin via nginx — supprimer CORS définitivement 🟢
Faire en sorte que front et API soient sur la **même origine** → plus de CORS du tout (dev ET prod).
- **Front** : URLs **relatives** — `VITE_API_URL=/api`, `WS_URL` = même origine (au lieu de
  `http://${host}:3000` absolu dans `config.js`). Une seule valeur marche en dev et en prod.
- **nginx** : route déjà `/api`, `/socket.io`, `/uploads`, `/` → rien à changer côté routage.
- **Backend** : le middleware CORS devient inutile (le laisser inoffensif ou le retirer).
- **Accès dev** : via nginx `:8080` ; pour garder Vite direct `:5173`, ajouter un `server.proxy`
  dans `vite.config.js` (`/api` et `/socket.io` → backend).
- **Point fragile à tester** : les WebSockets (chat / appels / HMR Vite) à travers nginx.
- Ce qui diffère dev/prod = seulement l'infra (Vite vs build statique, HTTP vs HTTPS), pas le code.

## Annexe — documents liés
- `COMPARATIF_TEMP_correctifs.md` — qualité « prod » des correctifs déjà faits (#1→#15) : ce qui tiendrait en prod vs à refaire (GeoLite2, coturn, colonne `is_seed`, etc.).
