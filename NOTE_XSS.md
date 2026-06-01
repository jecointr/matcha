# Note — Durcissement XSS (3 correctifs)

> Contexte : un rapport signalait `<img src=x onerror=alert(1)>` comme XSS.
>
> **Verdict après audit : pas de chemin d'exécution `alert(1)` réel dans le code.**
> - Aucun `dangerouslySetInnerHTML` / `innerHTML` côté front → React **échappe
>   tout** au rendu (le payload s'affiche en *texte*).
> - Server-side : noms validés par regex (rejettent `< > = "`), bio/city/country
>   passés par `xss()`, username alphanumérique.
>
> Le rapport visait probablement une version antérieure / faux positif. **Mais**
> 3 vrais trous de durcissement (entrée non assainie ou sortie HTML non échappée)
> ont été corrigés en défense en profondeur. Voir aussi [`NOTE_CSP.md`].

---

## 1. `backend/src/lib/mailer.js` — injection HTML dans les emails

**Problème :** seul endroit de l'app qui génère du **HTML brut** (pas de React).
`${username}` était interpolé tel quel :
```js
html: `... <h2>Welcome to Matcha, ${username}!</h2> ...`
```
Sûr pour un signup normal (username regex `^[a-zA-Z0-9_-]{3,50}$`), mais
atteignable via **OAuth** (cas #2) où le username contournait la regex →
stored XSS dans le client mail.

**Correctif :** helper `escapeHtml()` + échappement de `username` dans les 2 emails
(vérification + reset) :
```js
const escapeHtml = (str) =>
  String(str ?? '').replace(/[&<>"'`]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c]));
// <h2>Welcome to Matcha, ${escapeHtml(username)}!</h2>
// <p>Hi ${escapeHtml(username)},</p>
```
Principe : **échapper à la sortie HTML**, ne pas dépendre que de la validation d'entrée.

---

## 2. `backend/src/lib/oauth.js` — champs du provider non assainis

**Problème :** à la connexion Google/GitHub, `first_name` / `last_name` /
`username` venaient **directement du provider** et étaient insérés en base
**sans passer par les validateurs** (`isValidName` / `isValidUsername`). Un nom
d'affichage Google type `<img src=x onerror=…>` finissait stocké brut — et
pouvait alimenter l'email (cas #1). C'était le **vrai vecteur** qui combinait les
deux trous.

**Correctif :** assainissement à la source, même charset qu'un compte normal :
```js
const stripTags = (s, max=100) => String(s||'').replace(/[<>]/g,'').trim().slice(0,max);
const safeFirstName = stripTags(firstName) || 'User';
const safeLastName  = stripTags(lastName)  || ' ';

let finalUsername = (username || email.split('@')[0] || 'user')
  .replace(/[^a-zA-Z0-9_-]/g, '')   // même charset que l'inscription
  .substring(0, 40);
if (finalUsername.length < 3) finalUsername = 'user';
```

---

## 3. `backend/src/routes/events.js` — champs de rendez-vous non assainis

**Problème :** `location` / `description` (feature « proposer un rendez-vous »)
n'étaient validés que sur la **longueur** (`validateEvent`) et insérés **bruts** —
incohérent avec bio/messages qui passent par `xss()`.

**Correctif :** `xss()` avant l'INSERT :
```js
import xss from 'xss';
// ...
const cleanLocation    = xss(String(location).trim()).slice(0, 255);
const cleanDescription = description ? xss(String(description).trim()).slice(0, 500) : null;
// INSERT ... VALUES (..., cleanLocation, cleanDescription)
```

---

## Le fil rouge
1. **Assainir à l'entrée** (cas #2, #3) — toute donnée utilisateur nettoyée avant
   la base, quelle que soit sa provenance (formulaire **ou** OAuth).
2. **Échapper à la sortie** (cas #1) — partout où on génère du HTML hors React
   (les emails), échappement explicite.

React fournit déjà la sortie #1 « gratuite » dans l'app ; ces correctifs étendent
la même rigueur aux **angles morts** (emails, données OAuth, events).

## Statut
- Implémenté + `node --check` OK + backend relancé sans erreur.
- Couche de secours (CSP) : reportée → voir `NOTE_CSP.md`.
- Fichiers : `backend/src/lib/mailer.js`, `backend/src/lib/oauth.js`, `backend/src/routes/events.js`.
- Nom de commit proposé : `fix(security): harden XSS (escape email HTML, sanitize OAuth & event fields)`
