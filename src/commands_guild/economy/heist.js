const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');


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
    .setName('braquage')
    .setDescription('🏦 Organise un braquage de banque avec d\'autres membres !')
    .addIntegerOption(o => o.setName('cible').setDescription('Montant visé lors du braquage').setMinValue(100).setRequired(true)),
  cooldown: 5,

  async execute(interaction) {
    try {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const cfg    = db.getConfig(interaction.guildId);
    const emoji  = cfg.currency_emoji || '€';
    const name   = cfg.currency_name  || 'Euros';
    const target = interaction.options.getInteger('cible');
    const joinCost = Math.floor(target * 0.1); // 10% de la cible pour rejoindre

    // ── L'organisateur paie lui aussi la mise d'entrée ──────
    const orgUser = db.getUser(interaction.user.id, interaction.guildId);
    if (orgUser.balance < joinCost) {
      return (interaction.deferred || interaction.replied ? interaction.editReply : interaction.reply)
        .bind(interaction)({ content: `❌ Tu as besoin de **${joinCost.toLocaleString('fr-FR')} ${name}** pour organiser ce braquage.`, ephemeral: true });
    }
    db.removeCoins(interaction.user.id, interaction.guildId, joinCost);

    const participants = new Map();
    participants.set(interaction.user.id, { user: interaction.user, paid: true });

    const endsAt = Math.floor(Date.now() / 1000) + 120; // 2 min pour recruter

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('heist_join').setLabel(`Rejoindre (${joinCost.toLocaleString('fr-FR')} ${name})`).setEmoji('🔫').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('heist_start').setLabel('🚨 Lancer le braquage !').setStyle(ButtonStyle.Danger),
    );

    const buildEmbed = () => new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('🏦 BRAQUAGE EN COURS DE PRÉPARATION')
      .setDescription(`**Organisateur :** ${interaction.user.username}\n🎯 **Cible :** **${target.toLocaleString('fr-FR')} ${name}**\n💼 **Mise d'entrée :** ${joinCost.toLocaleString('fr-FR')} ${name}\n\n👥 **Équipe :** ${[...participants.keys()].map(id => `<@${id}>`).join(', ')}\n\nClique **Rejoindre** pour participer ou **Lancer** pour démarrer !`)
      .setFooter({ text: `Fin du recrutement <t:${endsAt}:R>` });

    const msg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [buildEmbed()], components: [row], fetchReply: true });

    const collector = msg.createMessageComponentCollector({ time: 120000 });

    collector.on('collect', async i => {
      if (i.customId === 'heist_join') {
        if (participants.has(i.user.id)) return i.reply({ content: '⚠️ Tu es déjà dans l\'équipe !', ephemeral: true });
        const u = db.getUser(i.user.id, interaction.guildId);
        if (u.balance < joinCost) return i.reply({ content: `❌ Tu as besoin de **${joinCost.toLocaleString('fr-FR')} ${name}** pour rejoindre.`, ephemeral: true });
        db.removeCoins(i.user.id, interaction.guildId, joinCost);
        participants.set(i.user.id, { user: i.user });
        await i.update({ embeds: [buildEmbed()], components: [row] });

      } else if (i.customId === 'heist_start') {
        if (i.user.id !== interaction.user.id) return i.reply({ content: '❌ Seul l\'organisateur peut lancer.', ephemeral: true });
        collector.stop('launch');
        await executeHeist(i);
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'launch') return;
      if (reason === 'time' && participants.size >= 2) await executeHeist(null, true);
      else if (reason === 'time') {
        // Rembourser
        msg.edit({ embeds: [new EmbedBuilder().setColor('#888888').setDescription('🚨 Pas assez de participants. Braquage annulé, mises remboursées.')], components: [] }).catch(() => {});
      }
    });

    async function executeHeist(i, auto = false) {
      const teamSize    = participants.size;
      const successRate = Math.min(0.3 + teamSize * 0.1, 0.8); // 30% + 10% par membre
      const success     = Math.random() < successRate;

      if (success) {
        const totalPot  = target + (joinCost * teamSize);
        const perPerson = Math.floor(totalPot / teamSize);
        for (const [uid] of participants) db.addCoins(uid, interaction.guildId, perPerson);

        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🏦 BRAQUAGE RÉUSSI ! 🎉')
          .setDescription(`L'équipe a réussi à voler **${target.toLocaleString('fr-FR')} ${name}** !\n\n💰 Chaque membre reçoit **${perPerson.toLocaleString('fr-FR')} ${name}** ${emoji}`)
          .addFields({ name: '👥 Équipe', value: [...participants.keys()].map(id => `<@${id}>`).join(', ') });

        if (i) await i.update({ embeds: [embed], components: [] });
        else msg.edit({ embeds: [embed], components: [] }).catch(() => {});
      } else {
        const finePerPerson = Math.floor(joinCost * 1.5);
        for (const [uid] of participants) db.removeCoins(uid, interaction.guildId, finePerPerson);

        const embed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🚨 BRAQUAGE ÉCHOUÉ ! 🚔')
          .setDescription(`La police a intercepté l'équipe ! Chaque membre paie **${finePerPerson.toLocaleString('fr-FR')} ${name}** d'amende.`)
          .addFields({ name: '👮 Arrêtés', value: [...participants.keys()].map(id => `<@${id}>`).join(', ') });

        if (i) await i.update({ embeds: [embed], components: [] });
        else msg.edit({ embeds: [embed], components: [] }).catch(() => {});
      }
    }
    } catch (err) {
    console.error('[CMD] Erreur:', err?.message || err);
    const _em = { content: `❌ Erreur : ${String(err?.message || 'Erreur inconnue').slice(0,200)}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(_em).catch(() => {});
      else await interaction.reply(_em).catch(() => {});
    } catch {}
  }},

  name: 'braquage',
  aliases: ['heist', 'vol'],
  async run(message, args) {
    const cible = parseInt(args[0]) || 1000;
    const fake = mkFake(message, {
      getInteger: (k) => k === 'cible' ? cible : null,
    });
    await this.execute(fake);
  },

};
