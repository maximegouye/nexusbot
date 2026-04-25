const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS clans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, name TEXT, tag TEXT,
    emoji TEXT DEFAULT '🏆', description TEXT DEFAULT '',
    owner_id TEXT, created_at INTEGER DEFAULT (strftime('%s','now')),
    treasury INTEGER DEFAULT 0, level INTEGER DEFAULT 1,
    UNIQUE(guild_id, name), UNIQUE(guild_id, tag)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS clan_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, clan_id INTEGER, user_id TEXT,
    rank TEXT DEFAULT 'membre',
    joined_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan')
    .setDescription('🏆 Système de clans — Rejoignez ou créez une équipe !')
    .addSubcommand(s => s.setName('creer').setDescription('🏆 Créer un nouveau clan')
      .addStringOption(o => o.setName('nom').setDescription('Nom du clan').setRequired(true).setMaxLength(30))
      .addStringOption(o => o.setName('tag').setDescription('Tag du clan (3 lettres max)').setRequired(true).setMaxLength(5))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji du clan'))
      .addStringOption(o => o.setName('description').setDescription('Description').setMaxLength(150)))
    .addSubcommand(s => s.setName('rejoindre').setDescription('✅ Rejoindre un clan')
      .addStringOption(o => o.setName('nom').setDescription('Nom du clan').setRequired(true)))
    .addSubcommand(s => s.setName('quitter').setDescription('🚪 Quitter votre clan'))
    .addSubcommand(s => s.setName('info').setDescription('📋 Infos sur un clan')
      .addStringOption(o => o.setName('nom').setDescription('Nom du clan (laissez vide = votre clan)')))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Liste de tous les clans du serveur'))
    .addSubcommand(s => s.setName('kick').setDescription('🦶 Exclure un membre (Chef/Officier)')
      .addUserOption(o => o.setName('membre').setDescription('Membre à exclure').setRequired(true)))
    .addSubcommand(s => s.setName('promouvoir').setDescription('⬆️ Promouvoir un membre (Chef)')
      .addUserOption(o => o.setName('membre').setDescription('Membre à promouvoir').setRequired(true))
      .addStringOption(o => o.setName('rang').setDescription('Nouveau rang').setRequired(true)
        .addChoices({ name: '⭐ Officier', value: 'officier' }, { name: '👑 Chef', value: 'chef' })))
    .addSubcommand(s => s.setName('don').setDescription('💰 Faire un don à la trésorerie du clan')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';

    if (sub === 'creer') {
      const existing = db.db.prepare('SELECT * FROM clan_members WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (existing) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous êtes déjà dans un clan. Quittez-le d\'abord.', ephemeral: true });

      const nom = interaction.options.getString('nom');
      const tag = interaction.options.getString('tag').toUpperCase();
      const emoji = interaction.options.getString('emoji') || '🏆';
      const desc = interaction.options.getString('description') || '';

      const u = db.getUser(userId, guildId);
      if (u.balance < 500) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Créer un clan coûte **500 ${coin}**.`, ephemeral: true });

      try {
        const r = db.db.prepare('INSERT INTO clans (guild_id, name, tag, emoji, description, owner_id) VALUES (?,?,?,?,?,?)').run(guildId, nom, tag, emoji, desc, userId);
        db.db.prepare('INSERT INTO clan_members (guild_id, clan_id, user_id, rank) VALUES (?,?,?,?)').run(guildId, r.lastInsertRowid, userId, 'chef');
        db.addCoins(userId, guildId, -500);
      } catch {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Ce nom ou tag existe déjà.`, ephemeral: true });
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('🏆 Clan créé !')
          .setDescription(`Le clan **${emoji} ${nom}** [${tag}] a été créé ! Coût : **-500 ${coin}**`)
      ]});
    }

    if (sub === 'rejoindre') {
      const existing = db.db.prepare('SELECT * FROM clan_members WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (existing) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous êtes déjà dans un clan.', ephemeral: true });

      const nom = interaction.options.getString('nom');
      const clan = db.db.prepare('SELECT * FROM clans WHERE guild_id=? AND LOWER(name)=LOWER(?)').get(guildId, nom);
      if (!clan) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Clan **${nom}** introuvable.`, ephemeral: true });

      const members = db.db.prepare('SELECT COUNT(*) as c FROM clan_members WHERE guild_id=? AND clan_id=?').get(guildId, clan.id);
      const maxSize = 5 + (clan.level - 1) * 5;
      if (members.c >= maxSize) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Ce clan est plein (${members.c}/${maxSize} membres).`, ephemeral: true });

      db.db.prepare('INSERT INTO clan_members (guild_id, clan_id, user_id) VALUES (?,?,?)').run(guildId, clan.id, userId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Vous avez rejoint le clan **${clan.emoji} ${clan.name}** !`)
      ]});
    }

    if (sub === 'quitter') {
      const m = db.db.prepare('SELECT cm.*, c.owner_id, c.name, c.emoji FROM clan_members cm JOIN clans c ON cm.clan_id=c.id WHERE cm.guild_id=? AND cm.user_id=?').get(guildId, userId);
      if (!m) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'êtes dans aucun clan.', ephemeral: true });
      if (m.owner_id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous êtes chef ! Transférez la direction avant de partir.', ephemeral: true });

      db.db.prepare('DELETE FROM clan_members WHERE guild_id=? AND user_id=?').run(guildId, userId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ Vous avez quitté le clan **${m.emoji} ${m.name}**.`, ephemeral: true });
    }

    if (sub === 'info') {
      const nom = interaction.options.getString('nom');
      let clan;
      if (!nom) {
        const m = db.db.prepare('SELECT clan_id FROM clan_members WHERE guild_id=? AND user_id=?').get(guildId, userId);
        if (!m) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'êtes dans aucun clan.', ephemeral: true });
        clan = db.db.prepare('SELECT * FROM clans WHERE id=?').get(m.clan_id);
      } else {
        clan = db.db.prepare('SELECT * FROM clans WHERE guild_id=? AND LOWER(name)=LOWER(?)').get(guildId, nom);
        if (!clan) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Clan **${nom}** introuvable.`, ephemeral: true });
      }

      const members = db.db.prepare('SELECT * FROM clan_members WHERE guild_id=? AND clan_id=? ORDER BY CASE rank WHEN \'chef\' THEN 1 WHEN \'officier\' THEN 2 ELSE 3 END').all(guildId, clan.id);
      const rankEmojis = { chef: '👑', officier: '⭐', membre: '👤' };
      const memberList = members.map(m => `${rankEmojis[m.rank]} <@${m.user_id}>`).join('\n') || 'Aucun';

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle(`${clan.emoji} ${clan.name} [${clan.tag}]`)
          .setDescription(clan.description || '*Pas de description*')
          .addFields(
            { name: '👑 Chef', value: `<@${clan.owner_id}>`, inline: true },
            { name: '👥 Membres', value: `${members.length}`, inline: true },
            { name: '🏆 Niveau', value: `**${clan.level}**`, inline: true },
            { name: '💰 Trésorerie', value: `**${clan.treasury} ${coin}**`, inline: true },
            { name: '📋 Membres', value: memberList, inline: false },
          )
      ]});
    }

    if (sub === 'liste') {
      const clans = db.db.prepare('SELECT c.*, COUNT(cm.id) as member_count FROM clans c LEFT JOIN clan_members cm ON c.id=cm.clan_id WHERE c.guild_id=? GROUP BY c.id ORDER BY c.level DESC, member_count DESC LIMIT 15').all(guildId);
      if (!clans.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun clan sur ce serveur.', ephemeral: true });

      const lines = clans.map((c, i) => `**${i+1}.** ${c.emoji} **${c.name}** [${c.tag}] — Niv.${c.level} | 👥 ${c.member_count} | 💰 ${c.treasury} ${coin}`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('🏆 Clans du serveur').setDescription(lines)
      ]});
    }

    if (sub === 'kick') {
      const m = db.db.prepare('SELECT cm.*, c.owner_id FROM clan_members cm JOIN clans c ON cm.clan_id=c.id WHERE cm.guild_id=? AND cm.user_id=?').get(guildId, userId);
      if (!m) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'êtes dans aucun clan.', ephemeral: true });
      if (m.rank !== 'chef' && m.rank !== 'officier') return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Chef ou officier uniquement.', ephemeral: true });

      const target = interaction.options.getUser('membre');
      if (target.id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous ne pouvez pas vous exclure vous-même.', ephemeral: true });

      const targetM = db.db.prepare('SELECT * FROM clan_members WHERE guild_id=? AND user_id=? AND clan_id=?').get(guildId, target.id, m.clan_id);
      if (!targetM) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ <@${target.id}> n'est pas dans votre clan.`, ephemeral: true });
      if (targetM.rank === 'chef') return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Impossible d\'expulser le chef.', ephemeral: true });

      db.db.prepare('DELETE FROM clan_members WHERE guild_id=? AND user_id=?').run(guildId, target.id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ <@${target.id}> a été exclu du clan.` });
    }

    if (sub === 'promouvoir') {
      const m = db.db.prepare('SELECT cm.*, c.owner_id, c.id as cid FROM clan_members cm JOIN clans c ON cm.clan_id=c.id WHERE cm.guild_id=? AND cm.user_id=?').get(guildId, userId);
      if (!m || m.rank !== 'chef') return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Chef uniquement.', ephemeral: true });

      const target = interaction.options.getUser('membre');
      const rang = interaction.options.getString('rang');

      const targetM = db.db.prepare('SELECT * FROM clan_members WHERE guild_id=? AND user_id=? AND clan_id=?').get(guildId, target.id, m.cid);
      if (!targetM) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ <@${target.id}> n'est pas dans votre clan.`, ephemeral: true });

      db.db.prepare('UPDATE clan_members SET rank=? WHERE guild_id=? AND user_id=?').run(rang, guildId, target.id);
      const rankLabels = { officier: '⭐ Officier', chef: '👑 Chef' };
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ <@${target.id}> est maintenant **${rankLabels[rang]}** !` });
    }

    if (sub === 'don') {
      const m = db.db.prepare('SELECT cm.clan_id FROM clan_members cm WHERE cm.guild_id=? AND cm.user_id=?').get(guildId, userId);
      if (!m) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'êtes dans aucun clan.', ephemeral: true });

      const montant = parseInt(interaction.options.getString('montant'));
      const u = db.getUser(userId, guildId);
      if (u.balance < montant) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Solde insuffisant.`, ephemeral: true });

      db.addCoins(userId, guildId, -montant);
      db.db.prepare('UPDATE clans SET treasury=treasury+? WHERE id=?').run(montant, m.clan_id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ Vous avez donné **${montant} ${coin}** à la trésorerie du clan !` });
    }
  }
};
