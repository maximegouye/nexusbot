const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  const cols = db.db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('reputation')) db.db.prepare("ALTER TABLE users ADD COLUMN reputation INTEGER DEFAULT 0").run();
  if (!cols.includes('last_rep')) db.db.prepare("ALTER TABLE users ADD COLUMN last_rep INTEGER DEFAULT 0").run();
  // Note : la table rep_log est créée par db.js avec schéma giver_id/receiver_id/message/created_at
  // On ajoute les colonnes legacy from_id/to_id/amount/reason/given_at si on a déjà une vieille DB
  const repCols = db.db.prepare('PRAGMA table_info(rep_log)').all().map(c => c.name);
  if (repCols.length === 0) {
    // Table n'existe pas encore — créer avec le schéma officiel db.js
    db.db.prepare(`CREATE TABLE IF NOT EXISTS rep_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id    TEXT NOT NULL,
      giver_id    TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      message     TEXT,
      created_at  INTEGER DEFAULT (strftime('%s','now'))
    )`).run();
  }
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rep')
    .setDescription('⭐ Système de réputation — Récompensez les membres utiles')
    .addSubcommand(s => s.setName('donner').setDescription('➕ Donner de la réputation à quelqu\'un')
      .addUserOption(o => o.setName('membre').setDescription('Membre à récompenser').setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison (optionnel)').setMaxLength(200)))
    .addSubcommand(s => s.setName('retirer').setDescription('➖ Retirer de la réputation (Modérateur)')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
    .addSubcommand(s => s.setName('voir').setDescription('👁️ Voir la réputation d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre (vous par défaut)')))
    .addSubcommand(s => s.setName('top').setDescription('🏆 Top 10 des membres les plus réputés'))
    .addSubcommand(s => s.setName('historique').setDescription('📜 Historique des reps reçus')),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';
    const now = Math.floor(Date.now() / 1000);
    const COOLDOWN = 24 * 3600; // 24h entre chaque rep

    if (sub === 'donner') {
      const target = interaction.options.getUser('membre');
      const raison = interaction.options.getString('raison') || null;

      if (target.id === userId) return interaction.editReply({ content: '❌ Vous ne pouvez pas vous donner de la réputation.', ephemeral: true });
      if (target.bot) return interaction.editReply({ content: '❌ Les bots ne peuvent pas recevoir de réputation.', ephemeral: true });

      const sender = db.getUser(userId, guildId);
      const cooldownLeft = COOLDOWN - (now - (sender.last_rep || 0));
      if (cooldownLeft > 0) {
        const hours = Math.floor(cooldownLeft / 3600);
        const mins = Math.floor((cooldownLeft % 3600) / 60);
        return interaction.editReply({ content: `⏳ Vous pourrez donner de la réputation dans **${hours}h ${mins}m**.`, ephemeral: true });
      }

      db.getUser(target.id, guildId); // S'assurer que l'utilisateur existe
      db.db.prepare('UPDATE users SET reputation = COALESCE(reputation,0) + 1 WHERE user_id=? AND guild_id=?').run(target.id, guildId);
      db.db.prepare('UPDATE users SET last_rep=? WHERE user_id=? AND guild_id=?').run(now, userId, guildId);
      // Schéma officiel : giver_id, receiver_id, message, created_at
      db.db.prepare('INSERT INTO rep_log (guild_id, giver_id, receiver_id, message, created_at) VALUES (?,?,?,?,?)').run(guildId, userId, target.id, raison, now);

      // Petite récompense en coins pour celui qui reçoit
      db.addCoins(target.id, guildId, 50);

      const targetData = db.getUser(target.id, guildId);
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('⭐ Réputation donnée !')
          .setDescription(`<@${userId}> a donné ⭐ **+1 réputation** à <@${target.id}>${raison ? `\n*"${raison}"*` : ''}`)
          .addFields(
            { name: '⭐ Réputation de', value: `<@${target.id}>`, inline: true },
            { name: '📊 Total', value: `**${(targetData.reputation || 0) + 1}** ⭐`, inline: true },
            { name: '🎁 Bonus', value: `+50 ${coin}`, inline: true },
          )
      ]});
    }

    if (sub === 'retirer') {
      if (!interaction.member.permissions.has(0x4000n)) return interaction.editReply({ content: '❌ Modérateur uniquement.', ephemeral: true });
      const target = interaction.options.getUser('membre');
      const montant = 1;
      db.getUser(target.id, guildId);
      // FIX SQLite : MAX() n'existe pas pour UPDATE — on utilise CASE WHEN
      db.db.prepare(`UPDATE users SET reputation = CASE WHEN COALESCE(reputation,0) - ? < 0 THEN 0 ELSE COALESCE(reputation,0) - ? END WHERE user_id=? AND guild_id=?`).run(montant, montant, target.id, guildId);
      db.db.prepare('INSERT INTO rep_log (guild_id, giver_id, receiver_id, message, created_at) VALUES (?,?,?,?,?)').run(guildId, userId, target.id, 'Retrait staff', now);
      return interaction.editReply({ content: `✅ **-${montant} réputation** retirée à <@${target.id}>.`, ephemeral: true });
    }

    if (sub === 'voir') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const u = db.getUser(target.id, guildId);
      const rep = u.reputation || 0;
      const repGiven = db.db.prepare('SELECT COUNT(*) as c FROM rep_log WHERE guild_id=? AND giver_id=?').get(guildId, target.id);
      const lastReceivers = db.db.prepare('SELECT receiver_id, created_at FROM rep_log WHERE guild_id=? AND giver_id=? ORDER BY created_at DESC LIMIT 3').all(guildId, target.id);
      const rank = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=? AND reputation > ?').get(guildId, rep);

      const stars = '⭐'.repeat(Math.min(rep, 5)) + (rep > 5 ? ` +${rep - 5}` : '');

      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle(`⭐ Réputation de ${target.username}`)
          .setThumbnail(target.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: '⭐ Réputation', value: `**${rep}** ${stars || '—'}`, inline: true },
            { name: '🏆 Rang', value: `**#${(rank?.c || 0) + 1}**`, inline: true },
            { name: '🎁 Reps donnés', value: `**${repGiven?.c || 0}**`, inline: true },
          )
      ]});
    }

    if (sub === 'top') {
      const top = db.db.prepare('SELECT user_id, reputation FROM users WHERE guild_id=? AND reputation > 0 ORDER BY reputation DESC LIMIT 10').all(guildId);
      if (!top.length) return interaction.editReply({ content: '❌ Aucun membre avec de la réputation.', ephemeral: true });

      const desc = top.map((u, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i+1}.**`;
        return `${medal} <@${u.user_id}> — **${u.reputation}** ⭐`;
      }).join('\n');

      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('🏆 Top Réputation').setDescription(desc)
      ]});
    }

    if (sub === 'historique') {
      const history = db.db.prepare('SELECT * FROM rep_log WHERE guild_id=? AND receiver_id=? ORDER BY created_at DESC LIMIT 10').all(guildId, userId);
      if (!history.length) return interaction.editReply({ content: '❌ Aucun historique de réputation.', ephemeral: true });

      const desc = history.map(r => {
        const emoji = '⭐';
        const date = `<t:${r.created_at}:R>`;
        return `${emoji} +1 de <@${r.giver_id}>${r.message ? ` — *${r.message}*` : ''} • ${date}`;
      }).join('\n');

      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('📜 Historique Réputation').setDescription(desc)
      ], ephemeral: true });
    }
  }
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
