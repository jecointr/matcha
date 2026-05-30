# Audit de conformité au sujet Matcha (v6.1)

> Audit **au niveau du code** (pas à l'exécution). Le mandatory doit être *parfait
> et sans bug* pour que les bonus soient évalués → tester le parcours complet avant rendu.

## Dev vs Prod ne change pas la conformité

Les fonctionnalités sont identiques dans les deux modes (même code). Ce qui diffère
(CORS, rate-limit, verbosité des erreurs) ne touche aucune exigence du sujet :
- pas de rate-limit demandé par le sujet ;
- CORS ouvert en dev ≠ faille au sens du sujet ;
- en dev on renvoie `err.message` mais pas de stack trace → conforme.

Les exigences de sécurité (hash, anti-SQLi, anti-XSS, validation, uploads) sont
au niveau du code → respectées dans les deux modes. La soutenance se lance en dev.

## Partie obligatoire

| Exigence | Statut | Preuve |
|---|---|---|
| Register (email, username, nom, prénom, mdp protégé) | OK | `auth.js:29`, bcrypt |
| Mail de vérification, lien unique | OK | `verification_token` + `sendVerificationEmail` |
| Login + reset password par mail | OK | `auth.js:112,294,334` |
| Logout 1 clic depuis toute page | OK | `authAPI.logout` + layout |
| Profil : genre, orientation, bio, tags réutilisables, <=5 photos dont 1 principale | OK | `users.js:22,212` |
| Modifier infos + nom/prénom/email | OK | `users.js:74-108` |
| Voir qui a visité / qui a liké | OK | `matches.js:121` / `:67` |
| Fame rating public | OK | `profiles.js:735` |
| GPS quartier + consentement + saisie manuelle | OK | `location_consent`, `users.js:150` |
| Browse : orientation (bi par défaut) | OK | `profiles.js:48-61`, DB `DEFAULT 'both'` |
| Matching proximité + tags + fame | OK | `profiles.js:137-141` |
| Tri + filtres (âge, lieu, fame, tags) | OK | browse + search |
| Recherche avancée multi-critères | OK | `profiles.js:221` |
| Vue profil (tout sauf email/mdp) + enregistre visite | OK | `profiles.js:458,516` |
| Like (mutuel=connecté=chat) ; pas de photo -> pas de like | OK | `profiles.js:557,572` |
| Unlike désactive le chat | OK | `chat.js:109-117` |
| En ligne / dernière connexion | OK | `is_online`, `last_seen`, socket |
| Report fake + block | OK | `controllers/users.js:45` |
| Chat temps réel + notif message partout | OK | socket.io, `SocketContext` |
| Notifs temps réel (like, vue, message, like retour, unlike) | OK | `socket.js:168` |
| BDD relationnelle, requêtes manuelles | OK | SQL paramétré |
| >=500 profils | ATTENTION | `TOTAL_USERS = 500` (pile au minimum) |
| Header/main/footer, mobile-friendly | OK | `App.jsx` |
| Sécurité (mdp hash, anti-SQLi, anti-XSS, uploads) | OK | bcrypt, requêtes paramétrées, `xss()`, multer+sharp+ALLOWED_TYPES |
| `.env` exclu de Git | OK | non suivi + dans `.gitignore` |

## Bonus présents (5/5)
- OAuth Google + GitHub (`auth.js:435`)
- Galerie photo drag-drop + édition (`PhotoUpload.jsx`)
- Carte interactive GPS JS (`MapPage.jsx`, `/profiles/map`)
- Chat vidéo/audio WebRTC (`socket.js:99`, `VideoCallModal.jsx`)
- Organisation de dates/événements (table `events`, `EventModal.jsx`)

## Points à surveiller

1. **500 profils pile au minimum.** Le seed s'arrête à 500 et tolère <5 erreurs
   d'insertion -> risque de finir à 495. Passer `TOTAL_USERS = 520` dans
   `backend/seeds/generate-profiles.js`.
2. **« Mots du dictionnaire, toutes langues, refusés ».** Le validateur ne bloque
   qu'une liste de ~100 mdp courants (`validators.js`), pas un vrai dictionnaire.
   Sauvé par les règles de complexité (maj+min+chiffre+spécial). Risque faible,
   à savoir expliquer en défense.
3. **Audit code-level.** Tester le parcours complet (register -> mail -> login ->
   profil -> browse -> like -> match -> chat -> notif -> vidéo -> event) avant rendu,
   car le mandatory doit être sans bug pour que les bonus comptent.
