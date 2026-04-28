FROM node:20-slim

# Outils pour compiler better-sqlite3 (module natif)
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier package.json en premier pour utiliser le cache Docker
COPY package*.json ./

# Installation principale — skip les optional deps lourdes (canvas v2, sodium-native...)
RUN npm install --omit=optional

# Réinstaller @napi-rs/canvas + gif-encoder-2 AVEC les binaires platform (Linux x64 glibc).
# Cette commande inclut les optional deps du package (le prebuilt binaire natif),
# nécessaire pour la roulette/roue graphique animée en GIF.
RUN npm install @napi-rs/canvas gif-encoder-2

# Copier le reste du code
COPY . .

# Créer le dossier data
RUN mkdir -p /app/data

CMD ["sh", "start.sh"]
