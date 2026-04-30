FROM node:20-slim

# Cache-bust 2026-04-30T20:15 — FORCE redeploy pour appliquer slots-pro + tickets ULTRA + bulletproof V4
ARG CACHEBUST=20260430_2015_ULTRA
RUN echo "Cache bust ULTRA: $CACHEBUST"

# Outils pour compiler better-sqlite3 (module natif)
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier package.json en premier pour utiliser le cache Docker
COPY package*.json ./
RUN npm install --omit=optional

# Copier le reste du code
COPY . .

# Créer le dossier data
RUN mkdir -p /app/data

# Diagnostic : afficher les premieres lignes de start.sh dans le build pour verifier
RUN echo "=== Contenu de start.sh dans l image ===" && head -50 start.sh

CMD ["sh", "start.sh"]
# trigger redeploy 1803 — force Railway pour appliquer fix opensModal
