# Comparatif correctifs — « projet école » vs « vraie app prod »

> Fichier **temporaire** (à supprimer quand tu veux). Généré pendant la session de fixes.
> Question de départ : nos correctifs sont-ils une *bonne base* si on voulait en faire une vraie app plus tard ?

---

## 1. Résultats de test (vérifiés au runtime, stack Docker)

App testée via nginx `:8080` et backend direct `:3000` (après libération du port).

| Test | Résultat | Statut |
|------|----------|--------|
| Backend boote avec tous les edits | `Database connected / Server running`, aucune erreur | ✅ |
| #13 lock par compte | `alice` #11 → 429 ; `bob` même IP → 401 (pas bloqué) | ✅ |
| #13 config saine | aucun warning `ERR_ERL`/trust-proxy ; 429 = message JSON custom | ✅ |
| #1 scoping seed | sur 2 comptes sans photo, la requête ne renvoie que le `@example.com` | ✅ |
| #3 endpoint sans token | 401 | ✅ |
| #3 endpoint avec token, IP privée | 422 « Cannot geolocate a local/private IP » | ✅ |
| Flow auth (register→verify→login→JWT) | 201 / token 223c / appels authentifiés OK | ✅ |

**Non testés au runtime** (besoin de 2 users + sockets + médias, revue de code seule) :
#4/5/7/11/12 (appels), #9 (dedup vue), #10 (anonymat unlike), #2 (complétion), #3 chemin succès géoloc réelle.

---

## 2. Jugement par correctif : un dev pro ferait-il pareil ?

### #13 — rate-limit (trust proxy + clé IP+username) → ✅ DÉJÀ NIVEAU PROD
Rien à refaire. C'est la bonne façon derrière un reverse proxy.
*Durcissement possible plus tard :* ajouter un plafond global par IP (défense en profondeur contre l'énumération de comptes), lockout progressif / CAPTCHA après N échecs, store partagé (Redis) si plusieurs instances backend.

### #3 — géoloc IP via `ip-api.com` → ❌ À REFAIRE
- **Problèmes :** dépendance externe non versionnée, sans clé, rate-limitée (45/min), HTTP only, sans cache, sans circuit-breaker, appel synchrone dans le handler.
- **Version prod :** **MaxMind GeoLite2** (fichier `.mmdb` local, lib `@maxmind/geoip2-node`) → zéro appel réseau, pas de rate-limit, pas de partage de données tiers (RGPD), MAJ mensuelle. Ou provider payant (ipinfo) + cache Redis (clé = IP) + circuit-breaker (opossum) + timeout court.
- **Important :** le **GPS navigateur en HTTPS** doit rester la source PRIMAIRE ; l'IP n'est qu'un fallback grossier.
- *Notre code = échafaudage acceptable, à remplacer avant prod.*

### #4/5/7/11/12 — appels WebRTC → ✅ LOGIQUE OK / ⚠️ INFRA À COMPLÉTER
- Nos corrections de logique sont justes et réutilisables.
- **Manque pour du réel :** serveur **STUN/TURN (coturn)** — sans TURN, ~10-20 % des appels échouent (NAT symétrique, mobile, firewall). + timeout de sonnerie, état « occupé/refusé », reconnexion, gestion multi-appareils.
- **Alternative pro :** externaliser vers **LiveKit / Twilio Video** (SFU managé) pour ne pas maintenir le signaling/TURN soi-même.
- *Base 1:1 légitime ; ajouter coturn + cycle de vie d'appel avant prod.*

### #1 — scoping seed par `@example.com` → ❌ À REFAIRE
- **Problème :** match sur l'email = heuristique fragile (un vrai user pourrait utiliser ce domaine). Un script de seed ne devrait JAMAIS pouvoir toucher de vrais comptes.
- **Version prod :** colonne explicite **`is_seed BOOLEAN DEFAULT false`** posée par le seeder, + **séparation d'environnements** (les seeds ne tournent que sur dev/test). Distinction migrations (schéma) vs seeds (données de test).

### #9 — debounce 1 min (vue de profil) → ✅ À GARDER, RAFFINER
- L'idempotence côté serveur est une **vraie pratique prod** (anti-spam refresh/multi-onglets, indépendant du client). On garde.
- La cause front (React StrictMode double-invoke) est **dev-only** → pas un souci en prod.
- **Raffinement pro :** modéliser la visite en **upsert `(visitor, visited)` + `last_viewed_at`** (contrainte unique) avec cooldown, au lieu d'empiler des lignes puis debouncer.

### #2 — `MIN_TAGS = 3` dupliqué front + back → ⚠️ DETTE MINEURE
- Deux constantes qui peuvent diverger.
- **Version prod :** une seule source de vérité. Backend = autorité (il valide) ; le front **lit la règle** via `GET /api/config` ou un fichier de constantes partagé (monorepo). Idéalement un test qui asserte l'alignement.

---

## 3. Synthèse

| Correctif | Base pour une vraie app ? |
|---|---|
| #13 rate-limit | ✅ Déjà niveau prod |
| #10 anonymat / #2 logique / #5-12 / #11 / #4 / #7 | ✅ Base saine, réutilisable |
| #9 debounce | ✅ Garder, raffiner en upsert+cooldown |
| #2 constante dupliquée | ⚠️ Centraliser (dette mineure) |
| #3 géoloc IP | ❌ Remplacer par GeoLite2 |
| Appels (infra) | ❌/⚠️ Ajouter coturn + cycle de vie |
| #1 scoping seed | ❌ Colonne `is_seed` + envs séparés |

## 4. À refaire EN PREMIER si on veut une bonne base
1. **#3 → MaxMind GeoLite2** (local, pas d'API externe). GPS HTTPS = source primaire.
2. **#1 → colonne `is_seed`** + environnements séparés.
3. *(plus tard, infra)* **coturn** pour les appels + cycle de vie (sonnerie/occupé/timeout).
4. *(petit)* centraliser **MIN_TAGS**, transformer #9 en **upsert+cooldown**.
