const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// -- Adaptateur prefixe->interaction
function mkFake(message, opts) {
  opts = opts || {};
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
      getSubcommand: opts.getSubcommand || function() { return null; },
      getUser:    opts.getUser    || function() { return null; },
      getMember:  opts.getMember  || function() { return null; },
      getRole:    opts.getRole    || function() { return null; },
      getChannel: opts.getChannel || function() { return null; },
      getString:  opts.getString  || function() { return null; },
      getInteger: opts.getInteger || function() { return null; },
      getNumber:  opts.getNumber  || function() { return null; },
      getBoolean: opts.getBoolean || function() { return null; },
    },
    deferReply: async function() { deferred = true; },
    editReply:  async function(d) { return send(d); },
    reply:      async function(d) { return send(d); },
    followUp:   async function(d) { return message.channel.send(d).catch(() => {}); },
    update:     async function(d) {},
  };
}


module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('🎒 Affiche ton inventaire')
    .addUserOption(o => o.setName('membre').setDescription('Membre à consulter').setRequired(false)),
  cooldown: 5,

  async execute(interaction) {
    try {
    const cfg    = db.getConfig(interaction.guildId);
    const target = interaction.options.getUser('membre') || interaction.user;
    const emoji  = cfg.currency_emoji || '€';
    const name   = cfg.currency_name  || 'Euros';

    const items = db.db.prepare(`
      SELECT i.quantity, i.expires_at, s.name, s.emoji, s.description, s.role_id
      FROM inventory i
      JOIN shop s ON i.item_id = s.id
      WHERE i.user_id = ? AND i.guild_id = ? AND i.quantity > 0
      ORDER BY s.name
    `).all(target.id, interaction.guildId);

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle(`🎒 Inventaire de ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 128 }));

    if (!items.length) {
      embed.setDescription('L\'inventaire est vide.\nAchète des articles avec **/buy** !');
    } else {
      const now = Math.floor(Date.now() / 1000);
      let desc = '';
      for (const item of items) {
        const expStr = item.expires_at
          ? (item.expires_at < now ? ' *(expiré)*' : ` *(expire <t:${item.expires_at}:R>)*`)
          : '';
        desc += `${item.emoji || '📦'} **${item.name}** ×${item.quantity}${expStr}\n`;
        if (item.description) desc += `  ╰ *${item.description}*\n`;
      }
      embed.setDescription(desc);
      embed.setFooter({ text: `${items.length} type${items.length > 1 ? 's' : ''} d'article` });
    }

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
  name: 'inventory',
  aliases: ["inv2"],
    async run(message, args) {
    const target = message.mentions.users.first() || message.author;
    const fake = mkFake(message, { getUser: function() { return target; } });
    await this.execute(fake);
  },
};
