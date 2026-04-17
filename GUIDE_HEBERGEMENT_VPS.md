# 🖥️ Guide Hébergement VPS — NexusBot 24/7

## Pourquoi un VPS ?

Ton Mac doit rester allumé pour que le bot tourne. Un VPS (serveur virtuel dédié) = un serveur Linux qui tourne 24h/24, 7j/7, même quand ton Mac est éteint.

**Coût : environ 4-5€/mois** (moins cher qu'un abonnement Spotify)

---

## 1. Choisir et créer ton VPS

### Recommandé : Hetzner Cloud (4,35€/mois)
- Va sur [hetzner.com/cloud](https://www.hetzner.com/cloud)
- Crée un compte (gratuit, tu as 20€ offerts au début)
- Crée un serveur :
  - **Location** : Helsinki ou Nuremberg (le plus proche)
  - **OS** : Ubuntu 22.04 LTS
  - **Type** : CX11 (2 vCPU, 2 GB RAM) — amplement suffisant
  - **SSH Key** : génère une clé SSH ou utilise un mot de passe
- Note l'adresse IP du serveur (ex: `65.21.xxx.xxx`)

---

## 2. Se connecter au serveur

Ouvre le Terminal sur ton Mac et tape :

```bash
ssh root@TON_IP
```

Remplace `TON_IP` par l'IP de ton serveur. Tape `yes` quand il demande la confirmation.

---

## 3. Installer Node.js sur le serveur

```bash
# Mettre à jour le système
apt update && apt upgrade -y

# Installer Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Vérifier l'installation
node --version    # doit afficher v20.x.x
npm --version     # doit afficher 10.x.x
```

---

## 4. Installer PM2 (gestionnaire de processus)

PM2 redémarre automatiquement le bot s'il plante, et le relance après un reboot du serveur.

```bash
npm install -g pm2
```

---

## 5. Envoyer les fichiers du bot sur le VPS

Sur ton Mac, ouvre un Terminal **dans le dossier NexusBot** et tape :

```bash
# Copier le dossier NexusBot sur le VPS
scp -r /Users/maxime/Downloads/NexusBot root@TON_IP:/root/nexusbot
```

---

## 6. Configurer et lancer le bot

De retour dans le terminal SSH :

```bash
# Aller dans le dossier
cd /root/nexusbot

# Installer les dépendances
npm install

# Démarrer avec PM2
pm2 start src/index.js --name "NexusBot"

# Activer le démarrage automatique au reboot
pm2 startup
pm2 save
```

---

## 7. Commandes PM2 utiles

| Commande | Description |
|----------|-------------|
| `pm2 status` | Voir si le bot tourne |
| `pm2 logs NexusBot` | Voir les logs en direct |
| `pm2 restart NexusBot` | Redémarrer le bot |
| `pm2 stop NexusBot` | Arrêter le bot |
| `pm2 delete NexusBot` | Supprimer le processus |

---

## 8. Mettre à jour le bot

Quand tu fais des modifications sur ton Mac :

```bash
# Renvoyer les fichiers modifiés
scp -r /Users/maxime/Downloads/NexusBot root@TON_IP:/root/nexusbot

# Sur le serveur SSH, redémarrer
pm2 restart NexusBot
```

---

## 9. Sécuriser ton serveur (optionnel mais recommandé)

```bash
# Changer le port SSH (plus difficile à pirater)
# Configurer un firewall basique
ufw allow 22/tcp     # SSH
ufw enable
```

---

## 📊 Résumé des coûts

| Service | Coût | Fréquence |
|---------|------|-----------|
| Hetzner CX11 | 4,35€ | /mois |
| Nom de domaine (optionnel) | 10-15€ | /an |
| **Total** | **~4-5€** | **/mois** |

---

## 💰 Comment gagner de l'argent avec NexusBot

### Option 1 — Premium par serveur (déjà implémenté !)
- Les serveurs paient pour débloquer les thèmes exclusifs, plus de fonctionnalités
- Tu génères des codes avec `/genpremium` et tu les vends
- Prix suggéré : 3-5€/mois par serveur
- Avec 20 serveurs Premium = **60-100€/mois passif**

### Option 2 — top.gg (votes = visibilité gratuite)
1. Va sur [top.gg](https://top.gg) → Add a Bot
2. Remplis le profil du bot (description, tags, screenshots)
3. Les utilisateurs votent → ton bot remonte dans les classements
4. Plus de votes = plus d'installations = plus de serveurs Premium potentiels

### Option 3 — bot.gg, discordbotlist.com
- Même principe que top.gg, liste le bot sur plusieurs sites

### Étapes pour lister le bot :
1. Va sur top.gg → Connexion avec Discord
2. "Add your bot" → Entre le CLIENT_ID : `1493962497437466716`
3. Remplis : description, catégories (Music, Economy, Leveling, Moderation)
4. Upload un avatar et une bannière
5. Ajoute le lien d'invitation du bot

### Lien d'invitation du bot :
```
https://discord.com/oauth2/authorize?client_id=1493962497437466716&permissions=8&scope=bot%20applications.commands
```

---

## ✅ Checklist finale

- [ ] Compte Hetzner créé
- [ ] VPS CX11 Ubuntu 22.04 créé
- [ ] Node.js 20 installé sur le VPS
- [ ] PM2 installé et configuré
- [ ] Fichiers du bot copiés sur le VPS
- [ ] Bot démarré avec `pm2 start`
- [ ] `pm2 startup && pm2 save` exécuté (démarrage auto)
- [ ] Bot listé sur top.gg
- [ ] Premier code Premium généré avec `/genpremium`

---

*NexusBot v2 — Guide hébergement. En cas de problème, rejoins le serveur de support.*
