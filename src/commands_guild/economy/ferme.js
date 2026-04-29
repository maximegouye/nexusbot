const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS ferme (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    slot1 TEXT, slot1_planted_at INTEGER,
    slot2 TEXT, slot2_planted_at INTEGER,
    slot3 TEXT, slot3_planted_at INTEGER,
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

const CROPS = {
  ble:       { emoji: '🌾', name: 'Blé',       growTime: 3600,   reward: 80,   cost: 10 },
  carotte:   { emoji: '🥕', name: 'Carotte',   growTime: 7200,   reward: 150,  cost: 20 },
  tomate:    { emoji: '🍅', name: 'Tomate',    growTime: 10800,  reward: 250,  cost: 35 },
  maïs:      { emoji: '🌽', name: 'Maïs',      growTime: 14400,  reward: 350,  cost: 50 },
  fraise:    { emoji: '🍓', name: 'Fraise',    growTime: 21600,  reward: 500,  cost: 70 },
  citrouille:{ emoji: '🎃', name: 'Citrouille',growTime: 43200,  reward: 1000, cost: 120 },
  diamant:   { emoji: '💎', name: 'Diamant',   growTime: 86400,  reward: 5000, cost: 500 },
};

function formatTime(sec) {
  if (sec <= 0) return '✅ Prêt !';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ferme')
    .setDescription('🌱 Gérez votre ferme virtuelle — Plantez et récoltez !')
    .addSubcommand(s => s.setName('voir').setDescription('🌱 Voir l\'état de votre ferme'))
    .addSubcommand(s => s.setName('planter').setDescription('🌱 Planter une graine dans un slot')
      .addIntegerOption(o => o.setName('slot').setDescription('Numéro du slot (1, 2 ou 3)').setMinValue(1).setMaxValue(3).setRequired(true))
      .addStringOption(o => o.setName('culture').setDescription('Type de culture').setRequired(true)
        .addChoices(
          { name: '🌾 Blé (1h → 80🪙)', value: 'ble' },
          { name: '🥕 Carotte (2h → 150🪙)', value: 'carotte' },
          { name: '🍅 Tomate (3h → 250🪙)', value: 'tomate' },
          { name: '🌽 Maïs (4h → 350🪙)', value: 'maïs' },
          { name: '🍓 Fraise (6h → 500🪙)', value: 'fraise' },
          { name: '🎃 Citrouille (12h → 1000🪙)', value: 'citrouille' },
          { name: '💎 Diamant (24h → 5000🪙)', value: 'diamant' },
        )))
    .addSubcommand(s => s.setName('recolter').setDescription('🌾 Récolter toutes les cultures prêtes'))
    .addSubcommand(s => s.setName('cultures').setDescription('📋 Voir toutes les cultures disponibles')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';
    const now = Math.floor(Date.now() / 1000);

    // S'assurer que l'entrée existe
    let ferme = db.db.prepare('SELECT * FROM ferme WHERE guild_id=? AND user_id=?').get(guildId, userId);
    if (!ferme) {
      db.db.prepare('INSERT INTO ferme (guild_id, user_id) VALUES (?,?)').run(guildId, userId);
      ferme = db.db.prepare('SELECT * FROM ferme WHERE guild_id=? AND user_id=?').get(guildId, userId);
    }

    function getSlotDisplay(slot) {
      const type = ferme[`slot${slot}`];
      const plantedAt = ferme[`slot${slot}_planted_at`];
      if (!type) return '🟫 Vide';
      const crop = CROPS[type];
      const elapsed = now - plantedAt;
      if (elapsed >= crop.growTime) return `${crop.emoji} **${crop.name}** ✅ PRÊT !`;
      const remaining = crop.growTime - elapsed;
      return `${crop.emoji} **${crop.name}** ⏳ ${formatTime(remaining)}`;
    }

    if (sub === 'voir') {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('🌱 Votre Ferme')
          .addFields(
            { name: 'Slot 1', value: getSlotDisplay(1), inline: true },
            { name: 'Slot 2', value: getSlotDisplay(2), inline: true },
            { name: 'Slot 3', value: getSlotDisplay(3), inline: true },
          )
          .setFooter({ text: 'Plantez avec /ferme planter • Récoltez avec /ferme recolter' })
      ], ephemeral: true });
    }

    if (sub === 'planter') {
      const slot = interaction.options.getInteger('slot');
      const culture = interaction.options.getString('culture');
      const crop = CROPS[culture];

      if (ferme[`slot${slot}`]) {
        const existType = ferme[`slot${slot}`];
        const existCrop = CROPS[existType];
        const elapsed = now - ferme[`slot${slot}_planted_at`];
        if (elapsed < existCrop.growTime) {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Slot ${slot} occupé par **${existCrop.emoji} ${existCrop.name}**. Récoltez d'abord !`, ephemeral: true });
        }
      }

      const u = db.getUser(userId, guildId);
      if (u.balance < crop.cost) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Solde insuffisant. Coût : **${crop.cost} ${coin}**.`, ephemeral: true });

      db.removeCoins(userId, guildId, crop.cost);
      db.db.prepare(`UPDATE ferme SET slot${slot}=?, slot${slot}_planted_at=? WHERE guild_id=? AND user_id=?`).run(culture, now, guildId, userId);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#27AE60').setTitle('🌱 Culture plantée !')
          .setDescription(`**${crop.emoji} ${crop.name}** planté(e) dans le slot **${slot}** !\nCoût : **${crop.cost} ${coin}** | Récolte dans **${formatTime(crop.growTime)}** | Gain : **${crop.reward} ${coin}**`)
      ]});
    }

    if (sub === 'recolter') {
      let totalGain = 0;
      const recoltes = [];

      for (let s = 1; s <= 3; s++) {
        const type = ferme[`slot${s}`];
        if (!type) continue;
        const crop = CROPS[type];
        const elapsed = now - ferme[`slot${s}_planted_at`];
        if (elapsed >= crop.growTime) {
          totalGain += crop.reward;
          recoltes.push(`${crop.emoji} **${crop.name}** → +${crop.reward} ${coin}`);
          db.db.prepare(`UPDATE ferme SET slot${s}=NULL, slot${s}_planted_at=NULL WHERE guild_id=? AND user_id=?`).run(guildId, userId);
        }
      }

      if (!recoltes.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune culture prête à récolter.', ephemeral: true });

      db.addCoins(userId, guildId, totalGain);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('🌾 Récolte effectuée !')
          .setDescription(recoltes.join('\n'))
          .addFields({ name: '💰 Total gagné', value: `**+${totalGain} ${coin}**`, inline: true })
      ]});
    }

    if (sub === 'cultures') {
      const lines = Object.entries(CROPS).map(([, c]) => {
        return `${c.emoji} **${c.name}** — Coût: ${c.cost} ${coin} | Durée: ${formatTime(c.growTime)} | Gain: **${c.reward} ${coin}**`;
      }).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#27AE60').setTitle('🌱 Cultures disponibles').setDescription(lines)
      ], ephemeral: true });
    }
  }
};
