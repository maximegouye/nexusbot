const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const CRIMES = [
  { name: 'Pickpocket',      emoji: '🤏', min: 30,  max: 90,   fine: 60,  risk: 0.35 },
  { name: 'Vol de voiture',  emoji: '🚗', min: 80,  max: 200,  fine: 120, risk: 0.40 },
  { name: 'Fraude bancaire', emoji: '💳', min: 150, max: 400,  fine: 250, risk: 0.45 },
  { name: 'Braquage',        emoji: '🔫', min: 250, max: 600,  fine: 400, risk: 0.50 },
  { name: 'Trafic',          emoji: '📦', min: 100, max: 350,  fine: 180, risk: 0.40 },
  { name: 'Piratage',        emoji: '💻', min: 120, max: 450,  fine: 200, risk: 0.42 },
  { name: 'Contrefaçon',     emoji: '🖨️', min: 80,  max: 280,  fine: 150, risk: 0.38 },
  { name: 'Escroquerie',     emoji: '🎭', min: 60,  max: 220,  fine: 100, risk: 0.35 },
  { name: 'Casino illégal',  emoji: '🎰', min: 200, max: 800,  fine: 350, risk: 0.55 },
  { name: 'Contrebande',     emoji: '🛳️', min: 300, max: 900,  fine: 500, risk: 0.50 },
];

const CAUGHT_MSGS = [
  'Tu as été pris en flagrant délit par la police !',
  'Un témoin t\'a dénoncé à la police. Menottes !',
  'Les caméras de surveillance t\'ont identifié.',
  'La brigade criminelle t\'attendait...',
  'Tu t\'es trompé de cible — c\'était un agent undercover.',
];

const SUCCESS_MSGS = [
  'Tu t\'en es sorti sans te faire remarquer.',
  'Opération réussie ! Tu disparais dans la nature.',
  'En or ! Personne n\'a rien vu.',
  'Tu t\'en es tiré de justesse mais tu as les mains pleines.',
  'Mission accomplie, fais profil bas pendant quelques heures.',
];

module.exports = {
  name: 'crime',
  aliases: ['criminel', 'delinquant'],
  data: new SlashCommandBuilder()
    .setName('crime')
    .setDescription('🦹 Tente une activité illégale (risqué mais lucratif — cooldown 6h)'),
  cooldown: 3,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* déjà ack */ }
    }

    try {
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const symbol = cfg.currency_emoji || '€';

    const now       = Math.floor(Date.now() / 1000);
    const lastCrime = user.last_crime || 0;
    const cooldown  = cfg.crime_cooldown > 0 ? cfg.crime_cooldown : 21600;

    if (now - lastCrime < cooldown) {
      const remaining = cooldown - (now - lastCrime);
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('🚔 Trop risqué !')
          .setDescription(`La police surveille ! Attends **${h}h ${m}min** avant ta prochaine tentative.`)
          .setFooter({ text: 'Utilise /work ou /daily en attendant' })
        ], ephemeral: true
      });
    }

    const crime = CRIMES[Math.floor(Math.random() * CRIMES.length)];
    const failRate = (cfg.crime_fail_rate != null && cfg.crime_fail_rate >= 0 && cfg.crime_fail_rate <= 100)
      ? cfg.crime_fail_rate / 100
      : crime.risk;
    const success = Math.random() > failRate;

    db.db.prepare('UPDATE users SET last_crime = ? WHERE user_id = ? AND guild_id = ?')
      .run(now, interaction.user.id, interaction.guildId);

    // ── Animation de suspense ─────────────────────────────
    const replyFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);

    const suspenseFrames = [
      { color: '#2C3E50', title: `🔍 Planification de l'opération...`, desc: `\`\`\`\n📋  Analyse de la cible...\n🗺️  Repérage du terrain...\n${crime.emoji}  ${crime.name} en préparation...\n\`\`\`` },
      { color: '#8E44AD', title: `${crime.emoji} Passage à l'acte...`, desc: `\`\`\`\n⚡  Exécution en cours...\n${'█'.repeat(10)}${'░'.repeat(10)}\n🔕  Silence total...\n\`\`\`` },
      { color: '#E67E22', title: `⏳ En fuite...`, desc: `\`\`\`\n🚨  ${'·  '.repeat(6)}\n🏃  En cours de fuite...\n${'▓'.repeat(16)}${'░'.repeat(4)}\n\`\`\`` },
    ];

    await replyFn({ embeds: [new EmbedBuilder().setColor(suspenseFrames[0].color).setTitle(suspenseFrames[0].title).setDescription(suspenseFrames[0].desc)] }).catch(() => {});
    await sleep(800);
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(suspenseFrames[1].color).setTitle(suspenseFrames[1].title).setDescription(suspenseFrames[1].desc)] }).catch(() => {});
    await sleep(800);
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(suspenseFrames[2].color).setTitle(suspenseFrames[2].title).setDescription(suspenseFrames[2].desc)] }).catch(() => {});
    await sleep(900);

    if (success) {
      const gMin = (cfg.crime_min != null && cfg.crime_min > 0) ? cfg.crime_min : crime.min;
      const gMax = (cfg.crime_max != null && cfg.crime_max > 0) ? cfg.crime_max : crime.max;
      const [lo, hi] = gMin <= gMax ? [gMin, gMax] : [gMax, gMin];
      const earned = Math.floor(Math.random() * (hi - lo + 1)) + lo;
      db.addCoins(interaction.user.id, interaction.guildId, earned);

      const msg = SUCCESS_MSGS[Math.floor(Math.random() * SUCCESS_MSGS.length)];
      await interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(`${crime.emoji} ${crime.name} — Réussi !`)
        .setDescription(`> *${msg}*`)
        .addFields(
          { name: '💰 Butin',          value: `**+${earned.toLocaleString('fr-FR')}${symbol}**`,            inline: true },
          { name: '🎲 Crime',          value: crime.name,                                                   inline: true },
          { name: '📊 Risque pris',    value: `${Math.round(crime.risk * 100)}%`,                           inline: true },
          { name: `${symbol} Solde`,   value: `**${(user.balance + earned).toLocaleString('fr-FR')}${symbol}**`, inline: true },
        )
        .setFooter({ text: 'Prochain crime dans 6h • Joue avec modération !' })
        .setTimestamp()
      ]}).catch(() => {});
    } else {
      const fine = Math.min(crime.fine, Math.max(10, Math.floor(user.balance * 0.3)));
      db.removeCoins(interaction.user.id, interaction.guildId, fine);

      const msg = CAUGHT_MSGS[Math.floor(Math.random() * CAUGHT_MSGS.length)];
      await interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle(`🚔 ${crime.name} — Arrêté !`)
        .setDescription(`> *${msg}*`)
        .addFields(
          { name: '💸 Amende',         value: `**-${fine.toLocaleString('fr-FR')}${symbol}**`,              inline: true },
          { name: '🎲 Crime',          value: crime.name,                                                   inline: true },
          { name: '📊 Risque',         value: `${Math.round(crime.risk * 100)}%`,                           inline: true },
          { name: `${symbol} Solde`,   value: `**${Math.max(0, user.balance - fine).toLocaleString('fr-FR')}${symbol}**`, inline: true },
        )
        .setFooter({ text: 'Prochain crime dans 6h' })
        .setTimestamp()
      ]}).catch(() => {});
    }
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
