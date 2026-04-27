module.exports = {}; // DISABLED — exceeds 100 cmd limit
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS donjon (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    floor INTEGER DEFAULT 1,
    hp INTEGER DEFAULT 100,
    max_hp INTEGER DEFAULT 100,
    atk INTEGER DEFAULT 15,
    def INTEGER DEFAULT 5,
    total_floors INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    last_run INTEGER DEFAULT 0,
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

const MONSTERS = [
  { name: 'Gobelin',       emoji: '👺', hp: 30,  atk: 8,  reward: [20, 60],   level: 1 },
  { name: 'Squelette',     emoji: '💀', hp: 45,  atk: 12, reward: [40, 100],  level: 2 },
  { name: 'Orc',           emoji: '👹', hp: 60,  atk: 16, reward: [70, 150],  level: 3 },
  { name: 'Vampire',       emoji: '🧛', hp: 80,  atk: 20, reward: [120, 250], level: 4 },
  { name: 'Démon',         emoji: '😈', hp: 100, atk: 25, reward: [200, 400], level: 5 },
  { name: 'Dragon',        emoji: '🐉', hp: 150, atk: 35, reward: [400, 800], level: 7 },
  { name: 'Dieu Obscur',   emoji: '🌑', hp: 200, atk: 50, reward: [1000,2000],level: 10 },
];

const COOLDOWN = 120;

const activeRuns = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('donjon')
    .setDescription('⚔️ Explorez le donjon et combattez des monstres !')
    .addSubcommand(s => s.setName('explorer').setDescription('⚔️ Explorer le prochain étage'))
    .addSubcommand(s => s.setName('personnage').setDescription('🧙 Voir votre personnage'))
    .addSubcommand(s => s.setName('ameliorer').setDescription('⬆️ Améliorer votre personnage')
      .addStringOption(o => o.setName('stat').setDescription('Stat à améliorer').setRequired(true)
        .addChoices(
          { name: '❤️ PV Maximum (+20 PV)', value: 'hp' },
          { name: '⚔️ Attaque (+5 ATK)', value: 'atk' },
          { name: '🛡️ Défense (+3 DEF)', value: 'def' },
        )))
    .addSubcommand(s => s.setName('reset').setDescription('🔄 Recommencer du début (garde les stats)'))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Top explorateurs du donjon')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';
    const now = Math.floor(Date.now() / 1000);

    let hero = db.db.prepare('SELECT * FROM donjon WHERE guild_id=? AND user_id=?').get(guildId, userId);
    if (!hero) {
      db.db.prepare('INSERT INTO donjon (guild_id, user_id) VALUES (?,?)').run(guildId, userId);
      hero = db.db.prepare('SELECT * FROM donjon WHERE guild_id=? AND user_id=?').get(guildId, userId);
    }

    if (sub === 'personnage') {
      const hpBar = '█'.repeat(Math.floor(hero.hp / hero.max_hp * 10)) + '░'.repeat(10 - Math.floor(hero.hp / hero.max_hp * 10));
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#9B59B6').setTitle(`🧙 ${interaction.user.username}`)
          .addFields(
            { name: '❤️ PV', value: `${hpBar} ${hero.hp}/${hero.max_hp}`, inline: false },
            { name: '⚔️ Attaque', value: `**${hero.atk}**`, inline: true },
            { name: '🛡️ Défense', value: `**${hero.def}**`, inline: true },
            { name: '🏰 Étage actuel', value: `**${hero.floor}**`, inline: true },
            { name: '🗺️ Étages explorés', value: `**${hero.total_floors}**`, inline: true },
            { name: '💰 Total gagné', value: `**${hero.total_earned} ${coin}**`, inline: true },
          )
      ], ephemeral: true });
    }

    if (sub === 'explorer') {
      if (hero.hp <= 0) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Votre héros est mort ! Utilisez `/donjon reset` pour recommencer.', ephemeral: true });
      const cd = COOLDOWN - (now - hero.last_run);
      if (cd > 0) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `⏳ Récupération en cours ! Prêt dans **${cd}s**.`, ephemeral: true });

      // Choisir un monstre selon l'étage
      const monsterLevel = Math.min(Math.ceil(hero.floor / 5), MONSTERS.length);
      const possibleMonsters = MONSTERS.filter(m => m.level <= monsterLevel);
      const monster = { ...possibleMonsters[Math.floor(Math.random() * possibleMonsters.length)] };
      // Scaling du monstre selon l'étage
      const scale = 1 + (hero.floor - 1) * 0.1;
      monster.hp = Math.floor(monster.hp * scale);
      monster.atk = Math.floor(monster.atk * scale);

      // Simulation de combat
      let heroHp = hero.hp;
      let monsterHp = monster.hp;
      let rounds = 0;
      const log = [];

      while (heroHp > 0 && monsterHp > 0 && rounds < 20) {
        const heroAtk = Math.max(1, hero.atk + Math.floor(Math.random() * 6) - 2);
        const heroDmg = Math.max(1, heroAtk - Math.floor(monster.atk * 0.1));
        monsterHp -= heroDmg;

        if (monsterHp <= 0) break;

        const monsterDmg = Math.max(1, monster.atk - hero.def + Math.floor(Math.random() * 4));
        heroHp -= monsterDmg;
        rounds++;
      }

      const won = monsterHp <= 0;
      db.db.prepare('UPDATE donjon SET last_run=? WHERE guild_id=? AND user_id=?').run(now, guildId, userId);

      if (won) {
        const [minR, maxR] = monster.reward;
        const gain = Math.floor(minR + Math.random() * (maxR - minR));
        const newHp = Math.max(1, Math.min(hero.max_hp, heroHp));
        const newFloor = hero.floor + 1;

        db.addCoins(userId, guildId, gain);
        db.db.prepare('UPDATE donjon SET hp=?, floor=?, total_floors=total_floors+1, total_earned=total_earned+? WHERE guild_id=? AND user_id=?')
          .run(newHp, newFloor, gain, guildId, userId);

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          new EmbedBuilder().setColor('#2ECC71').setTitle(`⚔️ Victoire ! Étage ${hero.floor}`)
            .setDescription(`Vous avez vaincu **${monster.emoji} ${monster.name}** !\nGain : **+${gain} ${coin}**`)
            .addFields(
              { name: '❤️ PV restants', value: `${newHp}/${hero.max_hp}`, inline: true },
              { name: '🏰 Prochain étage', value: `**${newFloor}**`, inline: true },
            )
        ]});
      } else {
        const dmgTaken = hero.hp - Math.max(0, heroHp);
        const newHp = Math.max(0, heroHp);

        db.db.prepare('UPDATE donjon SET hp=? WHERE guild_id=? AND user_id=?').run(newHp, guildId, userId);

        if (newHp <= 0) {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
            new EmbedBuilder().setColor('#E74C3C').setTitle(`💀 Défaite — Étage ${hero.floor}`)
              .setDescription(`**${monster.emoji} ${monster.name}** vous a vaincu !\nVotre héros est mort. Utilisez \`/donjon reset\` pour recommencer.`)
          ]});
        }

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          new EmbedBuilder().setColor('#E74C3C').setTitle(`💔 Défaite — Étage ${hero.floor}`)
            .setDescription(`**${monster.emoji} ${monster.name}** vous a repoussé !\nPV perdus : ${dmgTaken}`)
            .addFields({ name: '❤️ PV restants', value: `${newHp}/${hero.max_hp}`, inline: true })
        ]});
      }
    }

    if (sub === 'ameliorer') {
      const stat = interaction.options.getString('stat');
      const costs = { hp: 200, atk: 300, def: 250 };
      const cost = costs[stat];
      const u = db.getUser(userId, guildId);
      if (u.balance < cost) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Coût : **${cost} ${coin}**.`, ephemeral: true });

      db.addCoins(userId, guildId, -cost);
      if (stat === 'hp') db.db.prepare('UPDATE donjon SET max_hp=max_hp+20, hp=hp+20 WHERE guild_id=? AND user_id=?').run(guildId, userId);
      if (stat === 'atk') db.db.prepare('UPDATE donjon SET atk=atk+5 WHERE guild_id=? AND user_id=?').run(guildId, userId);
      if (stat === 'def') db.db.prepare('UPDATE donjon SET def=def+3 WHERE guild_id=? AND user_id=?').run(guildId, userId);

      const labels = { hp: '❤️ +20 PV', atk: '⚔️ +5 ATK', def: '🛡️ +3 DEF' };
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ **${labels[stat]}** ! (-${cost} ${coin})` });
    }

    if (sub === 'reset') {
      db.db.prepare('UPDATE donjon SET hp=max_hp, floor=1 WHERE guild_id=? AND user_id=?').run(guildId, userId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '🔄 Votre héros a été réinitialisé au rez-de-chaussée avec tous ses PV. Les stats sont conservées.', ephemeral: true });
    }

    if (sub === 'classement') {
      const top = db.db.prepare('SELECT * FROM donjon WHERE guild_id=? ORDER BY total_floors DESC LIMIT 10').all(guildId);
      if (!top.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun explorateur.', ephemeral: true });
      const medals = ['🥇', '🥈', '🥉'];
      const lines = top.map((t, i) => `${medals[i] || `**${i+1}.**`} <@${t.user_id}> — 🏰 Étage ${t.floor} | 🗺️ ${t.total_floors} | 💰 ${t.total_earned} ${coin}`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#9B59B6').setTitle('🏆 Meilleurs Explorateurs').setDescription(lines)
      ]});
    }
  }
};
