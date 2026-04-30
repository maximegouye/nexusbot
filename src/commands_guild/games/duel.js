const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS duel_stats (
    id INTEGER PRIMARY KEY, guild_id TEXT, user_id TEXT,
    wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, streak INTEGER DEFAULT 0,
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

const WEAPONS = ['⚔️ Épée', '🪄 Magie', '🏹 Arc', '🔥 Feu', '❄️ Glace', '⚡ Foudre', '🌊 Eau', '🌪️ Vent'];
const OUTCOMES = [
  (a, b) => `${a} esquive l'attaque de ${b} et riposte avec une frappe parfaite !`,
  (a, b) => `${a} surpasse ${b} grâce à sa technique supérieure !`,
  (a, b) => `${b} trébuche, ${a} en profite pour porter le coup fatal !`,
  (a, b) => `${a} invoque une puissance cachée et écrase ${b} !`,
  (a, b) => `La stratégie de ${a} est trop sophistiquée pour ${b} !`,
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('⚔️ Défis et combats entre membres')
    .addSubcommand(s => s.setName('defier').setDescription('⚔️ Défier un membre en duel')
      .addUserOption(o => o.setName('adversaire').setDescription('Qui défier ?').setRequired(true))
      .addStringOption(o => o.setName('mise').setDescription('Coins à miser (optionnel, all/tout/50%) — ILLIMITÉ').setMaxLength(30)))
    .addSubcommand(s => s.setName('stats').setDescription('📊 Voir tes statistiques de duel')
      .addUserOption(o => o.setName('membre').setDescription('Voir les stats d\'un autre')))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Classement des duellistes')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';

    if (sub === 'defier') {
      const opponent = interaction.options.getUser('adversaire');
      const _me = db.getUser(userId, guildId);
      const parseBet = (raw, base) => {
        if (raw == null) return 0;
        const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
        if (!s) return 0;
        if (s === 'all' || s === 'tout' || s === 'max') return Math.max(0, Number(base || 0));
        if (s === 'half' || s === 'moitié' || s === 'moitie' || s === '50%') return Math.floor(Number(base || 0) / 2);
        const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
        if (!m) return NaN;
        const n = parseFloat(m[1]);
        if (m[2] === '%') return Math.floor((n / 100) * Number(base || 0));
        return Math.floor(n);
      };
      const miseRaw = interaction.options.getString('mise');
      const mise = parseBet(miseRaw, _me.balance);
      if (!Number.isFinite(mise) || mise < 0) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Mise invalide.', ephemeral: true });
      }

      if (opponent.bot) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas défier un bot !', ephemeral: true });
      if (opponent.id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas te défier toi-même !', ephemeral: true });

      if (mise > 0) {
        const u1 = db.getUser(userId, guildId);
        const u2 = db.getUser(opponent.id, guildId);
        if (u1.balance < mise) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Tu n'as pas assez de ${coin}.`, ephemeral: true });
        if (u2.balance < mise) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ <@${opponent.id}> n'a pas assez de ${coin}.`, ephemeral: true });
      }

      const accept = new ButtonBuilder().setCustomId(`duel_accept_${userId}_${opponent.id}_${mise}`).setLabel('Accepter ⚔️').setStyle(ButtonStyle.Danger);
      const refuse = new ButtonBuilder().setCustomId(`duel_refuse_${userId}`).setLabel('Fuir 🏃').setStyle(ButtonStyle.Secondary);
      const row = new ActionRowBuilder().addComponents(accept, refuse);

      const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('⚔️ Défi lancé !')
        .setDescription(`<@${userId}> défie <@${opponent.id}> en duel !\n${mise > 0 ? `\n💰 Mise : **${mise} ${coin}** chacun\n` : ''}\n<@${opponent.id}>, acceptes-tu ce défi ?`)
        .setFooter({ text: 'Le défi expire dans 60 secondes' });

      const msg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `<@${opponent.id}>`, embeds: [embed], components: [row], fetchReply: true });

      const collector = msg.createMessageComponentCollector({ time: 60000 });
      collector.on('collect', async i => {
        if (i.user.id !== opponent.id) return i.reply({ content: '❌ Ce duel ne te concerne pas.', ephemeral: true });

        if (i.customId.startsWith('duel_refuse_')) {
          return i.update({ embeds: [new EmbedBuilder().setColor('Grey').setDescription(`🏃 <@${opponent.id}> a pris la fuite...`)], components: [] });
        }

        // Combat !
        const weapon1 = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
        const weapon2 = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
        const winner = Math.random() < 0.5 ? userId : opponent.id;
        const loser = winner === userId ? opponent.id : userId;
        const outcome = OUTCOMES[Math.floor(Math.random() * OUTCOMES.length)];
        const story = outcome(`<@${winner}>`, `<@${loser}>`);

        // Mise
        if (mise > 0) {
          db.addCoins(loser, guildId, -mise);
          db.addCoins(winner, guildId, mise);
        }

        // Stats
        for (const [uid, win] of [[winner, true], [loser, false]]) {
          const s = db.db.prepare('SELECT * FROM duel_stats WHERE guild_id=? AND user_id=?').get(guildId, uid);
          if (s) {
            db.db.prepare('UPDATE duel_stats SET wins=wins+?, losses=losses+?, streak=? WHERE id=?')
              .run(win ? 1 : 0, win ? 0 : 1, win ? s.streak + 1 : 0, s.id);
          } else {
            db.db.prepare('INSERT INTO duel_stats (guild_id, user_id, wins, losses, streak) VALUES (?,?,?,?,?)')
              .run(guildId, uid, win ? 1 : 0, win ? 0 : 1, win ? 1 : 0);
          }
        }

        const resultEmbed = new EmbedBuilder()
          .setColor('Gold')
          .setTitle('⚔️ Résultat du Duel !')
          .addFields(
            { name: `<@${userId}> utilisait`, value: weapon1, inline: true },
            { name: `<@${opponent.id}> utilisait`, value: weapon2, inline: true },
          )
          .setDescription(`\n${story}\n\n🏆 **Vainqueur : <@${winner}>**${mise > 0 ? ` (+${mise} ${coin})` : ''}`)
          .setTimestamp();

        await i.update({ embeds: [resultEmbed], components: [] });
        collector.stop();
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ components: [] }).catch(() => {});
      });
    }

    if (sub === 'stats') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const stats = db.db.prepare('SELECT * FROM duel_stats WHERE guild_id=? AND user_id=?').get(guildId, target.id);
      const total = stats ? stats.wins + stats.losses : 0;
      const ratio = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : '0';

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Gold')
          .setTitle(`⚔️ Stats de duel — ${target.username}`)
          .addFields(
            { name: '✅ Victoires', value: `**${stats?.wins || 0}**`, inline: true },
            { name: '❌ Défaites', value: `**${stats?.losses || 0}**`, inline: true },
            { name: '🔥 Série actuelle', value: `**${stats?.streak || 0}**`, inline: true },
            { name: '📊 Ratio', value: `**${ratio}%**`, inline: true },
            { name: '⚔️ Total combats', value: `**${total}**`, inline: true },
          ).setTimestamp()
      ], ephemeral: true });
    }

    if (sub === 'classement') {
      const top = db.db.prepare('SELECT * FROM duel_stats WHERE guild_id=? ORDER BY wins DESC LIMIT 10').all(guildId);
      if (!top.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun duel enregistré.', ephemeral: true });

      const medals = ['🥇', '🥈', '🥉'];
      const lines = top.map((s, i) => `${medals[i] || `**${i+1}.**`} <@${s.user_id}> — **${s.wins}W / ${s.losses}L** (🔥 ${s.streak})`).join('\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Gold').setTitle('🏆 Classement Duels').setDescription(lines).setTimestamp()
      ]});
    }
  }
};

// Désactivé pour libérer slot Discord (limite 100 cmds)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
