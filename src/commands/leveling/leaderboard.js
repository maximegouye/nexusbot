const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db');
const { getLeaderboard } = require('../../utils/leaderboardCache');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('🏆 Classement du serveur')
    .addStringOption(o => o.setName('type').setDescription('Type de classement').setRequired(false)
      .addChoices(
        { name: '⭐ XP / Niveau', value: 'xp' },
        { name: '💶 €', value: 'coins' },
        { name: '🎤 Temps vocal', value: 'voice' },
        { name: '💬 Messages', value: 'messages' },
        { name: '⭐ Réputation', value: 'rep' },
      )),
  cooldown: 10,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    const cfg  = db.getConfig(interaction.guildId);
    const emoji = cfg.currency_emoji || '€';
    const name  = cfg.currency_name  || 'Coins';
    const type  = interaction.options.getString('type') || 'xp';

    const buildEmbed = async (t) => {
      let rows, title, valueFn;

      if (t === 'xp') {
        rows    = getLeaderboard(interaction.guildId, 'xp', 10);
        title   = '⭐ Classement XP';
        valueFn = (u) => `Niv. **${u.level}** — **${(u.xp || 0).toLocaleString('fr-FR')} XP**`;
      } else if (t === 'coins') {
        rows    = getLeaderboard(interaction.guildId, 'coins', 10);
        title   = '💶 Classement Richesse';
        valueFn = (u) => `**${((u.balance || 0) + (u.bank || 0)).toLocaleString('fr-FR')} €**`;
      } else if (t === 'voice') {
        rows    = getLeaderboard(interaction.guildId, 'voice', 10);
        title   = '🎤 Classement Vocal';
        valueFn = (u) => {
          const h = Math.floor((u.voice_minutes || 0) / 60);
          const m = (u.voice_minutes || 0) % 60;
          return `**${h}h ${m}min** en vocal`;
        };
      } else if (t === 'messages') {
        rows    = getLeaderboard(interaction.guildId, 'messages', 10);
        title   = '💬 Classement Messages';
        valueFn = (u) => `**${(u.message_count || 0).toLocaleString('fr-FR')} messages**`;
      } else if (t === 'rep') {
        rows    = db.db.prepare('SELECT user_id, reputation FROM users WHERE guild_id = ? ORDER BY reputation DESC LIMIT 10').all(interaction.guildId);
        title   = '⭐ Classement Réputation';
        valueFn = (u) => `**+${(u.reputation || 0)} rep**`;
      }

      const embed = new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle(title)
        .setFooter({ text: `Serveur : ${interaction.guild.name}` })
        .setTimestamp();

      if (!rows || !rows.length) {
        embed.setDescription('Aucun membre dans ce classement pour l\'instant.');
        return embed;
      }

      let desc = '';
      for (let i = 0; i < rows.length; i++) {
        const u       = rows[i];
        const medal   = MEDALS[i] || `**${i + 1}.**`;
        let username;
        try {
          const member = await interaction.guild.members.fetch(u.user_id).catch(() => null);
          username = member?.displayName || `<@${u.user_id}>`;
        } catch {
          username = `<@${u.user_id}>`;
        }
        const isMe = u.user_id === interaction.user.id ? ' ← toi' : '';
        desc += `${medal} **${username}**${isMe} — ${valueFn(u)}\n`;
      }
      embed.setDescription(desc);
      return embed;
    };

    const embed = await buildEmbed(type);

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('lb_select')
        .setPlaceholder('Changer de classement')
        .addOptions([
          { label: '⭐ XP / Niveau',  value: 'xp',       default: type === 'xp' },
          { label: '💶 €',             value: 'coins',    default: type === 'coins' },
          { label: '🎤 Temps vocal',  value: 'voice',    default: type === 'voice' },
          { label: '💬 Messages',     value: 'messages', default: type === 'messages' },
          { label: '⭐ Réputation',   value: 'rep',      default: type === 'rep' },
        ])
    );

    const msg = await (interaction.deferred||interaction.replied ? interaction.editReply({ embeds: [embed], components: [menu], fetchReply: true }) : interaction.reply({ embeds: [embed], components: [menu], fetchReply: true }));

    const collector = msg.createMessageComponentCollector({ time: 120000 });
    collector.on('collect', async i => {
      const selected = i.values[0];
      const newEmbed = await buildEmbed(selected);
      await i.update({ embeds: [newEmbed] });
    });
    collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
  }
};
