const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS peche (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    total_fish INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    last_fish INTEGER DEFAULT 0,
    rod_level INTEGER DEFAULT 1,
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

const FISH = [
  { emoji: '🦐', name: 'Crevette',    rarity: 'commun',     min: 5,   max: 20,   weight: 50 },
  { emoji: '🐟', name: 'Poisson',     rarity: 'commun',     min: 15,  max: 50,   weight: 35 },
  { emoji: '🐠', name: 'P. Clown',    rarity: 'peu commun', min: 40,  max: 100,  weight: 25 },
  { emoji: '🐡', name: 'Poisson-Globe',rarity:'peu commun', min: 60,  max: 150,  weight: 20 },
  { emoji: '🦑', name: 'Calamar',     rarity: 'rare',       min: 100, max: 250,  weight: 12 },
  { emoji: '🦞', name: 'Homard',      rarity: 'rare',       min: 150, max: 400,  weight: 8 },
  { emoji: '🦈', name: 'Requin',      rarity: 'épique',     min: 400, max: 800,  weight: 4 },
  { emoji: '🐙', name: 'Pieuvre',     rarity: 'épique',     min: 500, max: 1000, weight: 3 },
  { emoji: '🐳', name: 'Baleine',     rarity: 'légendaire', min: 1500,max: 3000, weight: 1 },
  { emoji: '💎', name: 'Poisson Bleu',rarity: 'mythique',   min: 5000,max: 8000, weight: 0.3 },
  { emoji: '🥾', name: 'Vieille Botte',rarity: 'commun',   min: 0,   max: 0,    weight: 15, trash: true },
];

function pickFish() {
  const totalWeight = FISH.reduce((a, f) => a + f.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const f of FISH) {
    rand -= f.weight;
    if (rand <= 0) return f;
  }
  return FISH[0];
}

const COOLDOWN = 30; // 30 secondes entre chaque pêche

module.exports = {
  data: new SlashCommandBuilder()
    .setName('peche')
    .setDescription('🎣 Lancez votre ligne et pêchez des poissons !')
    .addSubcommand(s => s.setName('pecher').setDescription('🎣 Lancer la ligne et pêcher'))
    .addSubcommand(s => s.setName('stats').setDescription('📊 Voir vos statistiques de pêche')
      .addUserOption(o => o.setName('membre').setDescription('Voir les stats d\'un membre')))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Top des meilleurs pêcheurs'))
    .addSubcommand(s => s.setName('canne').setDescription('🎣 Améliorer votre canne à pêche')
      .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true)
        .addChoices(
          { name: '👀 Voir les améliorations', value: 'voir' },
          { name: '⬆️ Améliorer (coûte des €)', value: 'ameliorer' },
        ))),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';
    const now = Math.floor(Date.now() / 1000);

    let p = db.db.prepare('SELECT * FROM peche WHERE guild_id=? AND user_id=?').get(guildId, userId);
    if (!p) {
      db.db.prepare('INSERT INTO peche (guild_id, user_id) VALUES (?,?)').run(guildId, userId);
      p = db.db.prepare('SELECT * FROM peche WHERE guild_id=? AND user_id=?').get(guildId, userId);
    }

    if (sub === 'pecher') {
      const cd = COOLDOWN - (now - p.last_fish);
      if (cd > 0) {
        return interaction.editReply({ content: `⏳ Patience ! Réessayez dans **${cd}s**.`, ephemeral: true });
      }

      await new Promise(r => setTimeout(r, 1500)); // suspense

      const fish = pickFish();
      let gain = 0;
      let desc = '';

      if (fish.trash) {
        desc = `Vous avez pêché **${fish.emoji} une ${fish.name}**... Aucun gain.`;
      } else {
        const bonusMultiplier = 1 + (p.rod_level - 1) * 0.1; // +10% par niveau de canne
        gain = Math.floor((fish.min + Math.random() * (fish.max - fish.min)) * bonusMultiplier);
        db.addCoins(userId, guildId, gain);
        desc = `Vous avez pêché **${fish.emoji} ${fish.name}** *(${fish.rarity})*\nGain : **+${gain} ${coin}** !`;
        if (fish.rarity === 'légendaire' || fish.rarity === 'mythique') desc += '\n🎉 **PRISE EXCEPTIONNELLE !**';
      }

      db.db.prepare('UPDATE peche SET total_fish=total_fish+1, total_earned=total_earned+?, last_fish=? WHERE guild_id=? AND user_id=?')
        .run(gain, now, guildId, userId);

      const rarityColors = { commun: '#95A5A6', 'peu commun': '#2ECC71', rare: '#3498DB', épique: '#9B59B6', légendaire: '#F1C40F', mythique: '#E74C3C' };
      await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder()
          .setColor(rarityColors[fish.rarity] || '#7B2FBE')
          .setTitle('🎣 Résultat de pêche')
          .setDescription(desc)
          .setFooter({ text: `Canne niv.${p.rod_level} • Pêches totales: ${p.total_fish + 1}` })
      ]});
    }

    if (sub === 'stats') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const stats = db.db.prepare('SELECT * FROM peche WHERE guild_id=? AND user_id=?').get(guildId, target.id) || { total_fish: 0, total_earned: 0, rod_level: 1 };
      await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#3498DB').setTitle(`🎣 Stats de pêche — ${target.username}`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: '🐟 Poissons pêchés', value: `**${stats.total_fish}**`, inline: true },
            { name: '€ Total gagné', value: `**${stats.total_earned} ${coin}**`, inline: true },
            { name: '🎣 Niveau canne', value: `**${stats.rod_level}**`, inline: true },
          )
      ], ephemeral: true });
    }

    if (sub === 'classement') {
      const top = db.db.prepare('SELECT * FROM peche WHERE guild_id=? ORDER BY total_earned DESC LIMIT 10').all(guildId);
      if (!top.length) {
        await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun pêcheur.', ephemeral: true });
        return;
      }
      const medals = ['🥇', '🥈', '🥉'];
      const lines = top.map((t, i) => `${medals[i] || `**${i+1}.**`} <@${t.user_id}> — 🐟 ${t.total_fish} | € ${t.total_earned} ${coin}`).join('\n');
      await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#3498DB').setTitle('🏆 Meilleurs Pêcheurs').setDescription(lines)
      ]});
    }

    if (sub === 'canne') {
      const action = interaction.options.getString('action');
      const upgradeCosts = [0, 200, 500, 1200, 3000, 7000, 15000, 30000, 60000, 100000];
      const maxLevel = 10;

      if (action === 'voir') {
        const lines = upgradeCosts.slice(1).map((cost, i) => {
          const level = i + 2;
          const isCurrent = p.rod_level === level - 1;
          return `${isCurrent ? '**→** ' : ''}Niv.${level} — ${cost} ${coin} | Bonus: +${(level - 1) * 10}%`;
        }).join('\n');
        await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          new EmbedBuilder().setColor('#F1C40F').setTitle('🎣 Améliorations de canne')
            .setDescription(`Niveau actuel : **${p.rod_level}** (+${(p.rod_level - 1) * 10}% de gain)\n\n${lines}`)
        ], ephemeral: true });
      }

      if (action === 'ameliorer') {
        if (p.rod_level >= maxLevel) {
          await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '✅ Canne déjà au niveau maximum !', ephemeral: true });
          return;
        }
        const cost = upgradeCosts[p.rod_level];
        const u = db.getUser(userId, guildId);
        if (u.balance < cost) {
          await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Insuffisant ! Coût: **${cost} ${coin}**.`, ephemeral: true });
          return;
        }

        db.addCoins(userId, guildId, -cost);
        db.db.prepare('UPDATE peche SET rod_level=rod_level+1 WHERE guild_id=? AND user_id=?').run(guildId, userId);
        await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          new EmbedBuilder().setColor('#F1C40F').setTitle('✅ Canne améliorée !')
            .setDescription(`Niv.**${p.rod_level}** → Niv.**${p.rod_level + 1}** | Bonus: **+${p.rod_level * 10}%** sur les gains`)
        ]});
      }
    }
  }
};
