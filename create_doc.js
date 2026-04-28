const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, 
        BorderStyle, WidthType, ShadingType, HeadingLevel, Header, Footer, PageNumber } = require('docx');
const fs = require('fs');

const commands = {
  "Administration": [
    {"name": "additem", "description": "🛒 Ajouter un article à la boutique"},
    {"name": "announce", "description": "📢 Créer une annonce professionnelle"},
    {"name": "backup", "description": "💾 Sauvegarder et restaurer la configuration du serveur"},
    {"name": "massrole", "description": "👥 Ajouter/Retirer un rôle à tous les membres"},
    {"name": "setup", "description": "⚙️ Configuration rapide de NexusBot"},
    {"name": "statschannel", "description": "📊 Configurer les salons de stats du serveur"},
    {"name": "wizard", "description": "🧙 Assistant de configuration guidé"},
    {"name": "xpmult", "description": "⭐ Configurer le multiplicateur de XP par rôle"}
  ],
  "Intelligence Artificielle": [
    {"name": "ia", "description": "Ta question"},
    {"name": "resume", "description": "Salon à résumer"},
    {"name": "traduis", "description": "🌍 Traduit un texte vers une autre langue"}
  ],
  "Économie": [
    {"name": "balance", "description": "Consulter le solde"},
    {"name": "banque", "description": "🏦 Ta banque NexusBot"},
    {"name": "blackjack", "description": "♠♥ Blackjack"},
    {"name": "braquage", "description": "Tenter un braquage"},
    {"name": "casino", "description": "🎰 Casino NexusBot"},
    {"name": "coinflip", "description": "💶 Lancer un défi pile ou face"},
    {"name": "crash", "description": "📈 Jeu du Crash"},
    {"name": "crime", "description": "🦹 Tenter une activité illégale"},
    {"name": "crypto", "description": "💰 Marché crypto"},
    {"name": "daily", "description": "📅 Récompense quotidienne"},
    {"name": "des", "description": "🎲 Lance 2 dés"},
    {"name": "duel", "description": "⚔️ Défie un membre en duel"},
    {"name": "historique", "description": "Consulter l'historique"},
    {"name": "inventory", "description": "🎒 Affiche ton inventaire"},
    {"name": "lotto", "description": "🎟️ Loterie hebdomadaire"},
    {"name": "market", "description": "🏪 Marché joueur-à-joueur"},
    {"name": "mines", "description": "💣 Démineur casino"},
    {"name": "pecher", "description": "🎣 Lance ta ligne"},
    {"name": "poker", "description": "🎴 Video Poker"},
    {"name": "rob", "description": "🥷 Tente de voler des euros"},
    {"name": "roue", "description": "🎡 Roue de la fortune"},
    {"name": "slots", "description": "🎰 Machine à sous"},
    {"name": "transfer", "description": "💸 Envoie des euros"},
    {"name": "work", "description": "💼 Travaille pour gagner"}
  ],
  "Jeux et Amusement": [
    {"name": "8ball", "description": "🎱 Pose une question à la boule magique"},
    {"name": "rps", "description": "🪨 Pierre-Feuille-Ciseaux"},
    {"name": "connect4", "description": "🔴🟡 Puissance 4"},
    {"name": "devine", "description": "🔮 Devine un nombre"},
    {"name": "tictactoe", "description": "❌⭕ Morpion"},
    {"name": "verite-ou-defi", "description": "💬 Vérité ou défi"}
  ],
  "Niveaux et Progression": [
    {"name": "leaderboard", "description": "🏆 Classement du serveur"},
    {"name": "levelrole", "description": "🎭 Rôles automatiques par niveau"},
    {"name": "rank", "description": "⭐ Carte de rang"},
    {"name": "setlevel", "description": "Définir le niveau"},
    {"name": "setxp", "description": "Définir l'XP"},
    {"name": "xpboost", "description": "⚡ Multiplicateur de XP"},
    {"name": "xpconfig", "description": "⚙️ Configuration XP"}
  ],
  "Modération": [
    {"name": "antinuke", "description": "🛡️ Protection anti-nuke"},
    {"name": "automod", "description": "Configuration modération auto"},
    {"name": "ban", "description": "🔨 Bannir un membre"},
    {"name": "cases", "description": "📋 Historique sanctions"},
    {"name": "clear", "description": "🗑️ Supprimer messages"},
    {"name": "clearwarns", "description": "Nettoyer avertissements"},
    {"name": "kick", "description": "👢 Expulser un membre"},
    {"name": "lock", "description": "🔒 Verrouiller salon"},
    {"name": "lockdown", "description": "🔒 Verrouiller serveur"},
    {"name": "massban", "description": "🔨 Bannir plusieurs"},
    {"name": "mute", "description": "🔇 Rendre muet"},
    {"name": "note", "description": "📝 Notes modération"},
    {"name": "nuke", "description": "Supprimer messages"},
    {"name": "slowmode", "description": "🐌 Mode lent"},
    {"name": "tempban", "description": "⛔ Bannissement temp"},
    {"name": "temprole", "description": "⏳ Rôle temporaire"},
    {"name": "timeout", "description": "⏱️ Sourdine temp"},
    {"name": "unban", "description": "🔓 Débannir"},
    {"name": "warn", "description": "⚠️ Avertir"},
    {"name": "warnings", "description": "Voir avertissements"}
  ],
  "Premium": [
    {"name": "premium", "description": "Gère votre abonnement premium"}
  ],
  "Social": [
    {"name": "actions", "description": "Effectuer une action"},
    {"name": "afk", "description": "Marquer absence"},
    {"name": "mariage", "description": "💍 Système mariage"},
    {"name": "profil", "description": "✨ Carte profil"},
    {"name": "setbio", "description": "✏️ Modifier bio"},
    {"name": "ship", "description": "💘 Compatibilité"}
  ],
  "Systèmes Spéciaux": [
    {"name": "anniversaire", "description": "🎂 Gestion anniversaires"},
    {"name": "birthday", "description": "🎂 Anniversaires"},
    {"name": "bump", "description": "Bump serveur"},
    {"name": "confession", "description": "Confessions anonymes"},
    {"name": "giveaway", "description": "🎉 Giveaways"},
    {"name": "health", "description": "📊 Santé serveur"},
    {"name": "quest", "description": "🗺️ Quêtes communautaires"},
    {"name": "reactionrole", "description": "🎭 Rôles réaction"},
    {"name": "rep", "description": "⭐ Réputation"},
    {"name": "suggestion", "description": "💡 Suggestions"},
    {"name": "tempvoice", "description": "Salons vocaux temp"},
    {"name": "ticket", "description": "Support tickets"}
  ],
  "Utilitaires": [
    {"name": "aide", "description": "📚 Aide interactive"},
    {"name": "autoresponder", "description": "🤖 Réponses auto"},
    {"name": "avatar", "description": "Avatar"},
    {"name": "cfgset", "description": "Configuration"},
    {"name": "color", "description": "🎨 Visualiser couleur"},
    {"name": "convertir", "description": "🔢 Convertisseur"},
    {"name": "customcmd", "description": "🤖 Commandes perso"},
    {"name": "embed", "description": "📝 Créer embed"},
    {"name": "logs", "description": "📋 Canaux logs"},
    {"name": "meteo", "description": "🌡️ Météo"},
    {"name": "notes", "description": "📝 Bloc-notes"},
    {"name": "poll", "description": "📊 Sondage"},
    {"name": "rappel", "description": "⏰ Rappels"},
    {"name": "roleinfo", "description": "🎭 Info rôle"},
    {"name": "serverinfo", "description": "📊 Info serveur"},
    {"name": "starboard", "description": "Starboard"},
    {"name": "stats", "description": "📈 Stats bot"},
    {"name": "timestamp", "description": "Date/heure"},
    {"name": "traduction", "description": "🌍 Traductions"},
    {"name": "userinfo", "description": "Info utilisateur"},
    {"name": "wiki", "description": "📚 Wikipédia"}
  ]
};

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

