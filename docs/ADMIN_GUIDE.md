# 👑 Guide Administrateur — NexusBot v2

Ce guide est destiné à Maxime (le propriétaire du bot) pour gérer NexusBot.

---

## 🔑 Informations du bot

| Info | Valeur |
|------|--------|
| Nom | NexusBot#3869 |
| CLIENT_ID | 1493962497437466716 |
| Commandes | 99 slash commands |
| Base de données | SQLite (data/nexusbot.db) |
| Token | Dans le fichier .env |

---

## 🚀 Lancer le bot

**Sur ton Mac :**
Double-cliquer sur `setup_et_lancer.command` dans le dossier NexusBot.

**Sur un VPS (voir GUIDE_HEBERGEMENT_VPS.md) :**
```bash
pm2 start src/index.js --name "NexusBot"
```

---

## 🔧 Commandes propriétaire (BOT_OWNER_ID)

Si tu configures `BOT_OWNER_ID` dans `.env`, ces commandes ne seront accessibles qu'à toi.

### Gérer le Premium
```
/premium activer code:XXXXX     → Activer Premium sur un serveur
/premium statut                  → Voir le statut Premium
```

Pour générer des codes Premium (command désactivée publiquement mais accessible via DB) :
```sql
INSERT INTO premium_codes (code, plan, duration_days)
VALUES ('MON-CODE-SPECIAL', 'monthly', 30);
```

---

## 📊 Tableau de bord (base de données)

Pour inspecter la base de données, utilise un outil comme **DB Browser for SQLite** :
1. Télécharge sur [sqlitebrowser.org](https://sqlitebrowser.org)
2. Ouvre `NexusBot/data/nexusbot.db`
3. Parcours les tables, execute des requêtes SQL

Requêtes utiles :
```sql
-- Voir tous les serveurs
SELECT guild_id, xp_enabled, eco_enabled FROM guild_config;

-- Top 10 membres d'un serveur
SELECT user_id, level, xp, balance FROM users WHERE guild_id = 'TON_GUILD_ID' ORDER BY xp DESC LIMIT 10;

-- Voir les codes Premium
SELECT code, plan, used, used_by FROM premium_codes;

-- Créer un code premium
INSERT INTO premium_codes (code, plan, duration_days) VALUES ('NEXUS2024', 'monthly', 30);
```

---

## 🔁 Mettre à jour le bot

1. Modifie les fichiers dans `NexusBot/src/`
2. Double-clique à nouveau sur `setup_et_lancer.command`
3. L'ancien processus s'arrête automatiquement, le nouveau démarre

Pour les mises à jour sans redémarrage complet (si sur VPS) :
```bash
pm2 restart NexusBot
```

---

## ➕ Ajouter le bot sur un nouveau serveur

Lien d'invitation :
```
https://discord.com/oauth2/authorize?client_id=1493962497437466716&permissions=8&scope=bot%20applications.commands
```

L'option `permissions=8` = **Administrateur** (recommandé pour que toutes les fonctions marchent).

---

## 📋 Checklist de configuration d'un nouveau serveur

Une fois le bot ajouté :

1. `/setup` → configure les salons de base
2. `/xpconfig activer actif:true` → activer l'XP
3. `/levelrole` → configurer les rôles de niveau
4. `/starboard setup salon:#starboard seuil:3`
5. `/ticket setup` → configurer les tickets
6. `/statschannel setup` → créer les salons stats
7. `/automod` → configurer l'AutoMod
8. `/logs salon:#logs type:all` → activer les logs

---

## 🐛 Résoudre les problèmes courants

### Le bot ne répond pas
- Vérifie qu'il est Online dans la liste des membres
- Vérifie les permissions du bot dans le serveur
- Regarde les logs du terminal (`pm2 logs NexusBot` sur VPS)

### Commande inconnue
- Attends 5-60 minutes pour la propagation des commandes globales
- Ou passe en `DEV_MODE=true` avec `DEV_GUILD_ID=ton_id` pour des commandes instantanées

### Erreur "Missing Permissions"
- Le bot a besoin du rôle Administrateur, ou au minimum les permissions nécessaires à chaque commande

### La musique ne fonctionne pas
- Rejoins d'abord un salon vocal
- Vérifie que le bot a la permission "Se connecter" et "Parler" dans le salon vocal

### Base de données corrompue
- Arrête le bot
- Fais une copie de `data/nexusbot.db` (backup)
- Redémarre le bot (il recrée les tables manquantes automatiquement)

---

## 💡 Astuces Pro

### Multiplier les XP pour les boosters
```
/xpconfig multiplicateur role:@Nitro Booster valeur:2
```

### Créer un canal VIP sans XP
```
/xpconfig noxp_canal canal:#spam ajouter:true
```

### Message de level-up personnalisé avec emojis
```
/xpconfig message_levelup message:🚀 GG {user} ! Tu reaches le niveau **{level}** sur {guild} !
```

### Annonce avec mention de rôle
```
/announce message:Nouveau tournoi ce soir ! salon:#annonces ping_role:@Gamers
```

### Giveaway avec niveau requis
```
/giveaway creer titre:Abonnement Nitro prix:1 duree:48h salon:#giveaways niveau_min:10
```
