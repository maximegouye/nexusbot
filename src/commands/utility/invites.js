const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getInviteStats } = require('../../database/db');


// ── Adaptateur préfixe→interaction ────────────────────────────────────────────
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
    .setName('invites')
    .setDescription('Affiche vos statistiques d\'invitation')
    .addUserOption(option =>
      option.setName('utilisateur')
        .setDescription('Utilisateur dont voir les stats (par défaut: vous)')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('utilisateur') || interaction.user;

      // Récupérer les stats d'invitation
      const stats = getInviteStats(interaction.guildId, targetUser.id);

      if (!stats) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Cet utilisateur n\'a pas de statistiques d\'invitation.');

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('📊 Statistiques d\'invitation')
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setDescription(`Statistiques pour ${targetUser}`)
        .addFields(
          {
            name: '📨 Invitations totales',
            value: `${stats.total_invites || 0}`
          },
          {
            name: '✅ Encore présents',
            value: `${stats.remaining || 0}`
          },
          {
            name: '❌ Partis',
            value: `${stats.left || 0}`
          },
          {
            name: '🚫 Invitations invalides',
            value: `${stats.fake || 0}`
          },
          {
            name: '⭐ Score effectif',
            value: `${stats.effective_score || 0}`
          }
        )
        .setFooter({
          text: 'Score effectif = Total - Partis - Invalides'
        })
        .setTimestamp();

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur dans la commande invites:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Une erreur est survenue lors de la récupération des statistiques.');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
    }
  },

  name: 'invites',
  aliases: ['invite', 'invitations'],
  async run(message, args) {
    const target = message.mentions.users.first() || null;
    const fake = mkFake(message, {
      getUser: (k) => k === 'utilisateur' ? target : null,
    });
    await this.execute(fake);
  },

};
