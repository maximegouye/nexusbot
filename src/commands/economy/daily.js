const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function trackMission(userId, guildId, type, amount = 1) {
  try { require('../../commands_guild/unique/missions').progressMission(userId, guildId, type, amount); } catch {}
}

module.exports = {
  name: 'daily',
  aliases: ['quotidien', 'jour'],
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('📅 Récupère ta récompense quotidienne (bonus de fidélité croissant)'),
  cooldown: 3,

  async execute(interaction) {
    // DEFER IMMÉDIATEMENT pour éviter le timeout Discord (3s)
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const symbol = cfg.currency_emoji || '€';

    const now       = Math.floor(Date.now() / 1000);
    const lastDaily = user.last_daily || 0;
    const cooldown  = cfg.daily_cooldown > 0 ? cfg.daily_cooldown : 86400;

    if (now - lastDaily < cooldown) {
      const remaining = cooldown - (now - lastDaily);
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      return await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('⏳ Récompense déjà récupérée')
          .setDescription(`Reviens dans **${h} h ${m} min** pour ta prochaine récompense quotidienne.`)
          .setFooter({ text: '🔥 Passe chaque jour pour conserver ta série de récompenses !' })
        ], ephemeral: true
      });
    }

    // ── Animation de récupération ─────────────────────────
    // Après defer, toujours utiliser editReply
    const replyFn = interaction.editReply.bind(interaction);

    const loadingEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📅 Récupération en cours...')
      .setDescription('```\n🪙  ·  ·  ·  ·  ·  ·  ·  ·  ·\n```\n*Comptage des euros...*');
    let msg;
    try {
      msg = await replyFn({ embeds: [loadingEmbed] });
    } catch { return; }

    await sleep(600);
    await interaction.editReply({ embeds: [new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📅 Récupération en cours...')
      .setDescription('```\n💫  ·  💫  ·  💫  ·  💫  ·  💫\n```\n*Calcul du bonus de fidélité...*')
    ]}).catch(() => {});

    await sleep(600);
    await interaction.editReply({ embeds: [new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle('📅 Récupération en cours...')
      .setDescription('```\n✨  ✨  ✨  ✨  ✨  ✨  ✨  ✨  ✨\n```\n*Préparation de ta récompense...*')
    ]}).catch(() => {});

    await sleep(600);

    // ── Calcul du streak ──────────────────────────────────
    const wasYesterday = lastDaily > 0 && (now - lastDaily) < (cooldown * 2);
    const newStreak    = wasYesterday ? (user.streak || 0) + 1 : 1;

    const base         = cfg.daily_amount || 25;
    const streakPct    = Math.max(0, cfg.daily_streak_bonus ?? 10);
    const streakBonus  = Math.min(newStreak - 1, 60) * Math.max(1, Math.floor(base * streakPct / 100));
    const milestones   = { 7: base * 2, 14: base * 4, 30: base * 10, 60: base * 20, 100: base * 40 };
    const milestone    = milestones[newStreak] || 0;
    const total        = base + streakBonus + milestone;

    db.addCoins(interaction.user.id, interaction.guildId, total);
    db.db.prepare('UPDATE users SET last_daily = ?, streak = ? WHERE user_id = ? AND guild_id = ?')
      .run(now, newStreak, interaction.user.id, interaction.guildId);

    trackMission(interaction.user.id, interaction.guildId, 'daily');
    trackMission(interaction.user.id, interaction.guildId, 'earn_coins', total);

    // ── Animation spéciale milestone ──────────────────────
    if (milestone > 0) {
      const milestoneEmojis = { 7: '🎖️', 14: '🥇', 30: '🏆', 60: '👑', 100: '💎' };
      const mEmoji = milestoneEmojis[newStreak] || '🎉';
      for (const [col, title] of [['#FFD700', `${mEmoji} PALIER ATTEINT !`], ['#FFA500', `🎊 ${newStreak} JOURS D'AFFILÉE !`]]) {
        await interaction.editReply({ embeds: [new EmbedBuilder()
          .setColor(col)
          .setTitle(title)
          .setDescription(`\`\`\`\n${'⭐'.repeat(Math.min(newStreak, 10))}\n\`\`\`\n**Bonus exceptionnel : +${milestone.toLocaleString('fr-FR')}${symbol} !**`)
        ]}).catch(() => {});
        await sleep(500);
      }
    }

    let specialMsg = '';
    if (newStreak === 7)   specialMsg = `\n🎖️ **1 semaine de fidélité !** Bonus exceptionnel de ${milestones[7].toLocaleString('fr-FR')}${symbol}.`;
    if (newStreak === 14)  specialMsg = `\n🥇 **2 semaines de fidélité !** Bonus exceptionnel de ${milestones[14].toLocaleString('fr-FR')}${symbol}.`;
    if (newStreak === 30)  specialMsg = `\n🏆 **1 mois de fidélité !** Incroyable ! Bonus de ${milestones[30].toLocaleString('fr-FR')}${symbol}.`;
    if (newStreak === 60)  specialMsg = `\n👑 **2 mois de fidélité !** Bonus majestueux de ${milestones[60].toLocaleString('fr-FR')}${symbol}.`;
    if (newStreak === 100) specialMsg = `\n💎 **100 jours d'affilée !** Légendaire ! Bonus de ${milestones[100].toLocaleString('fr-FR')}${symbol}.`;

    const flames = '🔥'.repeat(Math.min(newStreak, 7));

    const nextDailyTimestamp = Math.floor((Date.now() + cooldown * 1000) / 1000);

    const embed = new EmbedBuilder()
      .setColor(milestone > 0 ? '#FFD700' : cfg.color || '#7B2FBE')
      .setTitle(`${symbol} Récompense quotidienne récupérée !`)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
      .setDescription(`Tu as reçu **${total.toLocaleString('fr-FR')}${symbol}**.${specialMsg}`)
      .addFields(
        { name: `${symbol} Base`,           value: `**+${base.toLocaleString('fr-FR')}${symbol}**`, inline: true },
        { name: '🔥 Bonus de fidélité',     value: `**+${streakBonus.toLocaleString('fr-FR')}${symbol}**`, inline: true },
        ...(milestone ? [{ name: '🎉 Palier', value: `**+${milestone.toLocaleString('fr-FR')}${symbol}**`, inline: true }] : []),
        { name: `${flames} Série`,          value: `**${newStreak} jour${newStreak > 1 ? 's' : ''}** consécutif${newStreak > 1 ? 's' : ''}`, inline: true },
        { name: `${symbol} Nouveau solde`,  value: `**${(user.balance + total).toLocaleString('fr-FR')}${symbol}**`, inline: true },
        { name: '⏰ Prochain daily',         value: `<t:${nextDailyTimestamp}:R>`, inline: true },
      )
      .setFooter({ text: 'Reviens demain pour conserver ta série !' });

    // ── Créer les boutons d'action ────────────────────────
    const statsButton = new ButtonBuilder()
      .setCustomId('daily_stats')
      .setLabel('Mes stats')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary);

    const reminderButton = new ButtonBuilder()
      .setCustomId('daily_reminder')
      .setLabel('Rappel')
      .setEmoji('🔔')
      .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder().addComponents(statsButton, reminderButton);

    const message = await interaction.editReply({ embeds: [embed], components: [actionRow] }).catch(() => {});

    // ── Collector local pour les boutons (30s timeout) ────
    if (message) {
      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 30000,
      });

      collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.customId === 'daily_stats') {
          await buttonInteraction.reply({
            embeds: [new EmbedBuilder()
              .setColor('#5865F2')
              .setTitle('📊 Tes statistiques daily')
              .addFields(
                { name: '🔥 Série actuelle', value: `**${newStreak} jour${newStreak > 1 ? 's' : ''}**`, inline: true },
                { name: '🏆 Record personnel', value: `**${user.best_streak || 0} jours**`, inline: true },
                { name: `${symbol} Total gagné en daily`, value: `**${(user.total_daily_earned || 0).toLocaleString('fr-FR')}${symbol}**`, inline: false },
              )
              .setFooter({ text: 'Continue à jouer chaque jour pour battre ton record !' })
            ],
            ephemeral: true,
          }).catch(() => {});
        } else if (buttonInteraction.customId === 'daily_reminder') {
          await buttonInteraction.reply({
            content: `🔔 Ton prochain **daily** sera disponible <t:${nextDailyTimestamp}:R>`,
            ephemeral: true,
          }).catch(() => {});
        }
      });

      collector.on('end', () => {
        // Retirer les boutons après le timeout
        interaction.editReply({ components: [] }).catch(() => {});
      });
    }
  },

  async run(message, args) {
    const fakeInteraction = {
      user: message.author,
      guildId: message.guildId,
      deferred: false,
      replied: false,
      reply: async (d) => { const m = await message.channel.send(d).catch(() => {}); fakeInteraction._msg = m; return m; },
      editReply: async (d) => fakeInteraction._msg ? fakeInteraction._msg.edit(d).catch(() => {}) : message.channel.send(d).catch(() => {}),
      deferReply: async () => {},
      _msg: null,
    };
    await module.exports.execute(fakeInteraction);
  },
};
