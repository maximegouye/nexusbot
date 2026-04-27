/**
 * NexusBot — Paris Virtuels
 * /parier — Créez et participez à des paris sur n'importe quel événement !
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS paris (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    creator_id  TEXT NOT NULL,
    question    TEXT NOT NULL,
    option_a    TEXT NOT NULL,
    option_b    TEXT NOT NULL,
    status      TEXT DEFAULT 'open',
    winner      TEXT,
    created_at  INTEGER DEFAULT (strftime('%s','now')),
    closed_at   INTEGER
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS paris_bets (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    pari_id  INTEGER NOT NULL,
    user_id  TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    choix    TEXT NOT NULL,
    amount   INTEGER NOT NULL,
    paid_out INTEGER DEFAULT 0,
    UNIQUE(pari_id, user_id)
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('parier')
    .setDescription('🎲 Système de paris virtuels')
    .addSubcommand(s => s.setName('creer')
      .setDescription('➕ Créer un nouveau pari')
      .addStringOption(o => o.setName('question').setDescription('Question du pari').setRequired(true).setMaxLength(200))
      .addStringOption(o => o.setName('option_a').setDescription('Option A').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('option_b').setDescription('Option B').setRequired(true).setMaxLength(100)))
    .addSubcommand(s => s.setName('miser')
      .setDescription('💰 Miser sur un pari')
      .addStringOption(o => o.setName('id').setDescription('ID du pari').setRequired(true))
      .addStringOption(o => o.setName('choix').setDescription('Votre choix').setRequired(true).addChoices(
        { name: '🅰️ Option A', value: 'a' },
        { name: '🅱️ Option B', value: 'b' },
      ))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant à miser').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('voir')
      .setDescription('👁️ Voir un pari')
      .addStringOption(o => o.setName('id').setDescription('ID du pari').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir les paris ouverts'))
    .addSubcommand(s => s.setName('resoudre')
      .setDescription('🏆 Résoudre un pari (admin/créateur)')
      .addStringOption(o => o.setName('id').setDescription('ID du pari').setRequired(true))
      .addStringOption(o => o.setName('gagnant').setDescription('Option gagnante').setRequired(true).addChoices(
        { name: '🅰️ Option A gagne', value: 'a' },
        { name: '🅱️ Option B gagne', value: 'b' },
        { name: '🤝 Match nul (remboursement)', value: 'draw' },
      )))
    .addSubcommand(s => s.setName('annuler')
      .setDescription('❌ Annuler un pari (admin/créateur)')
      .addStringOption(o => o.setName('id').setDescription('ID du pari').setRequired(true))),

  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId  = interaction.user.id;

    if (sub === 'creer') {
      const question = interaction.options.getString('question');
      const optA     = interaction.options.getString('option_a');
      const optB     = interaction.options.getString('option_b');

      const result = db.db.prepare('INSERT INTO paris (guild_id, creator_id, question, option_a, option_b) VALUES (?,?,?,?,?)')
        .run(guildId, userId, question, optA, optB);
      const id = result.lastInsertRowid;

      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle(`🎲 Nouveau Pari #${id}`)
        .setDescription(`**${question}**`)
        .addFields(
          { name: '🅰️ Option A', value: optA, inline: true },
          { name: '🅱️ Option B', value: optB, inline: true },
          { name: '💰 Cagnotte', value: '0 coins', inline: true },
        )
        .setFooter({ text: `Misez avec /parier miser ${id} — Créé par ${interaction.user.username}` });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'miser') {
      const id     = parseInt(interaction.options.getString('id'));
      const choix  = interaction.options.getString('choix');
      const amount = parseInt(interaction.options.getString('montant'));

      const pari = db.db.prepare('SELECT * FROM paris WHERE id=? AND guild_id=?').get(id, guildId);
      if (!pari) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Pari #${id} introuvable.` });
      if (pari.status !== 'open') return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce pari est fermé.' });

      const user = db.getUser(userId, guildId);
      if (user.balance < amount) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Tu n'as que **${(user.balance || 0).toLocaleString('fr-FR')}** coins.` });

      const existing = db.db.prepare('SELECT * FROM paris_bets WHERE pari_id=? AND user_id=?').get(id, userId);
      if (existing) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu as déjà misé sur ce pari !' });

      db.removeCoins(userId, guildId, amount);
      db.db.prepare('INSERT INTO paris_bets (pari_id, user_id, guild_id, choix, amount) VALUES (?,?,?,?,?)').run(id, userId, guildId, choix, amount);

      const totalA = db.db.prepare("SELECT SUM(amount) as t FROM paris_bets WHERE pari_id=? AND choix='a'").get(id)?.t || 0;
      const totalB = db.db.prepare("SELECT SUM(amount) as t FROM paris_bets WHERE pari_id=? AND choix='b'").get(id)?.t || 0;

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`✅ Pari placé — #${id}`)
        .setDescription(`**${pari.question}**`)
        .addFields(
          { name: `Ton choix : ${choix === 'a' ? '🅰️ ' + pari.option_a : '🅱️ ' + pari.option_b}`, value: `**${amount}** coins`, inline: true },
          { name: '🅰️ Cagnotte A', value: `${totalA} coins`, inline: true },
          { name: '🅱️ Cagnotte B', value: `${totalB} coins`, inline: true },
        );
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'voir') {
      const id   = parseInt(interaction.options.getString('id'));
      const pari = db.db.prepare('SELECT * FROM paris WHERE id=? AND guild_id=?').get(id, guildId);
      if (!pari) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Pari #${id} introuvable.` });

      const totalA  = db.db.prepare("SELECT SUM(amount) as t, COUNT(*) as c FROM paris_bets WHERE pari_id=? AND choix='a'").get(id);
      const totalB  = db.db.prepare("SELECT SUM(amount) as t, COUNT(*) as c FROM paris_bets WHERE pari_id=? AND choix='b'").get(id);
      const myBet   = db.db.prepare('SELECT * FROM paris_bets WHERE pari_id=? AND user_id=?').get(id, userId);
      const potTotA = totalA?.t || 0, potTotB = totalB?.t || 0;
      const totalPot = potTotA + potTotB;

      const oddsA = totalPot > 0 ? (totalPot / Math.max(1, potTotA)).toFixed(2) : '—';
      const oddsB = totalPot > 0 ? (totalPot / Math.max(1, potTotB)).toFixed(2) : '—';

      const statusEmoji = pari.status === 'open' ? '🟢 Ouvert' : pari.status === 'resolved' ? '✅ Résolu' : '❌ Annulé';

      const embed = new EmbedBuilder()
        .setColor(pari.status === 'open' ? '#3498db' : '#95a5a6')
        .setTitle(`🎲 Pari #${id}`)
        .setDescription(`**${pari.question}**`)
        .addFields(
          { name: `🅰️ ${pari.option_a}`, value: `${potTotA} coins (${totalA?.c || 0} miseurs) — Cote ×${oddsA}`, inline: true },
          { name: `🅱️ ${pari.option_b}`, value: `${potTotB} coins (${totalB?.c || 0} miseurs) — Cote ×${oddsB}`, inline: true },
          { name: '💰 Cagnotte totale', value: `${totalPot} coins`, inline: true },
          { name: '📊 Statut', value: statusEmoji, inline: true },
        );
      if (myBet) embed.addFields({ name: '🎯 Ta mise', value: `${myBet.choix === 'a' ? pari.option_a : pari.option_b} — ${myBet.amount} coins`, inline: true });
      if (pari.winner) embed.addFields({ name: '🏆 Gagnant', value: pari.winner === 'draw' ? '🤝 Match nul' : pari.winner === 'a' ? `🅰️ ${pari.option_a}` : `🅱️ ${pari.option_b}`, inline: true });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'liste') {
      const parisList = db.db.prepare("SELECT * FROM paris WHERE guild_id=? AND status='open' ORDER BY created_at DESC LIMIT 15").all(guildId);
      if (!parisList.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucun pari ouvert. Créez-en un avec `/parier creer` !')] });
      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🎲 Paris Ouverts')
        .setDescription(parisList.map(p => `**#${p.id}** — ${p.question.slice(0,60)}${p.question.length>60?'...':''}\n> 🅰️ ${p.option_a} vs 🅱️ ${p.option_b}`).join('\n\n'));
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'resoudre') {
      const id     = parseInt(interaction.options.getString('id'));
      const winner = interaction.options.getString('gagnant');
      const pari   = db.db.prepare('SELECT * FROM paris WHERE id=? AND guild_id=?').get(id, guildId);

      if (!pari) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Pari #${id} introuvable.` });
      if (pari.status !== 'open') return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce pari est déjà fermé.' });

      const canResolve = pari.creator_id === userId || interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
      if (!canResolve) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Seul le créateur ou un admin peut résoudre ce pari.' });

      db.db.prepare("UPDATE paris SET status='resolved', winner=?, closed_at=strftime('%s','now') WHERE id=?").run(winner, id);

      const bets = db.db.prepare('SELECT * FROM paris_bets WHERE pari_id=? AND paid_out=0').all(id);
      const totalPot = bets.reduce((s, b) => s + b.amount, 0);
      const winBets  = bets.filter(b => winner === 'draw' ? true : b.choix === winner);
      const winTotal = winBets.reduce((s, b) => s + b.amount, 0);

      let payouts = 0;
      winBets.forEach(b => {
        const share = winner === 'draw' ? b.amount : Math.round((b.amount / winTotal) * totalPot);
        db.addCoins(b.user_id, guildId, share);
        payouts += share;
      });
      db.db.prepare('UPDATE paris_bets SET paid_out=1 WHERE pari_id=?').run(id);

      const winLabel = winner === 'draw' ? '🤝 Match nul (remboursement)' : winner === 'a' ? `🅰️ ${pari.option_a}` : `🅱️ ${pari.option_b}`;
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle(`🏆 Pari #${id} Résolu !`)
        .setDescription(`**${pari.question}**\n\nRésultat : **${winLabel}**`)
        .addFields(
          { name: '💰 Cagnotte distribuée', value: `${payouts} coins à ${winBets.length} gagnant(s)`, inline: true },
          { name: '👥 Total participants',  value: `${bets.length}`, inline: true },
        );
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'annuler') {
      const id   = parseInt(interaction.options.getString('id'));
      const pari = db.db.prepare('SELECT * FROM paris WHERE id=? AND guild_id=?').get(id, guildId);
      if (!pari) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Pari #${id} introuvable.` });
      if (pari.status !== 'open') return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce pari est déjà fermé.' });

      const canCancel = pari.creator_id === userId || interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
      if (!canCancel) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Seul le créateur ou un admin peut annuler ce pari.' });

      db.db.prepare("UPDATE paris SET status='cancelled' WHERE id=?").run(id);
      const bets = db.db.prepare('SELECT * FROM paris_bets WHERE pari_id=? AND paid_out=0').all(id);
      bets.forEach(b => { db.addCoins(b.user_id, guildId, b.amount); });
      db.db.prepare('UPDATE paris_bets SET paid_out=1 WHERE pari_id=?').run(id);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`❌ Pari **#${id}** annulé. ${bets.length} participants remboursés.`)] });
    }
  }
};
