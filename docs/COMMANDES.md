# 📋 NexusBot v2 — Liste complète des commandes (99 commandes)

> **Préfixe** : `/` (slash commands Discord)
> **Permissions** : Les permissions indiquées sont requises pour exécuter la commande.

---

## 🛡️ ADMINISTRATION

| Commande | Description | Permission |
|----------|-------------|------------|
| `/setup` | Assistant de configuration guidé du serveur | Admin |
| `/additem` | Ajouter un article à la boutique | Admin |
| `/massrole ajouter` | Attribuer un rôle à tous les membres | Gérer les rôles |
| `/massrole retirer` | Retirer un rôle à tous les membres | Gérer les rôles |
| `/massrole info` | Voir combien de membres ont un rôle | Gérer les rôles |
| `/dehoist scanner` | Aperçu des pseudos avec caractères de hoisting | Gérer les pseudos |
| `/dehoist appliquer` | Renommer tous les membres hoistés | Gérer les pseudos |
| `/dehoist membre` | Renommer un seul membre | Gérer les pseudos |
| `/announce` | Créer une annonce stylisée avec embed | Gérer les messages |
| `/backup creer` | Sauvegarder la configuration du serveur | Admin |
| `/backup restaurer` | Restaurer une sauvegarde | Admin |
| `/backup liste` | Voir les sauvegardes disponibles | Admin |
| `/backup supprimer` | Supprimer une sauvegarde | Admin |
| `/statschannel setup` | Créer les salons de statistiques | Gérer les salons |
| `/statschannel retirer` | Supprimer la config stats channels | Gérer les salons |
| `/statschannel statut` | Voir les stats channels configurés | Gérer les salons |
| `/lockserver activer` | Verrouillage d'urgence du serveur | Admin |
| `/lockserver desactiver` | Déverrouiller le serveur | Admin |

---

## ⚖️ MODÉRATION

| Commande | Description | Permission |
|----------|-------------|------------|
| `/ban` | Bannir un membre | Bannir des membres |
| `/kick` | Expulser un membre | Expulser des membres |
| `/mute` | Mettre en sourdine (rôle mute) | Gérer les rôles |
| `/warn` | Avertir un membre | Gérer les messages |
| `/warnings` | Voir les avertissements d'un membre | Gérer les messages |
| `/clearwarns` | Effacer les avertissements d'un membre | Gérer les messages |
| `/timeout appliquer` | Mettre en timeout Discord natif (5s à 28j) | Modérer les membres |
| `/timeout retirer` | Retirer un timeout | Modérer les membres |
| `/massban` | Bannir jusqu'à 50 utilisateurs d'un coup | Bannir des membres |
| `/tempban` | Bannissement temporaire avec durée | Bannir des membres |
| `/unban` | Débannir un utilisateur | Bannir des membres |
| `/clear` | Supprimer en masse des messages | Gérer les messages |
| `/slowmode` | Activer/configurer le mode lent | Gérer les salons |
| `/lock` | Verrouiller un salon | Gérer les salons |
| `/temprole` | Attribuer un rôle temporaire | Gérer les rôles |
| `/nuke` | Recréer un salon (purge totale) | Admin |
| `/automod` | Configurer l'AutoMod avancé | Admin |
| `/cases voir` | Historique des sanctions d'un membre | Gérer les messages |
| `/cases info` | Détails d'un cas de modération | Gérer les messages |
| `/cases modifier` | Modifier la raison d'un cas | Gérer les messages |
| `/cases supprimer` | Supprimer un cas (admin) | Admin |
| `/cases stats` | Stats de modération du serveur | Gérer les messages |

---

## ⭐ NIVEAUX & XP

| Commande | Description | Permission |
|----------|-------------|------------|
| `/rank` | Voir sa carte de rang avec XP | Tout le monde |
| `/leaderboard` | Classement des membres par XP/coins | Tout le monde |
| `/setlevel` | Modifier le niveau d'un membre | Admin |
| `/setxp` | Modifier l'XP d'un membre | Admin |
| `/levelrole` | Configurer les rôles attribués par niveau | Admin |
| `/xpconfig statut` | Voir la configuration XP complète | Admin |
| `/xpconfig activer` | Activer/désactiver le système XP | Admin |
| `/xpconfig taux` | Modifier le taux XP/pièces par message | Admin |
| `/xpconfig noxp_canal` | Ajouter/retirer un canal sans XP | Admin |
| `/xpconfig noxp_role` | Ajouter/retirer un rôle sans XP | Admin |
| `/xpconfig multiplicateur` | XP x2, x3... pour un rôle | Admin |
| `/xpconfig message_levelup` | Personnaliser le message de montée de niveau | Admin |
| `/xpconfig canal_levelup` | Choisir le salon des level-up | Admin |

