const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS investissements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    type TEXT, amount INTEGER,
    return_at INTEGER, multiplier REAL,
    collected INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

const INVESTMENTS = {
  epargne:    { label: '💵 Livret Épargne',    duration: 86400,    mult: 1.04, risk: 0,    desc: 'Sûr, +4% en 24h' },
  actions:    { label: '📈 Portefeuille Actions', duration: 172800, mult: 1.15, risk: 0.2,  desc: '+15% en 2j (risque moyen)' },
  startup:    { label: '🚀 Startup',           duration: 259200,   mult: 1.35, risk: 0.35, desc: '+35% en 3j (risque élevé)' },
  crypto_inv: { label: '₿ Crypto Investissement', duration: 43200, mult: 1.25, risk: 0.45, desc: '+25% en 12h (très risqué)' },
  immo:       { label: '🏠 Immobilier',        duration: 604800,   mult: 1.50, risk: 0.1,  desc: '+50% en 7j (risque faible)' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('investir')
    .setDescription('📈 Investissez vos coins pour les faire fructifier !')
    .addSubcommand(s => s.setName('placer').setDescription('💰 Placer un investissement')
      .addStringOption(o => o.setName('type').setDescription('Type d\'investissement').setRequired(true)
        .addChoices(
          { name: '💵 Livret Épargne — +4% / 24h (sans risque)', value: 'epargne' },
          { name: '📈 Actions — +15% / 2j (risque moyen)', value: 'actions' },
          { name: '🚀 Startup — +35% / 3j (risque élevé)', value: 'startup' },
          { name: '₿ Crypto — +25% / 12h (très risqué)', value: 'crypto_inv' },
          { name: '🏠 Immobilier — +50% / 7j (risque faible)', value: 'immo' },
        )))
    .addSubcommand(s => s.setName('portefeuille').setDescription('💼 Voir vos investissements actifs'))
    .addSubcommand(s => s.setName('collecter').setDescription('💰 Collecter les investissements arrivés à maturité'))
    .addSubcommand(s => s.setName('options').setDescription('📊 Voir tous les types d\'investissement')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';
    const now = Math.floor(Date.now() / 1000);

    if (sub === 'options') {
      const lines = Object.entries(INVESTMENTS).map(([k, v]) => {
        const d = v.duration >= 86400 ? `${v.duration/86400}j` : `${v.duration/3600}h`;
        return `${v.label}\n> ${v.desc} | Durée: ${d} | Risque: ${v.risk === 0 ? '✅ Nul' : v.risk < 0.2 ? '🟡 Faible' : v.risk < 0.4 ? '🟠 Moyen' : '🔴 Élevé'}`;
      }).join('\n\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('📈 Types d\'Investissement').setDescription(lines)
      ], ephemeral: true });
    }

    if (sub === 'placer') {
      const type = interaction.options.getString('type');
      const montant = parseInt(interaction.options.getString('montant'));
      const inv = INVESTMENTS[type];
      const u = db.getUser(userId, guildId);

      if (u.balance < montant) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Solde insuffisant (**${u.balance} ${coin}**).`, ephemeral: true });

      const active = db.db.prepare("SELECT COUNT(*) as c FROM investissements WHERE guild_id=? AND user_id=? AND collected=0").get(guildId, userId);
      if (active.c >= 5) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Maximum 5 investissements simultanés.', ephemeral: true });

      // Simuler le risque : peut perdre une partie
      const isFailed = Math.random() < inv.risk;
      const actualMult = isFailed ? 0.7 : inv.mult; // perd 30% si échec

      db.addCoins(userId, guildId, -montant);
      const returnAt = now + inv.duration;
      const expectedReturn = Math.floor(montant * actualMult);

      db.db.prepare('INSERT INTO investissements (guild_id, user_id, type, amount, return_at, multiplier) VALUES (?,?,?,?,?,?)')
        .run(guildId, userId, type, montant, returnAt, actualMult);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Investissement placé !')
          .addFields(
            { name: inv.label, value: `**${montant} ${coin}** investis`, inline: true },
            { name: '📅 Maturité', value: `<t:${returnAt}:R>`, inline: true },
            { name: '💰 Retour estimé', value: `**~${expectedReturn} ${coin}**`, inline: true },
          )
          .setFooter({ text: 'Le retour réel peut varier selon le marché' })
      ]});
    }

    if (sub === 'portefeuille') {
      const invs = db.db.prepare("SELECT * FROM investissements WHERE guild_id=? AND user_id=? AND collected=0 ORDER BY return_at ASC").all(guildId, userId);
      if (!invs.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '📈 Aucun investissement actif.', ephemeral: true });

      let totalInvested = 0;
      const lines = invs.map(i => {
        const inv = INVESTMENTS[i.type];
        const ready = now >= i.return_at;
        const expected = Math.floor(i.amount * i.multiplier);
        totalInvested += i.amount;
        return `${inv.label}\n> Investi: **${i.amount} ${coin}** | Retour: **~${expected} ${coin}** | ${ready ? '✅ **PRÊT**' : `<t:${i.return_at}:R>`}`;
      }).join('\n\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('💼 Votre Portefeuille d\'Investissements')
          .setDescription(lines)
          .addFields({ name: '💰 Total investi', value: `${totalInvested} ${coin}`, inline: true })
      ], ephemeral: true });
    }

    if (sub === 'collecter') {
      const ready = db.db.prepare("SELECT * FROM investissements WHERE guild_id=? AND user_id=? AND collected=0 AND return_at<=?").all(guildId, userId, now);
      if (!ready.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '⏳ Aucun investissement arrivé à maturité.', ephemeral: true });

      let total = 0;
      const lines = [];
      for (const i of ready) {
        const returns = Math.floor(i.amount * i.multiplier);
        const profit = returns - i.amount;
        const inv = INVESTMENTS[i.type];
        db.addCoins(userId, guildId, returns);
        db.db.prepare('UPDATE investissements SET collected=1 WHERE id=?').run(i.id);
        total += returns;
        lines.push(`${inv.label} : **+${returns} ${coin}** (${profit >= 0 ? '+' : ''}${profit} ${coin})`);
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('💰 Investissements collectés !')
          .setDescription(lines.join('\n'))
          .addFields({ name: '💎 Total reçu', value: `**${total} ${coin}**`, inline: true })
      ]});
    }
  }
};
