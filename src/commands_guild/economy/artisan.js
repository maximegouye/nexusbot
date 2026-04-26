const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// Système d'artisanat : combiner des ressources pour créer des objets rares
const RECIPES = {
  potion_sante: {
    name: '🧪 Potion de Santé',
    ingredients: { herbe: 3, eau: 2 },
    result: { coins: 200, xp: 50 },
    desc: 'Restaure de l\'énergie — Vaut 200 coins',
  },
  epee_bronze: {
    name: '⚔️ Épée de Bronze',
    ingredients: { metal: 5, bois: 3 },
    result: { coins: 500, xp: 100 },
    desc: 'Une épée solide — Vaut 500 coins',
  },
  anneau_chance: {
    name: '💍 Anneau de Chance',
    ingredients: { pierre_precieuse: 2, fil_or: 3 },
    result: { coins: 1500, xp: 200 },
    desc: 'Porte-bonheur puissant — Vaut 1500 coins',
  },
  armure_dragon: {
    name: '🐉 Armure de Dragon',
    ingredients: { ecaille_dragon: 5, metal_rare: 10, cristal: 3 },
    result: { coins: 8000, xp: 500 },
    desc: 'L\'équipement ultime — Vaut 8000 coins',
  },
};

const RESOURCES = ['herbe', 'eau', 'metal', 'bois', 'pierre_precieuse', 'fil_or', 'ecaille_dragon', 'metal_rare', 'cristal'];
const RESOURCE_EMOJIS = {
  herbe: '🌿', eau: '💧', metal: '⚙️', bois: '🪵',
  pierre_precieuse: '💎', fil_or: '🪢', ecaille_dragon: '🐉',
  metal_rare: '✨', cristal: '🔮',
};

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS ressources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    ${RESOURCES.map(r => `${r} INTEGER DEFAULT 0`).join(', ')},
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('artisan')
    .setDescription('🔨 Artisanat — Collectez des ressources et fabriquez des objets !')
    .addSubcommand(s => s.setName('collecter').setDescription('🌿 Collecter des ressources (cooldown 30s)'))
    .addSubcommand(s => s.setName('ressources').setDescription('📦 Voir vos ressources'))
    .addSubcommand(s => s.setName('recettes').setDescription('📋 Voir les recettes disponibles'))
    .addSubcommand(s => s.setName('fabriquer').setDescription('🔨 Fabriquer un objet')
      .addStringOption(o => o.setName('recette').setDescription('Nom de la recette').setRequired(true)
        .addChoices(...Object.keys(RECIPES).map(k => ({ name: RECIPES[k].name, value: k }))))),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';
    const now = Math.floor(Date.now() / 1000);

    let res = db.db.prepare('SELECT * FROM ressources WHERE guild_id=? AND user_id=?').get(guildId, userId);
    if (!res) {
      db.db.prepare('INSERT INTO ressources (guild_id, user_id) VALUES (?,?)').run(guildId, userId);
      res = db.db.prepare('SELECT * FROM ressources WHERE guild_id=? AND user_id=?').get(guildId, userId);
    }

    if (sub === 'collecter') {
      // Cooldown via user data
      const u = db.getUser(userId, guildId);
      const lastCollect = u.last_collect_artisan || 0;
      const cd = 30 - (now - lastCollect);
      if (cd > 0) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `⏳ Réessayez dans **${cd}s**.`, ephemeral: true });

      // Collecter 1-3 ressources aléatoires
      const amount = Math.floor(Math.random() * 3) + 1;
      const collected = {};
      for (let i = 0; i < amount; i++) {
        const res_type = RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
        collected[res_type] = (collected[res_type] || 0) + 1;
      }

      // Mise à jour
      const updates = Object.entries(collected).map(([k, v]) => `${k}=${k}+${v}`).join(', ');
      db.db.prepare(`UPDATE ressources SET ${updates} WHERE guild_id=? AND user_id=?`).run(guildId, userId);

      try {
        db.db.prepare('UPDATE users SET last_collect_artisan=? WHERE user_id=? AND guild_id=?').run(now, userId, guildId);
      } catch {
        try { db.db.prepare('ALTER TABLE users ADD COLUMN last_collect_artisan INTEGER DEFAULT 0').run(); } catch {}
        db.db.prepare('UPDATE users SET last_collect_artisan=? WHERE user_id=? AND guild_id=?').run(now, userId, guildId);
      }

      const collectedStr = Object.entries(collected).map(([k, v]) => `${RESOURCE_EMOJIS[k]} ${v}x ${k}`).join(', ');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('🌿 Ressources collectées !')
          .setDescription(collectedStr)
      ]});
    }

    if (sub === 'ressources') {
      const lines = RESOURCES.map(r => `${RESOURCE_EMOJIS[r]} **${r}** : ${res[r] || 0}`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#8B4513').setTitle('📦 Votre Stock de Ressources').setDescription(lines)
      ], ephemeral: true });
    }

    if (sub === 'recettes') {
      const lines = Object.entries(RECIPES).map(([k, r]) => {
        const ing = Object.entries(r.ingredients).map(([res, q]) => `${RESOURCE_EMOJIS[res]} ${q}x ${res}`).join(', ');
        return `${r.name}\n> Recette: ${ing}\n> Résultat: **${r.result.coins} ${coin}** + **${r.result.xp} XP**\n> ${r.desc}`;
      }).join('\n\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('📋 Recettes d\'Artisanat').setDescription(lines)
      ], ephemeral: true });
    }

    if (sub === 'fabriquer') {
      const recetteId = interaction.options.getString('recette');
      const recette = RECIPES[recetteId];

      // Vérifier les ressources
      for (const [r, q] of Object.entries(recette.ingredients)) {
        if ((res[r] || 0) < q) {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Ressources insuffisantes ! Vous manquez de **${RESOURCE_EMOJIS[r]} ${r}** (besoin: ${q}, avez: ${res[r] || 0}).`, ephemeral: true });
        }
      }

      // Soustraire les ressources et donner la récompense
      const updates = Object.entries(recette.ingredients).map(([k, v]) => `${k}=${k}-${v}`).join(', ');
      db.db.prepare(`UPDATE ressources SET ${updates} WHERE guild_id=? AND user_id=?`).run(guildId, userId);
      db.addCoins(userId, guildId, recette.result.coins);
      db.addXP(userId, guildId, recette.result.xp);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('🔨 Objet fabriqué !')
          .setDescription(`Vous avez fabriqué **${recette.name}** !\n${recette.desc}`)
          .addFields(
            { name: '💰 Gain', value: `+${recette.result.coins} ${coin}`, inline: true },
            { name: '⭐ XP', value: `+${recette.result.xp} XP`, inline: true },
          )
      ]});
    }
  },


  // Prefix-only: accessible via &artisan (not registered as slash command)
  _prefixOnly: true,
  name: 'artisan',
};