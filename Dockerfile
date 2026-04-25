FROM node:20-slim

# Outils pour compiler better-sqlite3 (module natif)
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier package.json en premier pour utiliser le cache Docker
COPY package*.json ./
RUN npm ci --omit=optional

# Copier le reste du code
COPY . .

# Créer le dossier data
RUN mkdir -p /app/data

CMD ["sh", "start.sh"]
