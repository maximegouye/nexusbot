const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

const pending = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('🪙 Lancer un défi pile ou face contre un autre membre')
    .addStringOption(o => o.setName('mise').setDescription('Montant à miser (nombre, tout, 50 %, moitié) — aucune limite').setRequired(true).setMaxLength(30))
    .addStringOption(o => o.setName('choix').setDescription('Pile ou face ?').setRequired(true)
      .addChoices({ name: '👑 Face', value: 'face' }, { name: '🪙 Pile', value: 'pile' }))
    .addUserOption(o => o.setName('adversaire').setDescription('Membre à défier (laisse vide pour un défi ouvert)').setRequired(false)),

  async execute(interaction) {
    try {
    const miseRaw = interaction.options.get('mise')?.value;
    const challenger0 = db.getUser(interaction.user.id, interaction.guildId);
    const parseBet = (raw, base) => {
      const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
      if (s === 'all' || s === 'tout' || s === 'max') return Math.max(0, Number(base || 0));
      if (s === 'half' || s === 'moitié' || s === 'moitie' || s === '50%') return Math.floor(Number(base || 0) / 2);
      const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
      if (!m) return NaN;
      const n = parseFloat(m[1]);
      if (m[2] === '%') return Math.floor((n / 100) * Number(base || 0));
      return Math.floor(n);
    };
    const mise = parseBet(miseRaw, challenger0.balance);
    if (!Number.isFinite(mise) || mise < 1) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Mise invalide. Minimum **1**. Tape un nombre, `all`, `50%`, `moitié`.', ephemeral: true });
    }
    const adversaire = interaction.options.getUser('adversaire');
    const choix      = interaction.options.getString('choix');
    const userId     = interaction.user.id;

    if (adversaire?.id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas jouer contre toi-même.', ephemeral: true });

    const challenger = db.getUser(userId, interaction.guildId);
    if ((challenger.balance || 0) < mise) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Solde insuffisant : **${(challenger.balance ?? 0).toLocaleString('fr-FR')}** 🪙 · il te faut **${mise.toLocaleString('fr-FR')}** 🪙.`, ephemeral: true });

    db.db.prepare('UPDATE users SET balance=balance-? WHERE user_id=? AND guild_id=?').run(mise, userId, interaction.guildId);

    const choixOpposé = choix === 'face' ? 'pile' : 'face';
    const choixEmoji  = choix === 'face' ? '👑' : '🪙';
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🪙 Défi Pile ou Face !')
      .setDescription(`**${interaction.user.username}** mise **${mise} 🪙** sur **${choixEmoji} ${choix.toUpperCase()}**\n\n${adversaire ? `<@${adversaire.id}> tu es défié !` : 'Qui accepte le défi ?'}\n\nL\'adversaire joue sur **${choixOpposé === 'face' ? '👑' : '🪙'} ${choixOpposé.toUpperCase()}**`)
      .setFooter({ text: 'Expire dans 2 minutes' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cf_accept').setLabel('✅ Accepter le défi').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('cf_decline').setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
    );

    const msg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], components: [row], fetchReply: true });

    pending.set(msg.id, {
      challengerId: userId,
      challengerName: interaction.user.username,
      opponentId: adversaire?.id || null,
      mise,
      choix,
      guildId: interaction.guildId,
    });

    const collector = msg.createMessageComponentCollector({ time: 120000 });
    collector.on('collect', async i => {
      const ch = pending.get(msg.id);
      if (!ch) return i.deferUpdate();

      if (i.customId === 'cf_decline') {
        if (i.user.id !== ch.challengerId && i.user.id !== ch.opponentId) return i.reply({ content: '❌ Ce n\'est pas ton défi.', ephemeral: true });
        db.db.prepare('UPDATE users SET balance=balance+? WHERE user_id=? AND guild_id=?').run(ch.mise, ch.challengerId, ch.guildId);
        pending.delete(msg.id);
        collector.stop();
        return i.update({ embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Défi annulé. Mise remboursée.')], components: [] });
      }

      if (i.customId === 'cf_accept') {
        if (i.user.id === ch.challengerId) return i.reply({ content: '❌ Tu ne peux pas accepter ton propre défi !', ephemeral: true });
        if (ch.opponentId && i.user.id !== ch.opponentId) return i.reply({ content: '❌ Ce défi est réservé à quelqu\'un d\'autre.', ephemeral: true });

        const opp = db.getUser(i.user.id, ch.guildId);
        if ((opp.balance || 0) < ch.mise) return i.reply({ content: `❌ Tu n'as pas assez (${opp.balance ?? 0} 🪙 / besoin: ${ch.mise} 🪙).`, ephemeral: true });

        db.db.prepare('UPDATE users SET balance=balance-? WHERE user_id=? AND guild_id=?').run(ch.mise, i.user.id, ch.guildId);
        pending.delete(msg.id);
        collector.stop();

        const result = Math.random() < 0.5 ? 'face' : 'pile';
        const resultEmoji = result === 'face' ? '👑' : '🪙';
        const winnerId = result === ch.choix ? ch.challengerId : i.user.id;
        const winnerName = result === ch.choix ? ch.challengerName : i.user.username;
        const gain = ch.mise * 2;

        db.db.prepare('UPDATE users SET balance=balance+?, total_earned=total_earned+? WHERE user_id=? AND guild_id=?').run(gain, gain, winnerId, ch.guildId);

        return i.update({ embeds: [new EmbedBuilder()
          .setColor('Green')
          .setTitle('🪙 Résultat du Pile ou Face !')
          .setDescription(`La pièce tombe sur **${resultEmoji} ${result.toUpperCase()}** !\n\n🏆 **${winnerName}** remporte **${gain} 🪙** !`)
          .addFields(
            { name: '🎯 Lanceur', value: `${ch.choix === result ? '✅' : '❌'} <@${ch.challengerId}> jouait ${ch.choix === 'face' ? '👑' : '🪙'}`, inline: true },
            { name: '🎯 Adversaire', value: `${ch.choix !== result ? '✅' : '❌'} <@${i.user.id}> jouait ${ch.choix !== result ? (ch.choix === 'face' ? '🪙' : '👑') : (ch.choix === 'face' ? '🪙' : '👑')}`, inline: true },
          )], components: [] });
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time' && pending.has(msg.id)) {
        const ch = pending.get(msg.id);
        db.db.prepare('UPDATE users SET balance=balance+? WHERE user_id=? AND guild_id=?').run(ch.mise, ch.challengerId, ch.guildId);
        pending.delete(msg.id);
        msg.edit({ embeds: [new EmbedBuilder().setColor('Red').setDescription('⏰ Défi expiré. Mise remboursée.')], components: [] }).catch(() => {});
      }
    });
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.reply(errMsg).catch(() => {});
      }
    } catch {}
  }},

  async run(message, args) {
    const [miseRaw] = args;
    
    if (!miseRaw) {
      return message.reply('❌ Usage: &coinflip <mise> [pile|face] [@adversaire]');
    }

    const choix = args.includes('pile') ? 'pile' : 'face';
    const adversaire = message.mentions.users.first();

    const fakeInteraction = {
      user: message.author,
      member: message.member,
      guild: message.guild,
      guildId: message.guildId,
      channel: message.channel,
      deferred: false,
      replied: false,
      options: {
        get: (key) => key === 'mise' ? { value: miseRaw } : null,
        getString: (key) => key === 'choix' ? choix : null,
        getUser: (key) => key === 'adversaire' ? adversaire : null,
      },
      async reply(opts) { return await message.channel.send(opts).catch(() => {}); },
      async editReply(opts) { return await message.channel.send(opts).catch(() => {}); },
    };
    await this.execute(fakeInteraction);
  },
};