const children = [];

// Titre principal
children.push(
  new Paragraph({
    text: "NexusBot",
    style: "Heading1",
    alignment: AlignmentType.CENTER,
    spacing: { after: 0 }
  })
);

children.push(
  new Paragraph({
    text: "Liste Complète des Commandes",
    style: "Heading2",
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 }
  })
);

// Date
children.push(
  new Paragraph({
    text: `28 avril 2026`,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    run: { size: 20, color: "666666" }
  })
);

// Pour chaque catégorie
for (const [category, cmds] of Object.entries(commands)) {
  // Titre catégorie
  children.push(
    new Paragraph({
      text: category,
      style: "Heading2",
      spacing: { before: 200, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "5865F2", space: 1 } }
    })
  );

  // Tableau des commandes
  const rows = [];
  
  // Header
  rows.push(
    new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: 2200, type: WidthType.DXA },
          shading: { fill: "5865F2", type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({
              text: "Commande",
              bold: true,
              color: "FFFFFF",
              size: 22
            })]
          })]
        }),
        new TableCell({
          borders,
          width: { size: 4680, type: WidthType.DXA },
          shading: { fill: "5865F2", type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({
              text: "Description",
              bold: true,
              color: "FFFFFF",
              size: 22
            })]
          })]
        })
      ]
    })
  );

  // Lignes de commandes
  for (const cmd of cmds) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            borders,
            width: { size: 2200, type: WidthType.DXA },
            shading: { fill: "F0F2F5", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({
              children: [new TextRun({
                text: `/${cmd.name}`,
                bold: true,
                color: "1F2937",
                size: 20
              })]
            })]
          }),
          new TableCell({
            borders,
            width: { size: 4680, type: WidthType.DXA },
            shading: { fill: "FFFFFF", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({
              children: [new TextRun({
                text: cmd.description,
                size: 20,
                color: "374151"
              })]
            })]
          })
        ]
      })
    );
  }

  children.push(
    new Table({
      width: { size: 6880, type: WidthType.DXA },
      columnWidths: [2200, 4680],
      rows
    })
  );

  children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
}

const doc = new Document({
  sections: [{
    properties: {
      page: {
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            text: "NexusBot - Commandes Discord",
            spacing: { after: 100 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "5865F2" } },
            run: { size: 20, color: "5865F2", bold: true }
          })
        ]
      })
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Page ",
                size: 20,
                color: "999999"
              }),
              new TextRun({
                children: [PageNumber.CURRENT],
                size: 20,
                color: "999999"
              })
            ]
          })
        ]
      })
    },
    children
  }],
  styles: {
    default: {
      document: {
        run: { font: "Arial", size: 24 }
      }
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 48, bold: true, font: "Arial", color: "5865F2" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 }
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "2D3748" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 }
      }
    ]
  }
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/sessions/beautiful-eager-rubin/mnt/outputs/NexusBot_Commandes.docx", buffer);
  console.log("Document créé avec succès!");
});
