const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('🎂 Gérer les anniversaires')
    .addSubcommand(s => s.setName('set').setDescription('🎂 Enregistrer ton anniversaire'))
    .addSubcommand(s => s.setName('voir').setDescription('👁️ Voir les prochains anniversaires'))
    .addSubcommand(s => s.setName('setup').setDescription('⚙️ Configurer le canal anniversaires (Admin)')
      .addChannelOption(o => o.setName('canal').setDescription('Canal pour les annonces').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Rôle anniversaire (optionnel)').setRequired(false))),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const cfg = db.getConfig(interaction.guildId);

    // ── SET ──
    if (sub === 'set') {
      const jour  = interaction.options.getInteger('jour');
      const mois  = interaction.options.getInteger('mois');
      const annee = interaction.options.getInteger('annee') || null;

      // Vérifier la date
      const testDate = new Date(annee || 2000, mois - 1, jour);
      if (testDate.getMonth() !== mois - 1) return interaction.editReply({ content: '❌ Date invalide.', ephemeral: true });

      const bday = `${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;

      db.db.prepare(`INSERT INTO users (user_id, guild_id, birthday, birth_year) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, guild_id) DO UPDATE SET birthday = ?, birth_year = ?`)
        .run(interaction.user.id, interaction.guildId, bday, annee, bday, annee);

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF73FA')
          .setTitle('🎂 Anniversaire enregistré !')
          .setDescription(`Ton anniversaire a été enregistré le **${jour}/${mois}${annee ? `/${annee}` : ''}**. 🎉`)
          .setFooter({ text: 'Le bot t\'enverra un message le jour J !' })
        ], ephemeral: true
      });
    }

    // ── VOIR ──
    if (sub === 'voir') {
      const now   = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');

      const birthdays = db.db.prepare(`
        SELECT user_id, birthday, birth_year FROM users
        WHERE guild_id = ? AND birthday IS NOT NULL
        ORDER BY substr(birthday, 1, 2), substr(birthday, 4, 2)
      `).all(interaction.guildId);

      if (!birthdays.length) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setDescription('🎂 Aucun anniversaire enregistré. Utilise `/birthday set` !')],
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#FF73FA')
        .setTitle('🎂 Anniversaires du serveur')
        .setDescription(`**${birthdays.length} membres** ont enregistré leur anniversaire.`);

      // Afficher les 15 prochains
      const sorted = birthdays
        .map(b => {
          const [m, d] = b.birthday.split('-').map(Number);
          let nextBday = new Date(now.getFullYear(), m - 1, d);
          if (nextBday < now) nextBday.setFullYear(now.getFullYear() + 1);
          return { ...b, nextBday };
        })
        .sort((a, b) => a.nextBday - b.nextBday)
        .slice(0, 15);

      let desc = '';
      for (const b of sorted) {
        const [m, d] = b.birthday.split('-').map(Number);
        const age    = b.birth_year ? now.getFullYear() - b.birth_year + (b.nextBday.getFullYear() > now.getFullYear() ? 0 : 0) : null;
        const ageStr = age ? ` *(${age} ans)*` : '';
        desc += `<@${b.user_id}> — 🎂 **${d}/${m}**${ageStr} — <t:${Math.floor(b.nextBday / 1000)}:R>\n`;
      }
      embed.setDescription(desc);

      return interaction.editReply({ embeds: [embed] });
    }

    // ── SETUP ──
    if (sub === 'setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.editReply({ content: '❌ Permission insuffisante.', ephemeral: true });
      }
      const canal = interaction.options.getChannel('canal');
      const role  = interaction.options.getRole('role');
      db.setConfig(interaction.guildId, 'birthday_channel', canal.id);
      if (role) db.setConfig(interaction.guildId, 'birthday_role', role.id);

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setDescription(`✅ Anniversaires configurés → Canal ${canal}${role ? ` | Rôle <@&${role.id}>` : ''}.`)
        ], ephemeral: true
      });
    }
  }
};
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
