const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('massban')
    .setDescription('🔨 Bannir plusieurs membres en une seule commande (anti-raid)')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o => o.setName('ids').setDescription('IDs séparés par des espaces ou virgules').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison du bannissement').setRequired(false))

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const idsRaw  = interaction.options.getString('ids');
    const raison  = interaction.options.getString('raison') || 'Bannissement de masse';
    const delDays = interaction.options.getInteger('supprimer_messages') ?? 1;

    const ids = idsRaw.split(/[\s,]+/).map(s => s.trim()).filter(s => /^\d{17,19}$/.test(s));
    if (!ids.length) return interaction.editReply({ content: '❌ Aucun ID valide fourni.' });
    if (ids.length > 50) return interaction.editReply({ content: '❌ Maximum 50 IDs à la fois.' });

    let banned = 0, failed = 0, skipped = 0;
    const results = [];

    for (const id of ids) {
      if (id === interaction.user.id || id === interaction.client.user.id) { skipped++; continue; }
      try {
        await interaction.guild.bans.create(id, { reason: `[MassBan] ${raison} — par ${interaction.user.tag}`, deleteMessageSeconds: delDays * 86400 });
        db.db.prepare('INSERT INTO warnings (guild_id,user_id,mod_id,reason) VALUES (?,?,?,?)').run(interaction.guildId, id, interaction.user.id, `[BAN] ${raison}`);
        results.push(`✅ \`${id}\``);
        banned++;
      } catch (e) {
        results.push(`❌ \`${id}\` (${e.message.slice(0, 30)})`);
        failed++;
        if (interaction.isRepliable() && !interaction.replied) {
          interaction.editReply({ content: '❌ Une erreur est survenue. Ressaie.', }).catch(() => {});
        }
      }
    }

    // Log
    const cfg = db.getConfig(interaction.guildId);
    if (cfg.mod_log_channel && banned > 0) {
      const ch = interaction.guild.channels.cache.get(cfg.mod_log_channel);
      if (ch) ch.send({ embeds: [new EmbedBuilder()
        .setColor('Red')
        .setTitle('🔨 Bannissement de masse')
        .addFields(
          { name: '🛡️ Modérateur', value: `<@${interaction.user.id}>`, inline: true },
          { name: '✅ Bannis',       value: `${banned}`, inline: true },
          { name: '❌ Échecs',       value: `${failed}`, inline: true },
          { name: '📋 Raison',       value: raison },
        )
        .setTimestamp()
      ]}).catch(() => {});
    }

    return interaction.editReply({ embeds: [new EmbedBuilder()
      .setColor(banned > 0 ? 'Red' : 'Yellow')
      .setTitle('🔨 Résultat du MassBan')
      .addFields(
        { name: '✅ Bannis',   value: `${banned}/${ids.length}`, inline: true },
        { name: '❌ Échecs',   value: `${failed}`, inline: true },
        { name: '⏭️ Ignorés', value: `${skipped}`, inline: true },
      )
      .setDescription(results.slice(0, 20).join('\n'))
    ]});
  }
};
