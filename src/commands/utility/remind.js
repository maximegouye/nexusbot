const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

function parseDuration(str) {
  const regex = /(\d+)\s*(s(?:ec(?:onde?)?)?|m(?:in(?:ute)?)?|h(?:eure?)?|j(?:our?)?|d(?:ay?)?)/gi;
  let ms = 0;
  let match;
  while ((match = regex.exec(str)) !== null) {
    const n = parseInt(match[1]);
    const u = match[2].toLowerCase()[0];
    const mult = { s: 1000, m: 60000, h: 3600000, j: 86400000, d: 86400000 };
    ms += n * (mult[u] || 0);
  }
  return ms;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('⏰ Créer un rappel')
    .addStringOption(o => o.setName('dans').setDescription('Dans combien de temps ? ex: 2h, 1j, 30min').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Message de rappel').setRequired(true).setMaxLength(500)),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    try {
    const whenStr = interaction.options.getString('dans');
    const message = interaction.options.getString('message');
    const ms      = parseDuration(whenStr);

    if (!ms || ms < 10000) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Durée invalide. Exemples : `30min`, `2h`, `1j`', ephemeral: true });
    if (ms > 30 * 24 * 3600 * 1000) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Maximum 30 jours.', ephemeral: true });

    const triggerAt = Math.floor((Date.now() + ms) / 1000);

    // Limite 5 rappels actifs par personne
    const count = db.db.prepare('SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND triggered = 0').get(interaction.user.id).c;
    if (count >= 5) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu as déjà 5 rappels actifs. Attends qu\'ils se déclenchent.', ephemeral: true });

    db.db.prepare('INSERT INTO reminders (guild_id, channel_id, user_id, message, trigger_at, triggered) VALUES (?, ?, ?, ?, ?, 0)')
      .run(interaction.guildId, interaction.channelId, interaction.user.id, message, triggerAt);

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
      embeds: [new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('⏰ Rappel créé !')
        .setDescription(`Je te rappellerai : **${message}**`)
        .addFields({ name: '⏱️ Déclenche', value: `<t:${triggerAt}:R> (<t:${triggerAt}:f>)` })
        .setFooter({ text: 'Tu recevras un DM + un message ici.' })
      ], ephemeral: true
    });
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.editReply(errMsg).catch(() => {});
      }
    } catch {}
  }}
};
