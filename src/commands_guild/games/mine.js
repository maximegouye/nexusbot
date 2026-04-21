const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS mine (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    total_mined INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    last_mine INTEGER DEFAULT 0,
    pickaxe_level INTEGER DEFAULT 1,
    depth INTEGER DEFAULT 1,
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

const ORES = [
  { emoji: '🪨', name: 'Pierre',     rarity: 'commun',     min: 2,   max: 10,   weight: 50, minDepth: 1 },
  { emoji: '⚫', name: 'Charbon',    rarity: 'commun',     min: 8,   max: 25,   weight: 40, minDepth: 1 },
  { emoji: '🪙', name: 'Cuivre',     rarity: 'peu commun', min: 20,  max: 60,   weight: 28, minDepth: 2 },
  { emoji: '⚙️', name: 'Fer',        rarity: 'peu commun', min: 40,  max: 100,  weight: 22, minDepth: 3 },
  { emoji: '🔵', name: 'Lapis',      rarity: 'rare',       min: 80,  max: 200,  weight: 14, minDepth: 4 },
  { emoji: '🟡', name: 'Or',         rarity: 'rare',       min: 150, max: 350,  weight: 10, minDepth: 5 },
  { emoji: '💎', name: 'Diamant',    rarity: 'épique',     min: 400, max: 900,  weight: 5,  minDepth: 7 },
  { emoji: '🔴', name: 'Rubis',      rarity: 'légendaire', min: 1000,max: 2500, weight: 2,  minDepth: 9 },
  { emoji: '🌟', name: 'Étoile',     rarity: 'mythique',   min: 5000,max: 10000,weight: 0.5,minDepth: 10 },
];

const COOLDOWN = 45;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mine')
    .setDescription('⛏️ Creusez des mines pour trouver des minerais précieux !')
    .addSubcommand(s => s.setName('creuser').setDescription('⛏️ Creuser pour trouver des minerais'))
    .addSubcommand(s => s.setName('profondeur').setDescription('⬇️ Descendre plus profond dans la mine')
    .addSubcommand(s => s.setName('pioche').setDescription('⛏️ Améliorer votre pioche')
      .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true)
        .addChoices(
          { name: '👀 Voir les améliorations', value: 'voir' },
          { name: '⬆️ Améliorer', value: 'ameliorer' },
        )))
    .addSubcommand(s => s.setName('stats').setDescription('📊 Vos statistiques minières'))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Top des mineurs')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';
    const now = Math.floor(Date.now() / 1000);

    let m = db.db.prepare('SELECT * FROM mine WHERE guild_id=? AND user_id=?').get(guildId, userId);
    if (!m) {
      db.db.prepare('INSERT INTO mine (guild_id, user_id) VALUES (?,?)').run(guildId, userId);
      m = db.db.prepare('SELECT * FROM mine WHERE guild_id=? AND user_id=?').get(guildId, userId);
    }

    if (sub === 'creuser') {
      const cd = COOLDOWN - (now - m.last_mine);
      if (cd > 0) return interaction.reply({ content: `⏳ Pioche en refroidissement ! Réessayez dans **${cd}s**.`, ephemeral: true });

      await interaction.deferReply();
      await new Promise(r => setTimeout(r, 1200));

      // Filtrer les minerais disponibles selon la profondeur
      const available = ORES.filter(o => o.minDepth <= m.depth);
      const totalWeight = available.reduce((a, o) => a + o.weight, 0);
      let rand = Math.random() * totalWeight;
      let ore = available[0];
      for (const o of available) {
        rand -= o.weight;
        if (rand <= 0) { ore = o; break; }
      }

      const bonus = 1 + (m.pickaxe_level - 1) * 0.15;
      const gain = ore.min === 0 ? 0 : Math.floor((ore.min + Math.random() * (ore.max - ore.min)) * bonus);

      if (gain > 0) db.addCoins(userId, guildId, gain);
      db.db.prepare('UPDATE mine SET total_mined=total_mined+1, total_earned=total_earned+?, last_mine=? WHERE guild_id=? AND user_id=?')
        .run(gain, now, guildId, userId);

      const rarityColors = { commun: '#95A5A6', 'peu commun': '#2ECC71', rare: '#3498DB', épique: '#9B59B6', légendaire: '#F1C40F', mythique: '#E74C3C' };
      return interaction.editReply({ embeds: [
        new EmbedBuilder()
          .setColor(rarityColors[ore.rarity] || '#95A5A6')
          .setTitle('⛏️ Résultat de fouille')
          .setDescription(`Vous avez trouvé **${ore.emoji} ${ore.name}** *(${ore.rarity})*\nGain : **+${gain} ${coin}**${gain === 0 ? ' (sans valeur)' : ''}`)
          .setFooter({ text: `Profondeur: ${m.depth} | Pioche niv.${m.pickaxe_level} | Total: ${m.total_mined + 1} fouilles` })
      ]});
    }

    if (sub === 'profondeur') {
      const niveau = interaction.options.getInteger('niveau');
      const depthCosts = [0, 0, 300, 800, 2000, 5000, 12000, 25000, 50000, 100000];

      if (niveau <= m.depth) return interaction.reply({ content: `❌ Vous êtes déjà à la profondeur **${m.depth}**. Choisissez un niveau plus élevé.`, ephemeral: true });

      let totalCost = 0;
      for (let i = m.depth + 1; i <= niveau; i++) totalCost += depthCosts[i - 1] || 100000;

      const u = db.getUser(userId, guildId);
      if (u.balance < totalCost) return interaction.reply({ content: `❌ Coût total pour atteindre la profondeur ${niveau}: **${totalCost} ${coin}**.`, ephemeral: true });

      db.addCoins(userId, guildId, -totalCost);
      db.db.prepare('UPDATE mine SET depth=? WHERE guild_id=? AND user_id=?').run(niveau, guildId, userId);

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#8B4513').setTitle('⬇️ Nouveau palier atteint !')
          .setDescription(`Profondeur **${m.depth}** → **${niveau}**\nNouveau minerai disponible : **${ORES.find(o => o.minDepth === niveau)?.emoji || ''} ${ORES.find(o => o.minDepth === niveau)?.name || ''}**`)
          .addFields({ name: '💰 Coût', value: `-${totalCost} ${coin}`, inline: true })
      ]});
    }

    if (sub === 'pioche') {
      const action = interaction.options.getString('action');
      const costs = [0, 300, 800, 2000, 5000, 12000, 25000, 60000, 150000];
      if (action === 'voir') {
        const lines = costs.slice(1).map((c, i) => `Niv.**${i + 2}** — ${c} ${coin} | Bonus: +${(i + 1) * 15}%`).join('\n');
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor('#8B4513').setTitle('⛏️ Améliorations pioche')
            .setDescription(`Niveau actuel : **${m.pickaxe_level}** (+${(m.pickaxe_level - 1) * 15}%)\n\n${lines}`)
        ], ephemeral: true });
      }
      if (m.pickaxe_level >= 9) return interaction.reply({ content: '✅ Pioche déjà maximale !', ephemeral: true });
      const cost = costs[m.pickaxe_level];
      const u = db.getUser(userId, guildId);
      if (u.balance < cost) return interaction.reply({ content: `❌ Insuffisant ! Coût: **${cost} ${coin}**.`, ephemeral: true });
      db.addCoins(userId, guildId, -cost);
      db.db.prepare('UPDATE mine SET pickaxe_level=pickaxe_level+1 WHERE guild_id=? AND user_id=?').run(guildId, userId);
      return interaction.reply({ content: `✅ Pioche améliorée → Niv.**${m.pickaxe_level + 1}** (+${m.pickaxe_level * 15}%)`, ephemeral: false });
    }

    if (sub === 'stats') {
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#8B4513').setTitle('⛏️ Vos Stats Minières')
          .addFields(
            { name: '⛏️ Fouilles', value: `**${m.total_mined}**`, inline: true },
            { name: '💰 Total gagné', value: `**${m.total_earned} ${coin}**`, inline: true },
            { name: '⬇️ Profondeur', value: `**${m.depth}/10**`, inline: true },
            { name: '🔨 Niveau pioche', value: `**${m.pickaxe_level}**`, inline: true },
          )
      ], ephemeral: true });
    }

    if (sub === 'classement') {
      const top = db.db.prepare('SELECT * FROM mine WHERE guild_id=? ORDER BY total_earned DESC LIMIT 10').all(guildId);
      if (!top.length) return interaction.reply({ content: '❌ Aucun mineur.', ephemeral: true });
      const medals = ['🥇', '🥈', '🥉'];
      const lines = top.map((t, i) => `${medals[i] || `**${i+1}.**`} <@${t.user_id}> — ⛏️ ${t.total_mined} | 💰 ${t.total_earned} ${coin}`).join('\n');
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#8B4513').setTitle('🏆 Meilleurs Mineurs').setDescription(lines)
      ]});
    }
  }
};
