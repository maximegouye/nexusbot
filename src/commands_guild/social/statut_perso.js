const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS statuts_perso (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    status_text TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    color TEXT DEFAULT '#7B2FBE',
    show_level INTEGER DEFAULT 1,
    show_balance INTEGER DEFAULT 1,
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('statut')
    .setDescription('🎭 Personnalisez votre profil sur ce serveur')
    .addSubcommand(s => s.setName('bio').setDescription('📝 Modifier votre bio')
      .addStringOption(o => o.setName('texte').setDescription('Votre bio (max 200 caractères)').setRequired(true).setMaxLength(200)))
    .addSubcommand(s => s.setName('status').setDescription('💬 Modifier votre statut personnalisé')
      .addStringOption(o => o.setName('texte').setDescription('Votre statut').setRequired(true).setMaxLength(100)))
    .addSubcommand(s => s.setName('couleur').setDescription('🎨 Couleur de votre profil')
      .addStringOption(o => o.setName('hex').setDescription('Code HEX (ex: #FF6B6B)').setRequired(true)))
    .addSubcommand(s => s.setName('confidentialite').setDescription('🔒 Paramètres de confidentialité')
      .addBooleanOption(o => o.setName('montrer_niveau').setDescription('Afficher votre niveau'))
      .addBooleanOption(o => o.setName('montrer_coins').setDescription('Afficher votre solde')))
    .addSubcommand(s => s.setName('voir').setDescription('👀 Voir votre profil personnalisé')
      .addUserOption(o => o.setName('membre').setDescription('Voir le profil d\'un membre'))),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const now = Math.floor(Date.now() / 1000);

    let perso = db.db.prepare('SELECT * FROM statuts_perso WHERE guild_id=? AND user_id=?').get(guildId, userId);
    if (!perso && sub !== 'voir') {
      db.db.prepare('INSERT INTO statuts_perso (guild_id, user_id) VALUES (?,?)').run(guildId, userId);
      perso = db.db.prepare('SELECT * FROM statuts_perso WHERE guild_id=? AND user_id=?').get(guildId, userId);
    }

    if (sub === 'bio') {
      const texte = interaction.options.getString('texte');
      db.db.prepare('UPDATE statuts_perso SET bio=?, updated_at=? WHERE guild_id=? AND user_id=?').run(texte, now, guildId, userId);
      return interaction.editReply({ content: `✅ Bio mise à jour !`, ephemeral: true });
    }

    if (sub === 'status') {
      const texte = interaction.options.getString('texte');
      db.db.prepare('UPDATE statuts_perso SET status_text=?, updated_at=? WHERE guild_id=? AND user_id=?').run(texte, now, guildId, userId);
      return interaction.editReply({ content: `✅ Statut mis à jour : **${texte}**`, ephemeral: true });
    }

    if (sub === 'couleur') {
      const hex = interaction.options.getString('hex').replace('#','');
      if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return interaction.editReply({ content: '❌ Code HEX invalide.', ephemeral: true });
      db.db.prepare('UPDATE statuts_perso SET color=? WHERE guild_id=? AND user_id=?').run(`#${hex.toUpperCase()}`, guildId, userId);
      return interaction.editReply({ content: `✅ Couleur de profil mise à jour : **#${hex.toUpperCase()}**`, ephemeral: true });
    }

    if (sub === 'confidentialite') {
      const showLevel = interaction.options.getBoolean('montrer_niveau');
      const showCoins = interaction.options.getBoolean('montrer_coins');
      if (showLevel !== null) db.db.prepare('UPDATE statuts_perso SET show_level=? WHERE guild_id=? AND user_id=?').run(showLevel ? 1 : 0, guildId, userId);
      if (showCoins !== null) db.db.prepare('UPDATE statuts_perso SET show_balance=? WHERE guild_id=? AND user_id=?').run(showCoins ? 1 : 0, guildId, userId);
      return interaction.editReply({ content: '✅ Paramètres de confidentialité mis à jour.', ephemeral: true });
    }

    if (sub === 'voir') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const targetPerso = db.db.prepare('SELECT * FROM statuts_perso WHERE guild_id=? AND user_id=?').get(guildId, target.id);
      const u = db.getUser(target.id, guildId);
      const cfg = db.getConfig(guildId);
      const coin = cfg.currency_emoji || '🪙';

      const embed = new EmbedBuilder()
        .setColor(targetPerso?.color || '#7B2FBE')
        .setTitle(`👤 ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ size: 256 }));

      if (targetPerso?.status_text) embed.setDescription(`*"${targetPerso.status_text}"*`);
      if (targetPerso?.bio) embed.addFields({ name: '📝 Bio', value: targetPerso.bio });
      if (!targetPerso || targetPerso.show_level) embed.addFields({ name: '⭐ Niveau', value: `**${u.level || 1}** (${u.xp || 0} XP)`, inline: true });
      if (!targetPerso || targetPerso.show_balance) embed.addFields({ name: `💰 Solde`, value: `**${u.balance || 0} ${coin}**`, inline: true });

      embed.addFields({ name: '📅 Sur Discord depuis', value: `<t:${Math.floor(target.createdAt.getTime()/1000)}:R>`, inline: true });

      return interaction.editReply({ embeds: [embed] });
    }
  }
};