---

## 💰 ÉCONOMIE

| Commande | Description | Permission |
|----------|-------------|------------|
| `/balance` | Voir son solde (wallet + banque) | Tout le monde |
| `/daily` | Récupérer sa récompense quotidienne | Tout le monde |
| `/work` | Travailler pour gagner des coins | Tout le monde |
| `/deposit` | Déposer des coins en banque | Tout le monde |
| `/withdraw` | Retirer des coins de la banque | Tout le monde |
| `/transfer` | Donner des coins à quelqu'un | Tout le monde |
| `/shop` | Voir la boutique du serveur | Tout le monde |
| `/buy` | Acheter un article de la boutique | Tout le monde |
| `/inventory` | Voir son inventaire | Tout le monde |
| `/gamble` | Miser des coins (risqué !) | Tout le monde |
| `/crime` | Commettre un délit pour des coins | Tout le monde |
| `/rob` | Voler des coins à un autre membre | Tout le monde |
| `/dig` | Creuser pour trouver des ressources | Tout le monde |
| `/fish` | Pêcher pour des coins | Tout le monde |
| `/hunt` | Chasser pour des ressources | Tout le monde |
| `/slots` | Machine à sous (🍒🍋🍊🍇💎7️⃣) | Tout le monde |
| `/richlist` | Top 10 des membres les plus riches | Tout le monde |
| `/coinflip` | Pile ou face contre un autre membre | Tout le monde |

---

## 🎵 MUSIQUE

| Commande | Description | Permission |
|----------|-------------|------------|
| `/play` | Jouer une musique (URL ou recherche YouTube) | Tout le monde |
| `/skip` | Passer à la piste suivante | Tout le monde |
| `/stop` | Arrêter la musique et vider la file | Tout le monde |
| `/queue` | Voir la file d'attente | Tout le monde |
| `/volume` | Régler le volume (0-200%) | Tout le monde |
| `/pause` | Mettre en pause / reprendre | Tout le monde |
| `/nowplaying` | Voir la piste en cours | Tout le monde |
| `/loop` | Mode boucle (none/track/queue) | Tout le monde |
| `/shuffle` | Mélanger la file d'attente | Tout le monde |
| `/remove` | Retirer une piste de la file | Tout le monde |
| `/seek` | Se déplacer dans la piste (ex: 1m30s) | Tout le monde |
| `/lyrics` | Afficher les paroles de la piste en cours | Tout le monde |
| `/radio` | Écouter une radio (NRJ, FIP, Lofi, Jazz...) | Tout le monde |

---

## 🛠️ UTILITAIRE

| Commande | Description | Permission |
|----------|-------------|------------|
| `/help` | Menu d'aide interactif avec toutes les commandes | Tout le monde |
| `/serverinfo` | Informations détaillées sur le serveur | Tout le monde |
| `/userinfo` | Informations sur un membre | Tout le monde |
| `/avatar` | Voir l'avatar de quelqu'un en grand | Tout le monde |
| `/poll` | Créer un sondage interactif | Gérer les messages |
| `/remind` | Créer un rappel (ex: 1h, 30m) | Tout le monde |
| `/stats` | Statistiques du bot | Tout le monde |
| `/embed` | Créer un message embed personnalisé | Gérer les messages |
| `/snipe` | Voir le dernier message supprimé | Tout le monde |
| `/invites` | Voir ses invitations | Tout le monde |
| `/youtube-notif` | Configurer les notifications YouTube | Admin |
| `/twitch-notif` | Configurer les notifications Twitch | Admin |
| `/customcmd` | Créer des commandes personnalisées | Admin |
| `/logs` | Configurer les logs du serveur | Admin |
| `/starboard setup` | Configurer le starboard | Admin |
| `/starboard desactiver` | Désactiver le starboard | Admin |
| `/starboard statut` | Voir la config starboard | Tout le monde |
| `/tag utiliser` | Utiliser un tag (réponse prédéfinie) | Tout le monde |
| `/tag creer` | Créer un tag | Gérer les messages |
| `/tag modifier` | Modifier un tag | Gérer les messages |
| `/tag supprimer` | Supprimer un tag | Gérer les messages |
| `/tag liste` | Voir tous les tags | Tout le monde |
| `/tag info` | Infos sur un tag | Tout le monde |
| `/highlight ajouter` | Recevoir un DM quand un mot est mentionné | Tout le monde |
| `/highlight retirer` | Retirer un mot clé | Tout le monde |
| `/highlight liste` | Voir ses mots-clés | Tout le monde |
| `/highlight vider` | Effacer tous ses mots-clés | Tout le monde |
| `/autoresponder ajouter` | Ajouter une réponse automatique | Gérer les messages |
| `/autoresponder supprimer` | Supprimer une réponse auto | Gérer les messages |
| `/autoresponder liste` | Voir les réponses auto | Tout le monde |
| `/autoresponder test` | Tester un déclencheur | Tout le monde |
| `/rolemenu creer` | Créer un menu de sélection de rôles | Gérer les rôles |
| `/rolemenu supprimer` | Supprimer un menu | Gérer les rôles |
| `/rolemenu liste` | Voir les menus | Tout le monde |
| `/color` | Visualiser une couleur HEX avec aperçu | Tout le monde |
| `/timestamp` | Générer un timestamp Discord | Tout le monde |
| `/roleinfo` | Informations détaillées sur un rôle | Tout le monde |

