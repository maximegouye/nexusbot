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

# Enregistrer les slash commands sur Discord (toujours, pour prendre en compte les nouvelles)
echo "[START] Enregistrement des slash commands..."
node deploy-commands.js
DEPLOY_RESULT=$?
echo "[START] deploy-commands.js exit code: $DEPLOY_RESULT"
if [ $DEPLOY_RESULT -ne 0 ]; then
  echo "[START] ⚠️  deploy-commands.js a échoué — le bot démarre quand même."
fi

echo "[START] >>> Lancement de node src/index.js a $(date -u +%H:%M:%S) UTC <<<"
ls -la src/index.js
echo "[START] Node version: $(node --version)"
echo "[START] Args: $0 $@"

# Pas d'exec — utilise un fork pour garder le shell vivant et capturer les exits
node src/index.js
NODE_EXIT=$?
echo "[START] !!! node src/index.js a exit avec code $NODE_EXIT a $(date -u +%H:%M:%S) UTC !!!"
sleep 5
exit $NODE_EXIT
