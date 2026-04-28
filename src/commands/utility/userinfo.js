const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// ── Adaptateur préfixe→interaction ────────────────────────────────────────────
function mkFake(message, opts = {}) {
  let replied = false, deferred = false;
  const send = async (data) => {
    if (replied || deferred) return message.channel.send(data).catch(() => {});
    replied = true;
    return message.reply(data).catch(() => message.channel.send(data).catch(() => {}));
  };
  return {
    user: message.author, member: message.member,
    guild: message.guild, guildId: message.guildId,
    channel: message.channel, client: message.client,
    get deferred() { return deferred; }, get replied() { return replied; },
    options: {
      getSubcommand: opts.getSubcommand || (() => null),
      getUser:    opts.getUser    || ((k) => null),
      getMember:  opts.getMember  || ((k) => null),
      getRole:    opts.getRole    || ((k) => null),
      getChannel: opts.getChannel || ((k) => null),
      getString:  opts.getString  || ((k) => null),
      getInteger: opts.getInteger || ((k) => null),
      getNumber:  opts.getNumber  || ((k) => null),
      getBoolean: opts.getBoolean || ((k) => null),
    },
    deferReply: async () => { deferred = true; },
    editReply:  async (d) => send(d),
    reply:      async (d) => send(d),
    followUp:   async (d) => message.channel.send(d).catch(() => {}),
    update:     async (d) => {},
  };
}


module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('👤 Affiche les informations d\'un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre à consulter').setRequired(false)),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* déjà ack */ }
    }

    try {
    const target = interaction.options.getMember('membre') || interaction.member;
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(target.id, interaction.guildId);
    const warns  = db.db.prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id = ? AND user_id = ?').get(interaction.guildId, target.id).c;

    const roles = target.roles.cache
      .filter(r => r.id !== interaction.guildId)
      .sort((a, b) => b.position - a.position)
      .map(r => `<@&${r.id}>`)
      .slice(0, 10)
      .join(', ') || '*Aucun*';

    const badges = [];
    if (target.user.flags?.has('Staff')) badges.push('👨‍💼 Staff Discord');
    if (target.user.flags?.has('Partner')) badges.push('🤝 Partenaire');
    if (target.user.flags?.has('HypeSquadOnlineHouse1')) badges.push('🏠 HypeSquad');
    if (target.premiumSinceTimestamp) badges.push(`💎 Booster depuis <t:${Math.floor(target.premiumSinceTimestamp / 1000)}:D>`);

    const embed = new EmbedBuilder()
      .setColor(target.displayHexColor !== '#000000' ? target.displayHexColor : cfg.color || '#7B2FBE')
      .setTitle(`👤 ${target.displayName}`)
      .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '🏷️ Tag',           value: `${target.user.username}`,                       inline: true },
        { name: '🆔 ID',            value: `\`${target.id}\``,                          inline: true },
        { name: '📅 Inscrit le',    value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '📥 A rejoint le',  value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:D>`,        inline: true },
        { name: '⭐ Niveau',        value: `**${user.level}** (${(user.xp || 0).toLocaleString('fr-FR')} XP)`, inline: true },
        { name: '💰 Solde',         value: `**${user.balance.toLocaleString('fr-FR')}** coins`,               inline: true },
        { name: '⚠️ Avertissements', value: `**${warns}**`,                              inline: true },
        { name: '💬 Messages',      value: `**${(user.message_count || 0).toLocaleString('fr-FR')}**`,        inline: true },
        { name: '🎤 Vocal',         value: `**${(user.voice_minutes || 0)}min**`,                          inline: true },
        { name: `🎭 Rôles (${target.roles.cache.size - 1})`, value: roles.length > 1024 ? roles.slice(0, 1020) + '...' : roles, inline: false },
        ...(badges.length ? [{ name: '🏅 Badges', value: badges.join('\n'), inline: false }] : []),
      )
      .setImage(target.user.bannerURL?.({ size: 1024 }))
      .setFooter({ text: `NexusBot` })
      .setTimestamp();

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
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
  }},
  name: 'userinfo',
  aliases: ["infouser", "profil2"],
    async run(message, args) {
    const target = message.mentions.members?.first() || message.member;
    const fake = mkFake(message, { getMember: () => target });
    await this.execute(fake);
  },
};
