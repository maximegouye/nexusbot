// wheel-mega.js — 🎡 Mega Wheel : roue géante avec multipliers x1, x2, x5, x10, x40, x100, x1000
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { applyRtp, capWin } = require('../../utils/realCasinoEngine');

// Slots de la roue (54 slots comme Crazy Time / Mega Wheel)
// Distribution : maison gagne 6% (RTP 94%)
const WHEEL = [
  { mult: 1,    weight: 22, color: '⚪' }, // 22/54 = 40.7%
  { mult: 2,    weight: 15, color: '🔵' }, // 27.8%
  { mult: 5,    weight: 7,  color: '🟢' }, // 13%
  { mult: 10,   weight: 4,  color: '🟡' }, // 7.4%
  { mult: 20,   weight: 3,  color: '🟠' }, // 5.5%
  { mult: 40,   weight: 2,  color: '🔴' }, // 3.7%
  { mult: 100,  weight: 0.7,color: '🟣' }, // 1.3%
  { mult: 1000, weight: 0.3,color: '💎' }, // 0.55% (jackpot)
];
const TOTAL_W = WHEEL.reduce((s, x) => s + x.weight, 0);

function spin() {
  const r = Math.random() * TOTAL_W;
  let acc = 0;
  for (const slot of WHEEL) {
    acc += slot.weight;
    if (r < acc) return slot;
  }
  return WHEEL[0];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wheel-mega')
    .setDescription('🎡 Mega Wheel — roue géante avec multipliers jusqu\'à x1000 !')
    .addIntegerOption(o => o.setName('mise').setDescription('Mise (min 500)').setMinValue(500).setMaxValue(1000000).setRequired(true)),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    try {
      const mise = interaction.options.getInteger('mise');
      const cfg  = db.getConfig(interaction.guildId);
      const emoji= cfg.currency_emoji || '€';
      const name = cfg.currency_name  || 'Euros';
      const u    = db.getUser(interaction.user.id, interaction.guildId);

      if (u.balance < mise) {
        return interaction.editReply({ content: `❌ Tu as besoin de ${mise.toLocaleString('fr')} ${emoji}.` });
      }

      db.removeCoins(interaction.user.id, interaction.guildId, mise);

      // Animation : 4 frames de spin avec slots aléatoires
      const frames = ['⚪🔵🟢🟡🟠🔴', '🔵🟢🟡🟠🔴⚪', '🟢🟡🟠🔴⚪🔵', '🟡🟠🔴⚪🔵🟢'];
      for (let i = 0; i < 3; i++) {
        await interaction.editReply({ embeds: [new EmbedBuilder()
          .setColor('#9B59B6').setTitle('🎡 ・ Mega Wheel ・ La roue tourne...')
          .setDescription(`\`\`\`\n      ▼\n${frames[i % 4]}\n${frames[(i+1) % 4]}\n${frames[(i+2) % 4]}\n\`\`\``)
        ]}).catch(() => {});
        await new Promise(r => setTimeout(r, 600));
      }

      // Résultat
      const result = spin();
      let win = mise * result.mult;
      win = applyRtp('wheel-mega', mise, win);
      win = capWin('wheel-mega', mise, win);

      if (win > 0) db.addCoins(interaction.user.id, interaction.guildId, win);

      const profit = win - mise;
      const isJackpot = result.mult >= 1000;
      const isMega    = result.mult >= 100;
      const isBig     = result.mult >= 20;

      const color = isJackpot ? '#FFD700' : isMega ? '#E91E63' : isBig ? '#E67E22' : profit >= 0 ? '#2ECC71' : '#95A5A6';
      const titleEmoji = isJackpot ? '💎' : isMega ? '🔥' : profit >= 0 ? '✅' : '💸';
      const title = isJackpot ? 'MEGA JACKPOT x1000 !!!' : isMega ? 'MEGA WIN !' : isBig ? 'BIG WIN !' : profit >= 0 ? 'Gagné' : 'Perdu';

      const finalDisplay = `\`\`\`\n      ▼\n     ${result.color}\n   ×${result.mult}\n\`\`\``;

      const e = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${titleEmoji} ・ Mega Wheel ・ ${title}`)
        .setDescription(finalDisplay)
        .addFields(
          { name: '🎯 Multiplier', value: `**×${result.mult}**`, inline: true },
          { name: '💰 Mise',       value: `${mise.toLocaleString('fr')} ${emoji}`, inline: true },
          { name: '💵 Gain',       value: `${win.toLocaleString('fr')} ${emoji} (${profit >= 0 ? '+' : ''}${profit.toLocaleString('fr')})`, inline: true },
        )
        .setFooter({ text: `RTP 94% • Distribution : x1 (41%) → x1000 (0.55%)` });

      await interaction.editReply({ embeds: [e] });

    } catch (err) {
      console.error('[CMD wheel-mega]', err);
      await interaction.editReply({ content: `❌ Erreur : ${err?.message || err}` }).catch(() => {});
    }
  }
};
