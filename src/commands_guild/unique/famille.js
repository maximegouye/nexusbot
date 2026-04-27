/**
 * NexusBot — Système de famille virtuelle
 * UNIQUE : mariage, adoption, arbre généalogique, bonus famille
 */
const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS familles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    user_id TEXT,
    partner_id TEXT,
    parent1_id TEXT,
    parent2_id TEXT,
    married_at INTEGER,
    marriage_cost INTEGER DEFAULT 0,
    family_xp INTEGER DEFAULT 0,
    UNIQUE(guild_id, user_id)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS family_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, from_id TEXT, to_id TEXT,
    type TEXT, created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('famille')
    .setDescription('👨‍👩‍👧 Gérez votre famille virtuelle — mariage, adoption, arbre !')
    .addSubcommand(s => s.setName('demander').setDescription('💍 Faire une demande (mariage ou adoption)')
      .addUserOption(o => o.setName('membre').setDescription('Membre à demander').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Type de demande').setRequired(true)
        .addChoices({ name: '💍 Mariage', value: 'mariage' }, { name: '👶 Adoption (vous adoptez ce membre)', value: 'adoption' })))
    .addSubcommand(s => s.setName('accepter').setDescription('✅ Accepter la dernière demande reçue'))
    .addSubcommand(s => s.setName('refuser').setDescription('❌ Refuser la dernière demande reçue'))
    .addSubcommand(s => s.setName('voir').setDescription('👨‍👩‍👧 Voir votre arbre familial')
      .addUserOption(o => o.setName('membre').setDescription('Voir la famille d\'un autre membre')))
    .addSubcommand(s => s.setName('divorcer').setDescription('💔 Demander le divorce'))
    .addSubcommand(s => s.setName('desadopter').setDescription('👋 Se séparer d\'un enfant adopté')
      .addUserOption(o => o.setName('membre').setDescription('Enfant à désadopter').setRequired(true)))
    .addSubcommand(s => s.setName('top').setDescription('🏆 Les familles les plus grandes du serveur')),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';
    const now = Math.floor(Date.now() / 1000);

    if (sub === 'demander') {
      const target = interaction.options.getUser('membre');
      const type = interaction.options.getString('type');
      if (target.id === userId || target.bot) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Membre invalide.', ephemeral: true });

      const myData = db.db.prepare('SELECT * FROM familles WHERE guild_id=? AND user_id=?').get(guildId, userId);
      const theirData = db.db.prepare('SELECT * FROM familles WHERE guild_id=? AND user_id=?').get(guildId, target.id);

      if (type === 'mariage') {
        if (myData?.partner_id) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous êtes déjà marié(e) ! Divorcez d\'abord.', ephemeral: true });
        if (theirData?.partner_id) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ <@${target.id}> est déjà marié(e) !`, ephemeral: true });
      }

      if (type === 'adoption') {
        if (theirData?.parent1_id || theirData?.parent2_id) {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ <@${target.id}> a déjà des parents.`, ephemeral: true });
        }
      }

      // Sauvegarder la demande
      db.db.prepare('DELETE FROM family_proposals WHERE guild_id=? AND from_id=? AND to_id=?').run(guildId, userId, target.id);
      db.db.prepare('INSERT INTO family_proposals (guild_id,from_id,to_id,type) VALUES(?,?,?,?)').run(guildId, userId, target.id, type);

      const emoji = type === 'mariage' ? '💍' : '👶';
      const msg = type === 'mariage'
        ? `<@${target.id}>, **${interaction.user.username}** vous demande en mariage ! 💍\n\nUtilisez \`/famille accepter\` ou \`/famille refuser\`.`
        : `<@${target.id}>, **${interaction.user.username}** souhaite vous adopter ! 👶\n\nUtilisez \`/famille accepter\` ou \`/famille refuser\`.`;

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#FF69B4').setTitle(`${emoji} Demande envoyée`).setDescription(msg)] });
    }

    if (sub === 'accepter') {
      const prop = db.db.prepare('SELECT * FROM family_proposals WHERE guild_id=? AND to_id=? ORDER BY created_at DESC LIMIT 1').get(guildId, userId);
      if (!prop) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune demande en attente.', ephemeral: true });

      if (prop.type === 'mariage') {
        const marriageCost = 500;
        const myU = db.getUser(userId, guildId);
        const theirU = db.getUser(prop.from_id, guildId);
        if ((myU.balance || 0) < marriageCost / 2 || (theirU.balance || 0) < marriageCost / 2) {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Le mariage coûte **${marriageCost} ${coin}** (partagé entre les deux époux).`, ephemeral: true });
        }
        db.addCoins(userId, guildId, -marriageCost / 2);
        db.addCoins(prop.from_id, guildId, -marriageCost / 2);

        // Créer / mettre à jour les deux entrées
        const upsert = `INSERT INTO familles (guild_id,user_id,partner_id,married_at) VALUES(?,?,?,?)
          ON CONFLICT(guild_id,user_id) DO UPDATE SET partner_id=excluded.partner_id, married_at=excluded.married_at`;
        db.db.prepare(upsert).run(guildId, userId, prop.from_id, now);
        db.db.prepare(upsert).run(guildId, prop.from_id, userId, now);

        db.db.prepare('DELETE FROM family_proposals WHERE id=?').run(prop.id);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#FF69B4').setTitle('💍 Félicitations !')
          .setDescription(`<@${prop.from_id}> et <@${userId}> sont maintenant **mariés** ! 🎉\n-${marriageCost / 2} ${coin} chacun`)
        ]});
      }

      if (prop.type === 'adoption') {
        const upsert2 = `INSERT INTO familles (guild_id,user_id,parent1_id) VALUES(?,?,?)
          ON CONFLICT(guild_id,user_id) DO UPDATE SET parent1_id=excluded.parent1_id`;
        db.db.prepare(upsert2).run(guildId, userId, prop.from_id);
        db.db.prepare('DELETE FROM family_proposals WHERE id=?').run(prop.id);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ <@${prop.from_id}> a officiellement adopté <@${userId}> ! 👶` });
      }
    }

    if (sub === 'refuser') {
      const prop = db.db.prepare('SELECT * FROM family_proposals WHERE guild_id=? AND to_id=? ORDER BY created_at DESC LIMIT 1').get(guildId, userId);
      if (!prop) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune demande en attente.', ephemeral: true });
      db.db.prepare('DELETE FROM family_proposals WHERE id=?').run(prop.id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Vous avez refusé la demande de <@${prop.from_id}>.` });
    }

    if (sub === 'voir') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const data = db.db.prepare('SELECT * FROM familles WHERE guild_id=? AND user_id=?').get(guildId, target.id);

      // Chercher les enfants
      const children = db.db.prepare('SELECT user_id FROM familles WHERE guild_id=? AND (parent1_id=? OR parent2_id=?)').all(guildId, target.id, target.id);

      const embed = new EmbedBuilder().setColor('#FF69B4').setTitle(`👨‍👩‍👧 Famille de ${target.username}`);
      const lines = [];
      if (data?.partner_id) {
        const marriedDays = data.married_at ? Math.floor((now - data.married_at) / 86400) : 0;
        lines.push(`💍 **Partenaire :** <@${data.partner_id}> *(mariés depuis ${marriedDays}j)*`);
      } else {
        lines.push('💍 **Partenaire :** *Célibataire*');
      }
      if (data?.parent1_id) lines.push(`👨 **Parent 1 :** <@${data.parent1_id}>`);
      if (data?.parent2_id) lines.push(`👩 **Parent 2 :** <@${data.parent2_id}>`);
      if (children.length) {
        lines.push(`👶 **Enfants (${children.length}) :** ${children.map(c => `<@${c.user_id}>`).join(', ')}`);
      } else {
        lines.push('👶 **Enfants :** *Aucun*');
      }

      embed.setDescription(lines.join('\n'));
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'divorcer') {
      const myData = db.db.prepare('SELECT * FROM familles WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!myData?.partner_id) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'êtes pas marié(e).', ephemeral: true });

      const partnerId = myData.partner_id;
      db.db.prepare('UPDATE familles SET partner_id=NULL, married_at=NULL WHERE guild_id=? AND user_id=?').run(guildId, userId);
      db.db.prepare('UPDATE familles SET partner_id=NULL, married_at=NULL WHERE guild_id=? AND user_id=?').run(guildId, partnerId);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `💔 Vous avez divorcé de <@${partnerId}>. C'est une décision difficile...` });
    }

    if (sub === 'desadopter') {
      const child = interaction.options.getUser('membre');
      const childData = db.db.prepare('SELECT * FROM familles WHERE guild_id=? AND user_id=?').get(guildId, child.id);
      if (!childData || (childData.parent1_id !== userId && childData.parent2_id !== userId)) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ <@${child.id}> n'est pas votre enfant adopté.`, ephemeral: true });
      }

      const upd = childData.parent1_id === userId ? 'parent1_id' : 'parent2_id';
      db.db.prepare(`UPDATE familles SET ${upd}=NULL WHERE guild_id=? AND user_id=?`).run(guildId, child.id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `👋 <@${child.id}> a été désadopté(e). Bonne continuation !` });
    }

    if (sub === 'top') {
      const all = db.db.prepare('SELECT user_id FROM familles WHERE guild_id=?').all(guildId);
      if (!all.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune famille sur ce serveur.', ephemeral: true });

      // Compter les membres de chaque famille (partenaire + enfants)
      const counts = {};
      for (const row of all) {
        const d = db.db.prepare('SELECT * FROM familles WHERE guild_id=? AND user_id=?').get(guildId, row.user_id);
        const children = db.db.prepare('SELECT COUNT(*) as c FROM familles WHERE guild_id=? AND (parent1_id=? OR parent2_id=?)').get(guildId, row.user_id, row.user_id);
        const size = (d.partner_id ? 1 : 0) + children.c;
        if (size > 0) counts[row.user_id] = size;
      }

      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const medals = ['🥇', '🥈', '🥉'];
      const desc = sorted.map(([uid, sz], i) => `${medals[i] || `**${i+1}.**`} <@${uid}> — **${sz + 1}** membres`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#FF69B4').setTitle('👨‍👩‍👧 Top Familles').setDescription(desc)] });
    }
  }
};
