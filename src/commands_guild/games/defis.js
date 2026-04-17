const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS defis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    defi_id TEXT, completed_at INTEGER,
    date TEXT,
    UNIQUE(guild_id, user_id, defi_id, date)
  )`).run();
} catch {}

const DAILY_DEFIS = [
  { id: 'casino_1', label: '🎰 Jouer au casino', desc: 'Jouer 1 fois au casino', reward: 100 },
  { id: 'casino_3', label: '🎰 Casino x3', desc: 'Jouer 3 fois au casino', reward: 250 },
  { id: 'msg_10', label: '💬 Bavard', desc: 'Envoyer 10 messages', reward: 150 },
  { id: 'peche_5', label: '🎣 Pêcheur', desc: 'Pêcher 5 fois', reward: 200 },
  { id: 'mine_5', label: '⛏️ Mineur', desc: 'Miner 5 fois', reward: 200 },
  { id: 'quiz_5', label: '🧠 Savant', desc: 'Répondre à 5 questions de quiz', reward: 300 },
  { id: 'donate_500', label: '💸 Généreux', desc: 'Donner 500 coins à quelqu\'un', reward: 150 },
  { id: 'streak_check', label: '🔥 Streak', desc: 'Réclamer votre streak quotidien', reward: 75 },
];

function getTodayStr() { return new Date().toISOString().slice(0, 10); }

// Sélectionner 3 défis aléatoires pour aujourd'hui (stable par serveur+jour)
function getDailyDefis(guildId) {
  const date = getTodayStr();
  const seed = parseInt(date.replace(/-/g,'')) + parseInt(guildId.slice(-4));
  const shuffled = [...DAILY_DEFIS].sort((a, b) => {
    const ha = (seed + a.id.charCodeAt(0)) % 997;
    const hb = (seed + b.id.charCodeAt(0)) % 997;
    return ha - hb;
  });
  return shuffled.slice(0, 3);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('defis')
    .setDescription('⚡ Défis quotidiens — Accomplissez des missions pour des récompenses')
    .addSubcommand(s => s.setName('voir').setDescription('⚡ Voir vos défis du jour'))
    .addSubcommand(s => s.setName('valider').setDescription('✅ Valider un défi accompli (Staff)')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      .addStringOption(o => o.setName('defi').setDescription('ID du défi').setRequired(true)
        .addChoices(...DAILY_DEFIS.map(d => ({ name: d.label, value: d.id })))))
    .addSubcommand(s => s.setName('stats').setDescription('📊 Voir vos statistiques de défis')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';
    const today = getTodayStr();
    const dailyDefis = getDailyDefis(guildId);

    if (sub === 'voir') {
      const completed = db.db.prepare('SELECT defi_id FROM defis WHERE guild_id=? AND user_id=? AND date=?').all(guildId, userId, today).map(d => d.defi_id);

      const totalReward = dailyDefis.reduce((a, d) => a + d.reward, 0);
      const earned = dailyDefis.filter(d => completed.includes(d.id)).reduce((a, d) => a + d.reward, 0);

      const lines = dailyDefis.map(d => {
        const done = completed.includes(d.id);
        return `${done ? '✅' : '⏳'} **${d.label}** — ${d.desc}\n> Récompense: **${d.reward} ${coin}**`;
      }).join('\n\n');

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('⚡ Défis du Jour')
          .setDescription(lines)
          .addFields(
            { name: '💰 Progression', value: `**${earned}/${totalReward} ${coin}**`, inline: true },
            { name: '✅ Complétés', value: `**${completed.length}/${dailyDefis.length}**`, inline: true },
          )
          .setFooter({ text: `Se réinitialise à minuit • ${today}` })
      ]});
    }

    if (sub === 'valider') {
      if (!interaction.member.permissions.has(0x4000n)) return interaction.reply({ content: '❌ Staff uniquement.', ephemeral: true });

      const target = interaction.options.getUser('membre');
      const defiId = interaction.options.getString('defi');
      const defi = DAILY_DEFIS.find(d => d.id === defiId);

      if (!dailyDefis.find(d => d.id === defiId)) return interaction.reply({ content: '❌ Ce défi n\'est pas disponible aujourd\'hui.', ephemeral: true });

      try {
        db.db.prepare('INSERT INTO defis (guild_id, user_id, defi_id, completed_at, date) VALUES (?,?,?,?,?)').run(guildId, target.id, defiId, Math.floor(Date.now()/1000), today);
      } catch {
        return interaction.reply({ content: `❌ <@${target.id}> a déjà complété ce défi aujourd'hui.`, ephemeral: true });
      }

      db.addCoins(target.id, guildId, defi.reward);
      return interaction.reply({ content: `✅ Défi **${defi.label}** validé pour <@${target.id}> ! +${defi.reward} ${coin}` });
    }

    if (sub === 'stats') {
      const total = db.db.prepare('SELECT COUNT(*) as c, SUM(d2.reward) as earned FROM defis d JOIN (SELECT id, reward FROM (VALUES ' + DAILY_DEFIS.map(d => `('${d.id}', ${d.reward})`).join(',') + ') as v(id, reward)) d2 ON d.defi_id=d2.id WHERE d.guild_id=? AND d.user_id=?').get(guildId, userId);
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('📊 Statistiques Défis')
          .addFields({ name: '✅ Défis complétés', value: `**${total?.c || 0}**`, inline: true })
      ], ephemeral: true });
    }
  }
};
