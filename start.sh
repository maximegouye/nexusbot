#!/bin/sh
# =========================================================
# NexusBot — Script de démarrage (Railway / Discloud)
# =========================================================

# Déterminer le répertoire de travail (Discloud = /app, Railway = /app)
APP_DIR="${APP_DIR:-$(dirname $(readlink -f $0))}"
DATA_DIR="$APP_DIR/data"
SEED_DIR="$APP_DIR/data_seed"

mkdir -p "$DATA_DIR"

# Premier démarrage : copier la base de données initiale
if [ ! -f "$DATA_DIR/nexusbot.db" ]; then
  if [ -f "$SEED_DIR/nexusbot.db" ]; then
    echo "[START] Premier démarrage — copie de la base de données..."
    cp "$SEED_DIR/nexusbot.db" "$DATA_DIR/nexusbot.db"
    echo "[START] Base de données initialisée."
  else
    echo "[START] Nouvelle base de données sera créée au démarrage."
  fi
else
  echo "[START] Base de données existante trouvée."
fi

# Aller dans le dossier du bot et démarrer
cd "$APP_DIR"
exec node src/index.js
