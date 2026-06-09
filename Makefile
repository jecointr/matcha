# Matcha — Makefile unique à la racine (pilote docker-compose.yml)

COMPOSE := docker compose

# ---------------------------------------------------------------------------
# Cycle de vie
# ---------------------------------------------------------------------------

.PHONY: all
all: up ## (défaut) build + démarrage en arrière-plan

.PHONY: up
up: ## Build si nécessaire puis démarre tous les services en arrière-plan
	$(COMPOSE) up -d --build

.PHONY: build
build: ## Construit (ou reconstruit) les images sans démarrer
	$(COMPOSE) build

.PHONY: down
down: ## Arrête et supprime les conteneurs (les volumes sont conservés)
	$(COMPOSE) down

.PHONY: restart
restart: down up ## Redémarre tous les services

.PHONY: re
re: ## Rebuild complet sans cache puis redémarre
	$(COMPOSE) down
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d

# ---------------------------------------------------------------------------
# Observation
# ---------------------------------------------------------------------------

.PHONY: ps
ps: ## Liste l'état des conteneurs
	$(COMPOSE) ps

.PHONY: logs
logs: ## Suit les logs de tous les services (Ctrl-C pour quitter)
	$(COMPOSE) logs -f

# ---------------------------------------------------------------------------
# Données / seed
# ---------------------------------------------------------------------------

.PHONY: seed
seed: ## Génère les profils + photos de démo (dans le conteneur backend)
	$(COMPOSE) exec backend npm run seed:all

# ---------------------------------------------------------------------------
# Accès shell
# ---------------------------------------------------------------------------

.PHONY: shell-back
shell-back: ## Ouvre un shell dans le conteneur backend
	$(COMPOSE) exec backend sh

.PHONY: shell-db
shell-db: ## Ouvre un client psql dans le conteneur db
	$(COMPOSE) exec db sh -c 'psql -U $$POSTGRES_USER -d $$POSTGRES_DB'

# ---------------------------------------------------------------------------
# Nettoyage
# ---------------------------------------------------------------------------

.PHONY: clean
clean: ## Arrête et supprime conteneurs + volumes (⚠ efface la base de données)
	$(COMPOSE) down -v

.PHONY: fclean
fclean: clean ## clean + supprime les images du projet et les photos uploadées
	$(COMPOSE) down --rmi local
	@find backend/uploads -type f ! -name '.gitkeep' -delete 2>/dev/null || true

# ---------------------------------------------------------------------------
# Aide
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
