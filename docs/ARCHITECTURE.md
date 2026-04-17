# 🏗️ NexusBot v2 — Architecture Technique

## Structure des fichiers

```
NexusBot/
├── .env                        ← Token & secrets (NE PAS PARTAGER)
├── package.json                ← Dépendances Node.js
├── setup_et_lancer.command     ← Double-clic pour lancer (Mac)
├── data/
│   └── nexusbot.db             ← Base de données SQLite
├── docs/                       ← Cette documentation
└── src/
    ├── index.js                ← Point d'entrée, chargement, tâches planifiées
    ├── database/
    │   └── db.js               ← Schéma SQLite + helpers + migrations
    ├── commands/               ← 100 commandes slash (dossiers par catégorie)
    │   ├── admin/              ← backup, announce, massrole, dehoist, statschannel, lockserver
    │   ├── economy/            ← balance, daily, work, shop, buy, dig, fish, hunt, slots, coinflip, richlist...
    │   ├── fun/                ← 8ball, rps
    │   ├── games/              ← tictactoe, connect4, wordle, compter, devine
    │   ├── leveling/           ← rank, leaderboard, xpconfig, levelrole, setlevel, setxp
    │   ├── moderation/         ← ban, kick, warn, timeout, massban, cases, tempban, automod, nuke...
    │   ├── music/              ← play, skip, stop, queue, volume, loop, seek, lyrics, radio...
    │   ├── premium/            ← premium
    │   ├── social/             ← profil, afk, action, rep
    │   ├── unique/             ← giveaway, ticket, quest, reactionrole
    │   └── utility/            ← help, starboard, tag, highlight, autoresponder, rolemenu, color, timestamp...
    ├── events/                 ← Gestionnaires d'événements Discord
    │   ├── interactionCreate.js  ← Slash commands + boutons + autocomplete
    │   ├── messageCreate.js      ← XP, anti-spam, anti-liens, highlights, autoresponder, quêtes
    │   ├── messageReactionAdd.js ← Reaction roles + starboard
    │   ├── guildMemberAdd.js     ← Bienvenue + autorôle + invite tracking
    │   ├── guildMemberRemove.js  ← Message de départ
    │   └── voiceStateUpdate.js   ← XP vocal
    └── utils/                  ← Utilitaires et crons
        ├── automodHandler.js     ← AutoMod avancé
        ├── autoresponderHandler.js ← Logique réponses auto
        ├── birthdayCheck.js      ← Vérification anniversaires (8h quotidien)
        ├── giveawayCheck.js      ← Fin des giveaways (chaque minute)
        ├── healthReport.js       ← Rapport santé serveur (dimanche 9h)
        ├── highlightHandler.js   ← DM mots-clés
        ├── inviteCache.js        ← Cache des liens d'invitation
        ├── lottoCheck.js         ← Loto hebdomadaire (dimanche 20h)
        ├── musicManager.js       ← Gestionnaire de files musicales
        ├── notificationChecker.js ← YouTube + Twitch (toutes les 5 min)
        ├── questReset.js         ← Reset quêtes hebdomadaires (lundi 0h)
        ├── reminderCheck.js      ← Rappels (chaque minute)
        ├── starboardHandler.js   ← Logique starboard avancé
        ├── statsChannelUpdater.js ← Salons stats (toutes les 10 min)
        ├── tempbanCheck.js       ← Débannissements auto (chaque minute)
        ├── tempRoleCheck.js      ← Rôles temporaires (toutes les 5 min)
        └── voiceXPTick.js        ← XP vocal (chaque minute)
```

---

## Base de données SQLite

La DB est dans `data/nexusbot.db`. Tables principales :

| Table | Contenu |
|-------|---------|
| `guild_config` | Configuration par serveur |
| `users` | XP, coins, banque, level de chaque membre |
| `warnings` | Toutes les sanctions (warn, ban, kick, timeout...) |
| `giveaways` | Giveaways avec participants et conditions |
| `tickets` | Tickets de support |
| `reaction_roles` | Reaction roles configurés |
| `starboard` / `starboard_config` | Starboard legacy + avancé |
| `highlights` | Mots-clés des membres |
| `autoresponder` | Réponses automatiques |
| `role_menus` | Menus de rôles avec boutons |
| `tags` | Tags / réponses prédéfinies |
| `quests` / `quest_contributions` | Quêtes communautaires |
| `reminders` | Rappels programmés |
| `level_roles` | Rôles attribués selon le niveau |
| `no_xp` | Canaux/rôles exclus du gain d'XP |
| `xp_multipliers` | Multiplicateurs XP par rôle |
| `voice_sessions` | Sessions vocales actives |
| `invite_tracker` / `invite_stats` | Suivi des invitations |
| `youtube_subs` / `twitch_subs` | Abonnements notifications |
| `automod_config` | Configuration AutoMod avancé |
| `premium_servers` / `premium_codes` | Système Premium |
| `backups` | Sauvegardes de config |
| `stats_channels` | Config salons de stats |
| `counting` | Jeu du comptage |
| `lotto` | Loto hebdomadaire |
| `suggestions` | Suggestions des membres |
| `polls` | Sondages |
| `afk` | Statuts AFK |
| `marriages` | Mariages entre membres |
| `market_listings` | Marché entre joueurs |
| `mod_notes` | Notes de modération privées |
| `tempbans` | Bans temporaires |
| `boosts` | Historique des boosts |

---

## Technologies

| Technologie | Version | Usage |
|-------------|---------|-------|
| Node.js | 20.x | Runtime JavaScript |
| discord.js | 14.x | API Discord |
| better-sqlite3 | latest | Base de données |
| @discordjs/voice | latest | Musique vocale |
| play-dl | latest | Streaming YouTube |
| canvas | latest | Cartes de rang |
| node-cron | latest | Tâches planifiées |
| dotenv | latest | Variables d'environnement |

---

## Tâches planifiées (crons)

| Intervalle | Tâche |
|-----------|-------|
| Chaque minute | Giveaways, rappels, XP vocal, tempbans |
| Toutes les 5 min | Notifications YouTube/Twitch, rôles temporaires |
| Toutes les 10 min | Mise à jour stats channels |
| Tous les jours à 8h | Anniversaires |
| Dimanche à 9h | Rapport de santé serveur |
| Dimanche à 20h | Loto hebdomadaire |
| Lundi à 0h | Reset quêtes hebdomadaires |
| Toutes les 20 sec | Rotation du statut |

---

## Gestion des erreurs

- Toutes les commandes ont un try/catch global dans `interactionCreate.js`
- Les handlers d'événements secondaires (highlight, autoresponder, automod) sont dans des `try {}` silencieux
- `process.on('unhandledRejection')` et `'uncaughtException'` sont interceptés
- Les opérations Discord (send, edit, delete) utilisent `.catch(() => {})` pour éviter les crashs
