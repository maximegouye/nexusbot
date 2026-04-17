# ⚙️ NexusBot v2 — Guide de Configuration

## 1. Première utilisation : `/setup`

Lance `/setup` sur ton serveur Discord. Le bot te guidera pas à pas pour configurer :
- Le salon de logs modération
- Le salon de level-up
- Le salon des giveaways
- Le message de bienvenue
- Le rôle automatique à l'arrivée
- Le salon du starboard

---

## 2. Configuration des fonctionnalités

### 🎚️ Système XP et niveaux

```
/xpconfig statut           → Voir toute la configuration actuelle
/xpconfig activer          → Activer ou désactiver l'XP
/xpconfig taux xp_min:20   → Minimum 20 XP par message (défaut: 15)
/xpconfig taux coins:10    → 10 pièces par message (défaut: 5)
/xpconfig canal_levelup    → Choisir le salon des level-up
/xpconfig message_levelup message:🎉 {user} passe niveau {level}!
/xpconfig noxp_canal       → Désactiver l'XP dans #général par exemple
/xpconfig noxp_role        → Les membres avec ce rôle ne gagnent pas d'XP
/xpconfig multiplicateur role:@Booster valeur:2  → XP x2 pour les boosters
```

**Variables de message** : `{user}` (mention), `{level}` (numéro), `{guild}` (serveur)

### 🌟 Starboard

Le starboard épingle automatiquement les messages populaires dans un salon dédié.

```
/starboard setup salon:#starboard seuil:3
```

- `seuil` : nombre de ⭐ requis (défaut: 3)
- Personnalisable avec d'autres emojis via la table `starboard_config`

### 🎫 Tickets de support

```
/ticket setup
```
Configure : salon d'ouverture des tickets, catégorie, rôle du staff, message d'accueil.

### 🎁 Giveaways

```
/giveaway creer titre:iPhone prix:2 duree:24h salon:#giveaways
```

Options avancées :
- `niveau_min` : niveau minimum requis pour participer
- `balance_min` : solde minimum requis
- `role_bonus` : ce rôle donne 3 tickets au lieu de 1

### 📢 Logs du serveur

```
/logs salon:#mod-logs type:all
```

Types : `messages`, `membres`, `modération`, `vocal`, `all`

### 🔔 Notifications YouTube

```
/youtube-notif ajouter chaine:UCxxxxxxx salon:#annonces
```

Le bot vérifie les nouvelles vidéos toutes les 5 minutes.

### 🟣 Notifications Twitch

```
/twitch-notif ajouter streamer:nomdustreamer salon:#streams
```

### 📊 Salons de statistiques

```
/statschannel setup
```

Crée automatiquement une catégorie "📊 Stats" avec :
- Membres totaux
- Membres bots
- Boosts du serveur
- Nombre de salons

Mise à jour toutes les 10 minutes.

---

## 3. Réponses automatiques (AutoResponder)

```
/autoresponder ajouter declencheur:hello reponse:Salut {user} !
/autoresponder ajouter declencheur:!ticket reponse:Ouvre un ticket avec /ticket exact:true
```

**Variables** : `{user}`, `{username}`, `{server}`, `{membercount}`
**Limite** : 25 réponses (100 avec Premium)

---

## 4. Menu de rôles (RoleMenu)

Crée des boutons interactifs pour que les membres choisissent leurs rôles.

```
/rolemenu creer titre:Choisir tes rôles role1:@Gaming role2:@Musique role3:@Cinéma
```

Options : `max` (nombre de rôles max), `description`, `salon`

---

## 5. Tags (réponses prédéfinies)

```
/tag creer nom:règles contenu:Les règles du serveur sont...
/tag utiliser nom:règles
```

Supporte l'autocomplétion : commence à taper le nom du tag et Discord propose les correspondances.

---

## 6. Highlights (mots-clés personnels)

Les membres reçoivent un DM quand leur mot-clé est mentionné dans un message.

```
/highlight ajouter mot:candidature
/highlight liste
```

Cooldown de 5 minutes pour éviter le spam.

---

## 7. Anti-Modération (AutoMod)

```
/automod ...
```

Options disponibles : anti-spam, anti-liens, mots interdits, anti-mentions, niveaux d'alerte.

Configuration avancée via la table `automod_config`.

---

## 8. Quêtes communautaires

```
/quest creer titre:Bavards cible:1000 recompense_coins:500 recompense_xp:200
```

Tous les membres contribuent ensemble. Quand la cible est atteinte, tout le monde est récompensé.

---

## 9. Variables de configuration avancée

Modifiables via `/setup` ou les commandes dédiées :

| Variable | Commande | Défaut |
|----------|----------|--------|
| XP activé | `/xpconfig activer` | Oui |
| XP par message | `/xpconfig taux` | 15-25 |
| Pièces par message | `/xpconfig taux` | 5 |
| Seuil starboard | `/starboard setup` | 3 |
| Couleur embed | `/setup` | #7B2FBE |
| Nom devise | `/setup` | Coins 🪙 |

---

## 10. Fichier .env (configuration secrète)

Le fichier `.env` à la racine du bot contient :

```
TOKEN=ton_token_discord
CLIENT_ID=ton_client_id
DEV_MODE=false
DEV_GUILD_ID=optionnel_pour_tests_rapides
```

**⚠️ Ne jamais partager ce fichier.** Il contient le token de connexion du bot.

Pour activer le mode développeur (commandes enregistrées instantanément sur un seul serveur) :
```
DEV_MODE=true
DEV_GUILD_ID=ID_de_ton_serveur_test
```
