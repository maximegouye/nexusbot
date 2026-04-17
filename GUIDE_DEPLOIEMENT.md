# 🚀 Guide de Déploiement NexusBot sur Railway

## Méthode 1 : Depuis le Terminal macOS (Recommandé)

```bash
# 1. Ouvrir Terminal (Cmd+Espace → "Terminal")
# 2. Installer Railway CLI
brew install railwayapp/railway/railway
# OU
curl -fsSL https://railway.app/install.sh | sh

# 3. Se connecter
railway login

# 4. Aller dans le dossier NexusBot
cd ~/Downloads/NexusBot

# 5. Déployer
railway up
```

## Méthode 2 : Via l'Interface Web Railway

1. Allez sur https://railway.app/dashboard
2. Ouvrez votre projet NexusBot
3. Cliquez sur le service NexusBot
4. Allez dans l'onglet **"Deployments"**
5. Cliquez **"Deploy Now"** ou **"Redeploy"**

## Méthode 3 : Script Automatique

Double-cliquez sur `deploy_railway.command` dans le dossier NexusBot.

---

## Nouvelles Commandes Ajoutées (Session Actuelle)

| Commande | Description |
|----------|-------------|
| `/heist` | 🦹 Braquages de groupe avec mises |
| `/checkin` | ✅ Check-in quotidien et streaks |
| `/rp` | 🎭 Actions roleplay (câlin, gifle, danse...) |
| `/minijeu` | 🎲 Plus/moins, anagramme, réaction, maths |
| `/parier` | 🎲 Système de paris virtuels |
| `/suggestion` | 💡 Suggestions avec votes de la communauté |
| `/musicquiz` | 🎵 Quiz musical (artistes, années, chansons) |
| `/confession` | 🤫 Confessions anonymes |
| `/demineur` | 💣 Démineur Discord (spoilers) |
| `/countdown` | ⏳ Comptes à rebours publics |
| `/recrutement` | 📋 Système de recrutement avec candidatures |
| `/stats` | 📊 Stats membres et serveur avancées |
| `/immo` | 🏠 Marché immobilier virtuel |
| `/trivia` | 🧠 Duel Trivia 1v1 ou solo |
| `/enchere` | 🔨 Enchères en temps réel |
| `/wiki` | 📚 Recherche Wikipédia intégrée |

**Total : 212 fichiers de commandes !**

## Amélioration Serveur +300%

Exécutez `setup_server_discord.command` pour créer automatiquement :
- 10 catégories thématiques
- 35+ salons texte organisés
- 9 salons vocaux
- 21+ rôles structurés
