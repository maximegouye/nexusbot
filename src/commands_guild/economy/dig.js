const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const ITEMS = [
  { name: 'Caillou',        emoji: '🪨', rarity: 'commun',     value: [5, 20],   chance: 35 },
  { name: 'Terre',          emoji: '🟫', rarity: 'commun',     value: [1, 10],   chance: 25 },
  { name: 'Ver de terre',   emoji: '🪱', rarity: 'commun',     value: [8, 25],   chance: 15 },
  { name: 'Pièce rouillée', emoji: '🪙', rarity: 'peu commun', value: [30, 80],  chance: 10 },
  { name: 'Fossile',        emoji: '🦕', rarity: 'rare',       value: [80, 200], chance: 8  },
  { name: 'Cristal',        emoji: '💎', rarity: 'épique',     value: [200, 500],chance: 4  },
  { name: 'Trésor',         emoji: '🏺', rarity: 'légendaire', value: [500, 1200],chance: 2 },
  { name: 'Rien',           emoji: '💨', rarity: null,         value: [0, 0],    chance: 1  },
];

const RARITY_COLORS = {
  'commun': '#AAAAAA', 'peu commun': '#2ECC71', 'rare': '#3498DB',
  'épique': '#9B59B6', 'légendaire': '#F39C12',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('creuser')
    .setDescription('⛏️ Creuse le sol pour trouver des trésors cachés ! (cooldown 30min)'),
  cooldown: 3,

  async execute(interaction) {
    const cfg  = db.getConfig(interaction.guildId);
    const user = db.getUser(interaction.user.id, interaction.guildId);
    const emoji = cfg.currency_emoji || '€';
    const name  = cfg.currency_name  || 'Euros';
    const now   = Math.floor(Date.now() / 1000);
    const cd    = 1800;

    if (now - (user.last_dig || 0) < cd) {
      const rem = cd - (now - (user.last_dig || 0));
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#FF6B6B').setDescription(`⛏️ Ta pelle est fatiguée ! Attends encore **${Math.floor(rem/60)} min** avant de recreuser.`)],
        ephemeral: true
      });
    }

    // Tirage aléatoire pondéré
    const roll = Math.random() * 100;
    let acc = 0;
    let found = ITEMS[ITEMS.length - 1];
    for (const item of ITEMS) {
      acc += item.chance;
      if (roll < acc) { found = item; break; }
    }

    const value = found.value[0] + Math.floor(Math.random() * (found.value[1] - found.value[0]));
    db.db.prepare('UPDATE users SET last_dig = ? WHERE user_id = ? AND guild_id = ?').run(now, interaction.user.id, interaction.guildId);

    if (value > 0) db.addCoins(interaction.user.id, interaction.guildId, value);

    const color = found.rarity ? RARITY_COLORS[found.rarity] : '#888888';
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`⛏️ Résultat du creusage`)
      .setDescription(value > 0
        ? `Tu as trouvé **${found.emoji} ${found.name}** et tu gagnes **${value.toLocaleString('fr')} ${name}** ${emoji} !`
        : `Tu n'as trouvé que de la terre... Mieux vaut creuser ailleurs la prochaine fois.`)
      .setFooter({ text: found.rarity ? `Rareté : ${found.rarity}` : 'Raté !' });

    await interaction.reply({ embeds: [embed] });
  }
};