---

## 🎮 JEUX

| Commande | Description | Permission |
|----------|-------------|------------|
| `/compter` | Jeu de comptage communautaire | Tout le monde |
| `/devine` | Deviner un nombre aléatoire | Tout le monde |
| `/tictactoe` | Morpion contre un membre ou le bot | Tout le monde |
| `/connect4` | Puissance 4 contre un membre ou le bot | Tout le monde |
| `/wordle` | Deviner un mot en 6 essais (Wordle français) | Tout le monde |
| `/8ball` | Poser une question à la boule magique | Tout le monde |
| `/rps` | Pierre-feuille-ciseaux | Tout le monde |

---

## 😄 SOCIAL

| Commande | Description | Permission |
|----------|-------------|------------|
| `/profil` | Voir son profil complet | Tout le monde |
| `/afk` | Se mettre en AFK avec un message | Tout le monde |
| `/action` | Actions sociales (hug, pat, kiss, slap, wave...) | Tout le monde |
| `/rep` | Donner un point de réputation | Tout le monde |

---

## 🏆 EVENTS & UNIQUE

| Commande | Description | Permission |
|----------|-------------|------------|
| `/giveaway creer` | Lancer un giveaway avec conditions | Admin |
| `/giveaway reroll` | Relancer le tirage au sort | Admin |
| `/giveaway terminer` | Terminer un giveaway manuellement | Admin |
| `/giveaway liste` | Voir les giveaways actifs | Tout le monde |
| `/ticket setup` | Configurer le système de tickets | Admin |
| `/quest creer` | Créer une quête communautaire | Admin |
| `/quest voir` | Voir les quêtes actives | Tout le monde |
| `/reactionrole ajouter` | Ajouter un reaction role | Admin |
| `/reactionrole retirer` | Retirer un reaction role | Admin |
| `/reactionrole liste` | Voir les reaction roles | Tout le monde |
| `/premium activer` | Activer Premium avec un code | Tout le monde |
| `/premium statut` | Voir le statut Premium | Tout le monde |

---

## 📊 STATISTIQUES AUTOMATIQUES (sans commande)

Ces fonctionnalités s'activent automatiquement :

- **Anti-spam** : Détecte 5 messages en 5 secondes → suppression + avertissement
- **Anti-liens** : Supprime les liens pour les non-modérateurs (si activé)
- **Mots interdits** : Filtre personnalisable
- **Highlights** : DM automatique quand un mot-clé est détecté
- **Auto-répondeur** : Réponses automatiques aux messages contenant un déclencheur
- **Starboard** : Épingle automatiquement les messages avec ⭐ (seuil configurable)
- **XP vocal** : Gain d'XP pour le temps passé en vocal
- **Quêtes communautaires** : Progression partagée entre tous les membres
- **Stats channels** : Mise à jour automatique toutes les 10 minutes
- **Notifications YouTube/Twitch** : Vérification toutes les 5 minutes
- **Rappels** : Vérification chaque minute
- **Rapport de santé** : Envoyé chaque dimanche à 9h
- **AFK** : Notification automatique quand un membre AFK est mentionné
