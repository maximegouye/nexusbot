# 🚀 NexusBot — Le bot Discord francophone le plus complet

> **Mieux que MEE6, CoinsBot et DRAFT Bot réunis.**  
> Économie avancée, niveaux, modération, giveaways intégrés, tickets, réputation, quêtes communautaires, marché P2P, carte de rang canvas, rapports de santé hebdomadaires et bien plus.

---

## ✨ Fonctionnalités uniques (introuvables ailleurs)

| Fonctionnalité | Description |
|---|---|
| 🗺️ **Quêtes Communautaires** | Toute la communauté contribue des coins pour atteindre un objectif. Récompense collective. |
| 🏪 **Marché Joueur-à-Joueur** | Vends et achète des articles à d'autres membres directement. Frais de 5%. |
| 🎤 **XP Vocal** | Gagne XP et coins en temps réel en vocal (3 XP/min + 2 coins/min). |
| 📊 **Rapport de Santé** | Rapport hebdomadaire automatique avec score de santé et recommandations. |
| 🎂 **Anniversaires** | Annonces automatiques avec cadeau coins et rôle temporaire. |
| 🎰 **Blackjack Interactif** | Vrai Blackjack en temps réel avec boutons Discord (Hit/Stand/Double). |
| 🎯 **Défis Joueur-à-Joueur** | Lance des défis avec mises, vote communautaire pour le résultat. |
| ⭐ **Réputation** | Système de réputation avec paliers de récompenses (×coins aux milestones). |
| 🔥 **Streaks Daily** | Bonus cumulatifs jusqu'à +300 coins/jour + événements de milestone. |

---

## 📋 Installation

### Prérequis
- Node.js 18+
- npm

### 1. Cloner / télécharger le projet
```bash
cd NexusBot
```

### 2. Installer les dépendances
```bash
npm install
```

