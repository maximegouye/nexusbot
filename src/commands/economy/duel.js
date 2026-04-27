const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

const WEAPONS = [
  { name: 'Épée', emoji: '⚔️' }, { name: 'Arc', emoji: '🏹' },
  { name: 'Magie', emoji: '🔮' }, { name: 'Dague', emoji: '🗡️' },
  { name: 'Masse', emoji: '🔨' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('⚔️ Défie un membre en duel pour voler ses coins !')
    .addUserOption(o => o.setName('adversaire').setDescription('Ton adversaire').setRequired(true)),
  cooldown: 10,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    try {
    const opponent = interaction.options.getUser('adversaire');
    const mise     = interaction.options.getInteger('mise');
    const cfg      = db.getConfig(interaction.guildId);
    const emoji    = cfg.currency_emoji || '🪙';
    const name     = cfg.currency_name  || 'Coins';

    if (opponent.bot) return interaction.editReply({ content: '❌ Tu ne peux pas défier un bot.', ephemeral: true });
    if (opponent.id === interaction.user.id) return interaction.editReply({ content: '❌ Tu ne peux pas te battre contre toi-même.', ephemeral: true });

    const challenger = db.getUser(interaction.user.id, interaction.guildId);
    const defender   = db.getUser(opponent.id, interaction.guildId);

    if (challenger.balance < mise) return interaction.editReply({ content: `❌ Tu n'as que **${challenger.balance.toLocaleString('fr')} ${name}**.`, ephemeral: true });
    if (defender.balance < mise) return interaction.editReply({ content: `❌ **${opponent.username}** n'a que **${defender.balance.toLocaleString('fr')} ${name}**. Mise trop élevée.`, ephemeral: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('duel_accept').setLabel('⚔️ Accepter le duel').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('duel_refuse').setLabel('🏳️ Refuser').setStyle(ButtonStyle.Secondary),
    );

    const msg = await interaction.editReply({
      content: `${opponent} — Tu es défié(e) en duel !`,
      embeds: [new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('⚔️ Duel lancé !')
        .setDescription(`**${interaction.user.username}** défie **${opponent.username}** en combat !\n\n💰 Mise : **${mise.toLocaleString('fr')} ${name}** chacun\n🏆 Le gagnant emporte **${(mise * 2).toLocaleString('fr')} ${name}**`)
        .setFooter({ text: `${opponent.username} a 60 secondes pour accepter` })
      ],
      components: [row],
      fetchReply: true
    });

    const collector = msg.createMessageComponentCollector({
      filter: i => i.user.id === opponent.id,
      time: 60000, max: 1
    });

    collector.on('collect', async i => {
      if (i.customId === 'duel_refuse') {
        return i.update({
          embeds: [new EmbedBuilder().setColor('#888888').setDescription(`🏳️ **${opponent.username}** a refusé le duel. Quelle trouille !`)],
          components: []
        });
      }

      // Duel accepté — simulation de combat
      db.removeCoins(interaction.user.id, interaction.guildId, mise);
      db.removeCoins(opponent.id, interaction.guildId, mise);

      const challengerHP = 100 + challenger.level * 5;
      const defenderHP   = 100 + defender.level * 5;
      let cHP = challengerHP, dHP = defenderHP;

      const rounds = [];
      for (let r = 1; r <= 5 && cHP > 0 && dHP > 0; r++) {
        const cWeapon = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
        const dWeapon = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
        const cDmg = Math.floor(Math.random() * 30) + 10 + challenger.level;
        const dDmg = Math.floor(Math.random() * 30) + 10 + defender.level;
        dHP -= cDmg;
        cHP -= dDmg;
        rounds.push(`Tour ${r}: ${interaction.user.username} ${cWeapon.emoji}(-${cDmg}) | ${opponent.username} ${dWeapon.emoji}(-${dDmg})`);
      }

      const cWon = cHP > dHP;
      const winner = cWon ? interaction.user : opponent;
      const loser  = cWon ? opponent : interaction.user;

      db.addCoins(winner.id, interaction.guildId, mise * 2);

      await i.update({
        embeds: [new EmbedBuilder()
          .setColor(cWon ? '#F39C12' : '#8E44AD')
          .setTitle(`⚔️ Duel terminé — 🏆 ${winner.username} gagne !`)
          .setDescription(rounds.join('\n'))
          .addFields(
            { name: `❤️ PV ${interaction.user.username}`, value: `${Math.max(0, cHP)}`, inline: true },
            { name: `❤️ PV ${opponent.username}`,         value: `${Math.max(0, dHP)}`, inline: true },
            { name: '💰 Gains',                            value: `+**${(mise * 2).toLocaleString('fr')} ${name}**`, inline: true },
          )
          .setFooter({ text: `${loser.username} perd sa mise !` })
        ],
        components: []
      });
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') msg.edit({ content: '⏱️ Duel expiré.', components: [] }).catch(() => {});
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
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
