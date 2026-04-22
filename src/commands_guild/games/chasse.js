const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS chasse (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    total_kills INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    last_hunt INTEGER DEFAULT 0,
    rifle_level INTEGER DEFAULT 1,
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

const ANIMALS = [
  { emoji: '🐇', name: 'Lapin',     rarity: 'commun',     min: 10,  max: 40,   weight: 40 },
  { emoji: '🦊', name: 'Renard',    rarity: 'commun',     min: 25,  max: 80,   weight: 30 },
  { emoji: '🦌', name: 'Cerf',      rarity: 'peu commun', min: 60,  max: 180,  weight: 18 },
  { emoji: '🐗', name: 'Sanglier',  rarity: 'peu commun', min: 100, max: 250,  weight: 14 },
  { emoji: '🐻', name: 'Ours',      rarity: 'rare',       min: 200, max: 500,  weight: 8 },
  { emoji: '🦁', name: 'Lion',      rarity: 'épique',     min: 400, max: 900,  weight: 4 },
  { emoji: '🐉', name: 'Dragon',    rarity: 'légendaire', min: 2000,max: 5000, weight: 1 },
  { emoji: '💨', name: 'Vent',      rarity: 'commun',     min: 0,   max: 0,    weight: 20, miss: true },
];

const COOLDOWN = 30;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('chasse')
    .setDescription('🏹 Partez à la chasse et gagnez des coins !')
    .addSubcommand(s => s.setName('chasser').setDescription('🏹 Tirer sur un animal'))
    .addSubcommand(s => s.setName('stats').setDescription('📊 Vos statistiques de chasse')
      .addUserOption(o => o.setName('membre').setDescription('Voir les stats d\'un membre')))
    .addSubcommand(s => s.setName('fusil').setDescription('🔫 Améliorer votre fusil')
      .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true)
        .addChoices({ name: '👀 Voir', value: 'voir' }, { name: '⬆️ Améliorer', value: 'ameliorer' })))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Top chasseurs')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';
    const now = Math.floor(Date.now() / 1000);

    let c = db.db.prepare('SELECT * FROM chasse WHERE guild_id=? AND user_id=?').get(guildId, userId);
    if (!c) {
      db.db.prepare('INSERT INTO chasse (guild_id, user_id) VALUES (?,?)').run(guildId, userId);
      c = db.db.prepare('SELECT * FROM chasse WHERE guild_id=? AND user_id=?').get(guildId, userId);
    }

    if (sub === 'chasser') {
      const cd = COOLDOWN - (now - c.last_hunt);
      if (cd > 0) return interaction.editReply({ content: `🔫 Rechargement dans **${cd}s**.`, ephemeral: true });

      await interaction.deferReply();
      await new Promise(r => setTimeout(r, 1000));

      const totalWeight = ANIMALS.reduce((a, a2) => a + a2.weight, 0);
      let rand = Math.random() * totalWeight;
      let animal = ANIMALS[0];
      for (const a of ANIMALS) { rand -= a.weight; if (rand <= 0) { animal = a; break; } }

      const bonus = 1 + (c.rifle_level - 1) * 0.12;
      const gain = animal.miss ? 0 : Math.floor((animal.min + Math.random() * (animal.max - animal.min)) * bonus);

      db.db.prepare('UPDATE chasse SET total_kills=total_kills+?, total_earned=total_earned+?, last_hunt=? WHERE guild_id=? AND user_id=?')
        .run(animal.miss ? 0 : 1, gain, now, guildId, userId);
      if (gain > 0) db.addCoins(userId, guildId, gain);

      const colors = { commun: '#95A5A6', 'peu commun': '#2ECC71', rare: '#3498DB', épique: '#9B59B6', légendaire: '#F1C40F' };
      const desc = animal.miss
        ? `💨 Vous avez raté ! L'animal s'est enfui...`
        : `Vous avez abattu **${animal.emoji} ${animal.name}** *(${animal.rarity})* !\nGain : **+${gain} ${coin}**`;

      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor(animal.miss ? '#95A5A6' : colors[animal.rarity] || '#95A5A6')
          .setTitle('🏹 Résultat de chasse').setDescription(desc)
          .setFooter({ text: `Fusil niv.${c.rifle_level} • Kills: ${c.total_kills + (animal.miss ? 0 : 1)}` })
      ]});
    }

    if (sub === 'stats') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const stats = db.db.prepare('SELECT * FROM chasse WHERE guild_id=? AND user_id=?').get(guildId, target.id) || { total_kills: 0, total_earned: 0, rifle_level: 1 };
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#8B4513').setTitle(`🏹 Stats de chasse — ${target.username}`)
          .addFields(
            { name: '🎯 Kills', value: `**${stats.total_kills}**`, inline: true },
            { name: '💰 Gagné', value: `**${stats.total_earned} ${coin}**`, inline: true },
            { name: '🔫 Fusil', value: `Niv.**${stats.rifle_level}**`, inline: true },
          )
      ], ephemeral: true });
    }

    if (sub === 'fusil') {
      const action = interaction.options.getString('action');
      const costs = [0, 250, 600, 1500, 3500, 8000, 18000];
      if (action === 'voir') {
        const lines = costs.slice(1).map((cost, i) => `Niv.**${i+2}** — ${cost} ${coin} | Bonus: +${(i+1)*12}%`).join('\n');
        return interaction.editReply({ embeds: [
          new EmbedBuilder().setColor('#8B4513').setTitle('🔫 Améliorations Fusil')
            .setDescription(`Niveau actuel : **${c.rifle_level}** (+${(c.rifle_level-1)*12}%)\n\n${lines}`)
        ], ephemeral: true });
      }
      if (c.rifle_level >= 7) return interaction.editReply({ content: '✅ Fusil au niveau maximum !', ephemeral: true });
      const cost = costs[c.rifle_level];
      const u = db.getUser(userId, guildId);
      if (u.balance < cost) return interaction.editReply({ content: `❌ Coût: **${cost} ${coin}**.`, ephemeral: true });
      db.addCoins(userId, guildId, -cost);
      db.db.prepare('UPDATE chasse SET rifle_level=rifle_level+1 WHERE guild_id=? AND user_id=?').run(guildId, userId);
      return interaction.editReply({ content: `✅ Fusil amélioré → Niv.**${c.rifle_level+1}** !` });
    }

    if (sub === 'classement') {
      const top = db.db.prepare('SELECT * FROM chasse WHERE guild_id=? ORDER BY total_earned DESC LIMIT 10').all(guildId);
      if (!top.length) return interaction.editReply({ content: '❌ Aucun chasseur.', ephemeral: true });
      const medals = ['🥇', '🥈', '🥉'];
      const lines = top.map((t, i) => `${medals[i] || `**${i+1}.**`} <@${t.user_id}> — 🎯 ${t.total_kills} | 💰 ${t.total_earned} ${coin}`).join('\n');
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#8B4513').setTitle('🏆 Meilleurs Chasseurs').setDescription(lines)
      ]});
    }
  }
};
