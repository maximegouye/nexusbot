const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS anniversaires (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    day INTEGER, month INTEGER,
    UNIQUE(guild_id, user_id)
  )`).run();
  const cols = db.db.prepare('PRAGMA table_info(guild_config)').all().map(c => c.name);
  if (!cols.includes('birthday_channel')) db.db.prepare("ALTER TABLE guild_config ADD COLUMN birthday_channel TEXT").run();
  if (!cols.includes('birthday_role'))    db.db.prepare("ALTER TABLE guild_config ADD COLUMN birthday_role TEXT").run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anniversaire')
    .setDescription('🎂 Système d\'anniversaires du serveur')
    .addSubcommand(s => s.setName('ajouter').setDescription('🎂 Enregistrer votre date d\'anniversaire')
    .addSubcommand(s => s.setName('voir').setDescription('🎂 Voir la date d\'anniversaire d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre')))
    .addSubcommand(s => s.setName('prochain').setDescription('📅 Voir les prochains anniversaires'))
    .addSubcommand(s => s.setName('aujourd_hui').setDescription('🎉 Voir les anniversaires aujourd\'hui'))
    .addSubcommand(s => s.setName('setup').setDescription('⚙️ Configurer le canal d\'anniversaires (Admin)')
      .addChannelOption(o => o.setName('salon').setDescription('Salon où publier les félicitations').addChannelTypes(ChannelType.GuildText))
      .addRoleOption(o => o.setName('role').setDescription('Rôle anniversaire à donner temporairement')))
    .addSubcommand(s => s.setName('supprimer').setDescription('🗑️ Supprimer votre anniversaire')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const now = new Date();
    const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

    if (sub === 'ajouter') {
      const day = interaction.options.getInteger('jour');
      const month = interaction.options.getInteger('mois');
      // Validation basique
      const daysInMonth = [31,29,31,30,31,30,31,31,30,31,30,31];
      if (day > daysInMonth[month-1]) return interaction.reply({ content: `❌ Le mois ${month} n'a pas ${day} jours.`, ephemeral: true });

      db.db.prepare('INSERT OR REPLACE INTO anniversaires (guild_id, user_id, day, month) VALUES (?,?,?,?)').run(guildId, userId, day, month);
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#FF69B4').setTitle('🎂 Anniversaire enregistré !')
          .setDescription(`Votre anniversaire : **${day} ${MONTHS[month-1]}** 🎉`)
          .setFooter({ text: 'Vous recevrez des félicitations ce jour-là !' })
      ], ephemeral: true });
    }

    if (sub === 'voir') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const anniv = db.db.prepare('SELECT * FROM anniversaires WHERE guild_id=? AND user_id=?').get(guildId, target.id);
      if (!anniv) return interaction.reply({ content: `❌ ${target.id === userId ? 'Vous n\'avez' : `<@${target.id}> n'a`} pas enregistré d'anniversaire.`, ephemeral: true });

      // Calculer prochain anniversaire
      const thisYear = new Date(now.getFullYear(), anniv.month - 1, anniv.day);
      const nextBirthday = thisYear < now ? new Date(now.getFullYear() + 1, anniv.month - 1, anniv.day) : thisYear;
      const daysUntil = Math.ceil((nextBirthday - now) / 86400000);

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#FF69B4').setTitle(`🎂 Anniversaire de ${target.username}`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: '📅 Date', value: `**${anniv.day} ${MONTHS[anniv.month-1]}**`, inline: true },
            { name: '⏳ Dans', value: daysUntil === 0 ? '**Aujourd\'hui ! 🎉**' : `**${daysUntil} jour(s)**`, inline: true },
          )
      ]});
    }

    if (sub === 'prochain') {
      const all = db.db.prepare('SELECT * FROM anniversaires WHERE guild_id=? ORDER BY month, day').all(guildId);
      if (!all.length) return interaction.reply({ content: '❌ Aucun anniversaire enregistré.', ephemeral: true });

      const today = { month: now.getMonth() + 1, day: now.getDate() };
      // Trier par prochain anniversaire
      const sorted = all.map(a => {
        let days;
        const d = new Date(now.getFullYear(), a.month - 1, a.day);
        if (d < now) d.setFullYear(now.getFullYear() + 1);
        days = Math.ceil((d - now) / 86400000);
        return { ...a, days };
      }).sort((a, b) => a.days - b.days).slice(0, 10);

      const lines = sorted.map(a => `<@${a.user_id}> — **${a.day} ${MONTHS[a.month-1]}** (dans ${a.days} jour(s))`).join('\n');
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#FF69B4').setTitle('📅 Prochains Anniversaires').setDescription(lines)
      ]});
    }

    if (sub === 'aujourd_hui') {
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const today = db.db.prepare('SELECT * FROM anniversaires WHERE guild_id=? AND day=? AND month=?').all(guildId, day, month);

      if (!today.length) return interaction.reply({ content: '😢 Aucun anniversaire aujourd\'hui.', ephemeral: false });

      const mentions = today.map(a => `🎉 <@${a.user_id}>`).join('\n');
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#FF69B4').setTitle('🎂 Anniversaires Aujourd\'hui !')
          .setDescription(mentions + `\n\nSouhaitez-leur un joyeux anniversaire ! 🥳`)
      ]});
    }

    if (sub === 'setup') {
      if (!interaction.member.permissions.has(0x20n)) return interaction.reply({ content: '❌ Admin uniquement.', ephemeral: true });
      const channel = interaction.options.getChannel('salon');
      const role = interaction.options.getRole('role');
      if (channel) db.setConfig(guildId, 'birthday_channel', channel.id);
      if (role) db.setConfig(guildId, 'birthday_role', role.id);

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Configuration anniversaires')
          .addFields(
            { name: '📍 Canal', value: channel ? `${channel}` : 'Non modifié', inline: true },
            { name: '🎭 Rôle', value: role ? `${role}` : 'Non modifié', inline: true },
          )
      ], ephemeral: true });
    }

    if (sub === 'supprimer') {
      const r = db.db.prepare('DELETE FROM anniversaires WHERE guild_id=? AND user_id=?').run(guildId, userId);
      if (!r.changes) return interaction.reply({ content: '❌ Aucun anniversaire enregistré.', ephemeral: true });
      return interaction.reply({ content: '✅ Votre anniversaire a été supprimé.', ephemeral: true });
    }
  }
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
