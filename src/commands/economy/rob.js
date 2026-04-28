const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = {
  name: 'rob',
  aliases: ['voler', 'steal'],
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('🥷 Tente de voler des euros à un autre membre (risqué — cooldown 12h)')
    .addUserOption(o => o.setName('cible').setDescription('Membre à voler').setRequired(true)),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* déjà ack */ }
    }

    try {
    const cfg    = db.getConfig(interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const target = interaction.options.getUser('cible');

    if (target.bot)  return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas voler un bot.', ephemeral: true });
    if (target.id === interaction.user.id) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas te voler toi-même.', ephemeral: true });

    const robber   = db.getUser(interaction.user.id, interaction.guildId);
    const victim   = db.getUser(target.id, interaction.guildId);
    const now      = Math.floor(Date.now() / 1000);
    const lastRob  = robber.last_rob || 0;
    const cooldown = cfg.rob_cooldown > 0 ? cfg.rob_cooldown : 43200;

    if (now - lastRob < cooldown) {
      const remaining = cooldown - (now - lastRob);
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder().setColor('#FF6B6B').setTitle('🚔 Trop tôt !')
          .setDescription(`La police surveille encore ta zone. Attends **${h}h ${m}min**.`)],
        ephemeral: true
      });
    }

    if (victim.balance < 20) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ **${target.username}** a trop peu d'argent pour être volé (moins de 20€).`, ephemeral: true });
    }

    const hasKit = (robber.bm_steal_kit || 0) > 0;
    const successRate = hasKit ? 0.65 : 0.40;

    if (hasKit) {
      db.db.prepare('UPDATE users SET bm_steal_kit = bm_steal_kit - 1 WHERE user_id=? AND guild_id=?').run(interaction.user.id, interaction.guildId);
    }

    db.db.prepare('UPDATE users SET last_rob = ? WHERE user_id = ? AND guild_id = ?').run(now, interaction.user.id, interaction.guildId);
    const success = Math.random() < successRate;

    // ── Animation de cambriolage ──────────────────────────
    const replyFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);

    const heistFrames = [
      { color: '#2C3E50', title: `👁️ Surveillance de la cible...`, desc: `\`\`\`\n🎯  Cible : ${target.username}\n💰  Estimé : ${Math.floor(victim.balance * 0.20).toLocaleString('fr-FR')}${symbol}\n🔭  Observation en cours...\n\`\`\`` },
      { color: '#8E44AD', title: `🔓 Crochetage en cours...`, desc: `\`\`\`\n🔐  ${'░'.repeat(10)}\n🔏  ${'▓'.repeat(5)}${'░'.repeat(5)}\n🔓  ${'▓'.repeat(10)}\n\`\`\`\n*La serrure résiste...*` },
      { color: '#E67E22', title: `🥷 À l'attaque !`, desc: `\`\`\`\n💨  En approche silencieuse...\n⚡  ${hasKit ? '🔓 Kit de vol activé !' : '⚠️ Sans kit...'}\n🎲  Chance de réussite : ${Math.round(successRate * 100)}%\n\`\`\`` },
    ];

    await replyFn({ embeds: [new EmbedBuilder().setColor(heistFrames[0].color).setTitle(heistFrames[0].title).setDescription(heistFrames[0].desc)] }).catch(() => {});
    await sleep(800);
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(heistFrames[1].color).setTitle(heistFrames[1].title).setDescription(heistFrames[1].desc)] }).catch(() => {});
    await sleep(800);
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(heistFrames[2].color).setTitle(heistFrames[2].title).setDescription(heistFrames[2].desc)] }).catch(() => {});
    await sleep(900);

    if (success) {
      const capPct = (cfg.rob_max_percent != null && cfg.rob_max_percent > 0) ? cfg.rob_max_percent / 100 : 0.30;
      const pct    = Math.min(capPct, 0.10 + Math.random() * Math.max(0.01, capPct - 0.10));
      const stolen = Math.min(Math.floor(victim.balance * pct), victim.balance);
      db.addCoins(interaction.user.id, interaction.guildId, stolen);
      db.removeCoins(target.id, interaction.guildId, stolen);

      await interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('🥷 Vol réussi !')
        .setDescription(`Tu as volé **${stolen.toLocaleString('fr-FR')}${symbol}** à **${target.username}** sans te faire remarquer !`)
        .addFields(
          { name: '💰 Volé',        value: `**+${stolen.toLocaleString('fr-FR')}${symbol}**`,           inline: true },
          { name: '📊 % Volé',      value: `**${Math.round(pct*100)}%** du portefeuille`,               inline: true },
          ...(hasKit ? [{ name: '🔓 Kit utilisé', value: 'Bonus de réussite appliqué',                  inline: true }] : []),
        )
        .setFooter({ text: 'Prochain vol possible dans 12h' })
      ]}).catch(() => {});
    } else {
      const penaltyFlat = (cfg.rob_fail_penalty != null && cfg.rob_fail_penalty > 0) ? cfg.rob_fail_penalty : 0;
      const fine = penaltyFlat > 0
        ? Math.min(penaltyFlat, robber.balance)
        : Math.min(Math.floor(robber.balance * 0.20), robber.balance);
      db.removeCoins(interaction.user.id, interaction.guildId, fine);
      db.addCoins(target.id, interaction.guildId, Math.floor(fine * 0.5));

      await interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🚔 Pris en flagrant délit !')
        .setDescription(`**${target.username}** t'a vu et a appelé la police ! Tu paies une amende de **${fine.toLocaleString('fr-FR')}${symbol}**.`)
        .addFields(
          { name: '💸 Amende',      value: `**-${fine.toLocaleString('fr-FR')}${symbol}**`,                 inline: true },
          { name: '💰 Victime',     value: `a récupéré **+${Math.floor(fine*0.5).toLocaleString('fr-FR')}${symbol}**`, inline: true },
        )
        .setFooter({ text: 'Prochain vol dans 12h' })
      ]}).catch(() => {});
    }
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

  async run(message, args) {
    const targetMention = message.mentions.users.first();
    if (!targetMention) return message.reply('❌ Usage : `&rob @membre`');

    const fakeInteraction = {
      user: message.author,
      guildId: message.guildId,
      deferred: false,
      replied: false,
      options: {
        getUser: (k) => k === 'cible' ? targetMention : null,
        getMember: () => null,
      },
      reply: async (d) => { const m = await message.channel.send(d).catch(() => {}); fakeInteraction._msg = m; return m; },
      editReply: async (d) => fakeInteraction._msg ? fakeInteraction._msg.edit(d).catch(() => {}) : message.channel.send(d).catch(() => {}),
      deferReply: async () => {},
      _msg: null,
    };
    await module.exports.execute(fakeInteraction);
  },
};
