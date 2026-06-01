# Memo — Tout supprimer et repartir de 0 (Docker)

> Sur cette machine, c'est le binaire **`docker-compose`** (avec tiret) qui marche,
> pas `docker compose`. Lancer toutes les commandes **depuis la racine du projet**
> (`/Users/jeremycointre/matcha`).
>
> Conteneurs du projet : `matcha_db`, `matcha_backend`, `matcha_frontend`, `matcha_nginx`
> Volume de la base : `matcha_postgres_data`

---

## 1. Reset standard (recommandé) — ne touche QUE le projet matcha

```bash
# Arrête et supprime conteneurs + réseaux + VOLUMES du projet (= efface la DB),
# et enlève les conteneurs "orphelins" laissés par d'anciennes versions du compose.
docker-compose down -v --remove-orphans
```

`-v` = supprime les volumes nommés (la base PostgreSQL repart vide).
Sans `-v`, la DB est conservée.

---

## 2. Vérifier qu'il ne reste vraiment rien du projet

```bash
docker ps -a   --filter "name=matcha" --format '{{.Names}}\t{{.Status}}'   # conteneurs
docker volume ls --filter "name=matcha" --format '{{.Name}}'              # volumes
docker network ls --filter "name=matcha" --format '{{.Name}}'            # réseaux
```

Les 3 doivent renvoyer **vide**. (Le volume cherché est `matcha_postgres_data`.)

---

## 3. Forcer si quelque chose reste bloqué (toujours scope matcha)

```bash
# Supprimer de force les conteneurs matcha encore là
docker rm -f matcha_db matcha_backend matcha_frontend matcha_nginx 2>/dev/null

# Supprimer le volume de la base à la main
docker volume rm matcha_postgres_data 2>/dev/null

# Supprimer le réseau du projet (nom par défaut = <dossier>_default)
docker network rm matcha_default 2>/dev/null
```

---

## 4. Repartir de 0 (rebuild complet)

```bash
docker-compose down -v --remove-orphans   # 1. tout nettoyer (DB incluse)
docker-compose build --no-cache           # 2. reconstruire les images sans cache
docker-compose up                         # 3. relancer (ajouter -d pour détaché)
```

Raccourci « nettoyer + rebuild + lancer » :

```bash
docker-compose down -v --remove-orphans && docker-compose up --build
```

---

## 5. Aussi supprimer les images du projet (optionnel)

```bash
# Liste les images construites par le projet
docker images | grep matcha

# down + suppression des images locales construites par ce compose
docker-compose down -v --remove-orphans --rmi local
```

---

## 6. ☢️ Nettoyage GLOBAL Docker — DANGER

> ⚠️ Ces commandes touchent **TOUS tes projets Docker**, pas seulement matcha
> (ex. `invoiceyield-webapp`, runners `act`, etc. présents sur cette machine).
> À n'utiliser que si tu veux vraiment faire le ménage complet de la machine.

```bash
docker container prune -f      # supprime TOUS les conteneurs arrêtés
docker volume prune -f         # supprime TOUS les volumes non utilisés
docker network prune -f        # supprime TOUS les réseaux non utilisés
docker image prune -a -f       # supprime TOUTES les images non utilisées

# Tout d'un coup (conteneurs + réseaux + images + cache de build, + volumes avec --volumes)
docker system prune -a --volumes -f
```

---

## Rappel express

| But | Commande |
|-----|----------|
| Reset DB + repartir propre | `docker-compose down -v --remove-orphans` |
| Reset + rebuild + lancer | `docker-compose down -v --remove-orphans && docker-compose up --build` |
| Garder la DB, juste relancer | `docker-compose down && docker-compose up` |
| Vérifier les restes matcha | `docker ps -a --filter name=matcha` |
