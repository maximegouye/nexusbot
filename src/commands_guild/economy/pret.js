const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS prets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    amount INTEGER, interest REAL DEFAULT 0.10,
    due_at INTEGER, repaid INTEGER DEFAULT 0,
    taken_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

const LOAN_TIERS = [
  { level: 1,  max: 500,    duration: 86400,   interest: 0.05 },
  { level: 5,  max: 2000,   duration: 172800,  interest: 0.08 },
  { level: 10, max: 10000,  duration: 259200,  interest: 0.10 },
  { level: 20, max: 50000,  duration: 432000,  interest: 0.12 },
  { level: 50, max: 250000, duration: 604800,  interest: 0.15 },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pret')
    .setDescription('🏦 Système de prêts — Empruntez des coins avec intérêts')
    .addSubcommand(s => s.setName('emprunter').setDescription('💸 Emprunter des coins'))
    .addSubcommand(s => s.setName('rembourser').setDescription('💰 Rembourser votre prêt actif'))
    .addSubcommand(s => s.setName('statut').setDescription('📋 Voir votre situation de prêt'))
    .addSubcommand(s => s.setName('taux').setDescription('📊 Voir les taux selon votre niveau')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';
    const now = Math.floor(Date.now() / 1000);

    const u = db.getUser(userId, guildId);
    const level = u.level || 1;

    // Trouver le tier selon le niveau
    let tier = LOAN_TIERS[0];
    for (const t of LOAN_TIERS) { if (level >= t.level) tier = t; }

    if (sub === 'taux') {
      const lines = LOAN_TIERS.map(t => {
        const d = Math.floor(t.duration / 86400);
        return `Niv.**${t.level}+** — Max: ${t.max} ${coin} | Durée: ${d} jour(s) | Intérêt: ${t.interest * 100}%`;
      }).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('🏦 Taux de prêts')
          .setDescription(lines)
          .addFields({ name: '🎯 Votre niveau', value: `Niv.**${level}** → Max **${tier.max} ${coin}** à **${tier.interest * 100}%**`, inline: false })
      ], ephemeral: true });
    }

    if (sub === 'emprunter') {
      const active = db.db.prepare("SELECT * FROM prets WHERE guild_id=? AND user_id=? AND repaid=0").get(guildId, userId);
      if (active) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous avez déjà un prêt actif ! Remboursez-le d\'abord.', ephemeral: true });

      const montant = parseInt(interaction.options.getString('montant'));
      if (montant > tier.max) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Maximum **${tier.max} ${coin}** pour votre niveau (${level}).`, ephemeral: true });

      const dueAt = now + tier.duration;
      const toRepay = Math.floor(montant * (1 + tier.interest));

      db.db.prepare('INSERT INTO prets (guild_id, user_id, amount, interest, due_at) VALUES (?,?,?,?,?)').run(guildId, userId, toRepay, tier.interest, dueAt);
      db.addCoins(userId, guildId, montant);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('💸 Prêt accordé !')
          .addFields(
            { name: '💰 Reçu', value: `+${montant} ${coin}`, inline: true },
            { name: '💳 À rembourser', value: `**${toRepay} ${coin}**`, inline: true },
            { name: '📅 Délai', value: `<t:${dueAt}:R>`, inline: true },
            { name: '📊 Intérêts', value: `${tier.interest * 100}% (${toRepay - montant} ${coin})`, inline: true },
          )
          .setFooter({ text: '⚠️ Passé le délai, une pénalité sera appliquée' })
      ]});
    }

    if (sub === 'rembourser') {
      const pret = db.db.prepare("SELECT * FROM prets WHERE guild_id=? AND user_id=? AND repaid=0").get(guildId, userId);
      if (!pret) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '✅ Vous n\'avez aucun prêt actif.', ephemeral: true });

      // Pénalité si en retard
      let toRepay = pret.amount;
      let penaltyMsg = '';
      if (now > pret.due_at) {
        const overdue = Math.floor((now - pret.due_at) / 86400) + 1;
        const penalty = Math.floor(pret.amount * 0.05 * overdue);
        toRepay += penalty;
        penaltyMsg = ` (+${penalty} ${coin} de pénalité de retard)`;
      }

      if (u.balance < toRepay) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Solde insuffisant. Vous devez **${toRepay} ${coin}**${penaltyMsg}.`, ephemeral: true });

      db.addCoins(userId, guildId, -toRepay);
      db.db.prepare('UPDATE prets SET repaid=1 WHERE id=?').run(pret.id);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Prêt remboursé !')
          .setDescription(`Vous avez remboursé **${toRepay} ${coin}**${penaltyMsg}.`)
          .addFields({ name: '👛 Nouveau solde', value: `${u.balance - toRepay} ${coin}`, inline: true })
      ]});
    }

    if (sub === 'statut') {
      const pret = db.db.prepare("SELECT * FROM prets WHERE guild_id=? AND user_id=? AND repaid=0").get(guildId, userId);
      if (!pret) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '✅ Aucun prêt actif.', ephemeral: true });

      const isOverdue = now > pret.due_at;
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor(isOverdue ? '#E74C3C' : '#F1C40F').setTitle('🏦 Votre prêt actif')
          .addFields(
            { name: '💳 À rembourser', value: `**${pret.amount} ${coin}**`, inline: true },
            { name: '📅 Échéance', value: `<t:${pret.due_at}:R>`, inline: true },
            { name: '⚠️ Statut', value: isOverdue ? '**EN RETARD** ⚠️' : '✅ Dans les délais', inline: true },
          )
      ], ephemeral: true });
    }
  }
};