> **Note :** Le package `canvas` nécessite des dépendances système.  
> Sur Ubuntu/Debian : `sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`  
> Sur Windows : Installer [node-gyp](https://github.com/nodejs/node-gyp)

### 3. Configurer le fichier .env
```bash
cp .env.example .env
```
Remplis `.env` :
```
TOKEN=ton_token_discord
CLIENT_ID=ton_client_id
DEV_MODE=true
DEV_GUILD_ID=ton_serveur_de_test
```

### 4. Lancer le bot
```bash
npm start        # Production
npm run dev      # Développement (avec nodemon)
```

---

## ⚙️ Configuration du bot

Toutes les commandes admin nécessitent la permission **Gérer le serveur**.

```
/setup voir           — Voir la configuration actuelle
/setup couleur        — Changer la couleur des embeds
/setup monnaie        — Nom et emoji de la monnaie
/setup welcome        — Canal de bienvenue
/setup leave          — Canal de départ
/setup levels         — Canal des level-up
/setup autorole       — Rôle automatique à l'arrivée
/setup xp             — Activer/désactiver le gain d'XP
```

---

## 📖 Commandes

### 💰 Économie
| Commande | Description |
|---|---|
| `/balance` | Voir son solde (portefeuille, banque, total) |
| `/daily` | Récompense quotidienne + streak |
| `/work` | Travailler (cooldown 1h) |
| `/deposit` / `/withdraw` | Gérer sa banque |
| `/transfer` | Envoyer des coins (frais 2%) |
| `/shop` | Boutique du serveur |
| `/buy` | Acheter un article |
| `/inventory` | Voir son inventaire |
| `/market` | Marché joueur-à-joueur |
| `/gamble` | Slots, Coinflip, Blackjack |
| `/crime` | Crimes à risque |
| `/rob` | Voler un membre |

### ⭐ Niveaux
| Commande | Description |
|---|---|
| `/rank` | Carte de rang canvas personnalisée |
| `/leaderboard` | Classement (XP, coins, vocal, messages, rep) |
| `/setlevel` | Définir le niveau d'un membre (Admin) |
| `/setxp` | Définir l'XP d'un membre (Admin) |

### 🛡️ Modération
| Commande | Description |
|---|---|
| `/ban` | Bannir un membre |
| `/kick` | Expulser un membre |
| `/mute` | Timeout natif Discord |
| `/warn` | Avertir (actions auto à 3 et 5 warns) |
| `/warnings` | Voir les avertissements |
| `/clearwarns` | Effacer des avertissements |
| `/clear` | Supprimer des messages en masse |
| `/slowmode` | Mode lent |
| `/lock` | Verrouiller/déverrouiller un salon |

### 🎮 Fun
| Commande | Description |
|---|---|
| `/8ball` | Boule magique |
| `/blague` | Blague aléatoire |
| `/quizz` | Quiz avec récompenses |
| `/rps` | Pierre-Feuille-Ciseaux |
| `/defi` | Défier un membre avec mise |

### ✨ Uniques
| Commande | Description |
|---|---|
| `/rep` | Donner de la réputation |
| `/quest` | Quêtes communautaires |
| `/giveaway` | Créer/terminer/reroll des giveaways |
| `/ticket` | Système de tickets |
| `/birthday` | Anniversaires |
| `/health` | Rapport de santé du serveur |
| `/reactionrole` | Rôles par réaction |

---

## 🗂️ Structure du projet

```
NexusBot/
├── src/
│   ├── index.js                 # Point d'entrée, cron, chargeur
│   ├── database/
│   │   └── db.js                # SQLite schema + helpers
│   ├── commands/
│   │   ├── economy/             # balance, daily, work, shop...
│   │   ├── leveling/            # rank, leaderboard, setlevel, setxp
│   │   ├── moderation/          # ban, kick, mute, warn...
│   │   ├── utility/             # help, serverinfo, userinfo, poll, remind
│   │   ├── fun/                 # 8ball, blague, quizz, rps, defi
│   │   ├── unique/              # rep, quest, giveaway, ticket, birthday, health
│   │   └── admin/               # setup, additem
│   ├── events/
│   │   ├── interactionCreate.js # Slash commands + buttons + polls
│   │   ├── messageCreate.js     # XP + automod + quêtes
│   │   ├── guildMemberAdd.js    # Bienvenue + autorole
│   │   ├── guildMemberRemove.js # Message de départ
│   │   ├── messageReactionAdd.js    # Reaction roles + starboard
│   │   ├── messageReactionRemove.js # Reaction roles
│   │   └── voiceStateUpdate.js  # Sessions vocales + XP
│   └── utils/
│       ├── giveawayCheck.js     # Vérification giveaways (cron 1min)
│       ├── reminderCheck.js     # Vérification rappels (cron 1min)
│       ├── tempRoleCheck.js     # Expiration rôles (cron 5min)
│       ├── birthdayCheck.js     # Anniversaires (cron 8h)
│       ├── healthReport.js      # Rapport hebdo (dimanche 9h)
│       ├── questReset.js        # Reset quêtes (lundi 0h)
│       └── voiceXPTick.js       # XP vocal temps réel (cron 1min)
├── data/                        # Base de données SQLite (auto-créée)
├── assets/fonts/                # Polices pour les rank cards (optionnel)
├── .env.example
├── package.json
└── README.md
```

---

## 🔧 Variables d'environnement

| Variable | Description | Requis |
|---|---|---|
| `TOKEN` | Token du bot Discord | ✅ |
| `CLIENT_ID` | ID de l'application Discord | ✅ |
| `DEV_MODE` | `true` pour enregistrer en guild (plus rapide) | ❌ |
| `DEV_GUILD_ID` | ID du serveur de test (si DEV_MODE=true) | ❌ |
| `BLAGUES_API_KEY` | Clé API blagues-api.fr (optionnel) | ❌ |

---

## 🎨 Personnalisation

Chaque serveur peut personnaliser :
- Couleur des embeds (`/setup couleur`)
- Nom et emoji de la monnaie (`/setup monnaie`)
- Canaux (bienvenue, départ, level-up, anniversaire, santé)
- Rôle automatique à l'arrivée
- Multiplicateur XP
- Seuil de giveaways Starboard
- Articles de la boutique (`/additem`)
- Quêtes communautaires (`/quest creer`)

---

## 📜 Licence

MIT — Libre d'utilisation et de modification.
