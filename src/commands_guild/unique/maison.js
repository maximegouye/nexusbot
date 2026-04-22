/**
 * NexusBot — Système de maison virtuelle
 * UNIQUE : construire, décorer, améliorer votre maison. Visiter celles des autres.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS maisons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    name TEXT DEFAULT 'Ma Maison',
    level INTEGER DEFAULT 1,
    style TEXT DEFAULT 'moderne',
    rooms INTEGER DEFAULT 1,
    furniture INTEGER DEFAULT 0,
    garden INTEGER DEFAULT 0,
    pool INTEGER DEFAULT 0,
    garage INTEGER DEFAULT 0,
    prestige_score INTEGER DEFAULT 0,
    visits INTEGER DEFAULT 0,
    last_visit_reward INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

const STYLES = {
  moderne:   { emoji: '🏠', description: 'Architecture moderne et minimaliste', cost: 0 },
  chateau:   { emoji: '🏰', description: 'Château médiéval majestueux', cost: 5000 },
  japonais:  { emoji: '🏯', description: 'Architecture japonaise traditionnelle', cost: 4000 },
  futuriste: { emoji: '🚀', description: 'Design futuriste high-tech', cost: 6000 },
  campagne:  { emoji: '🌾', description: 'Maison de campagne chaleureuse', cost: 2000 },
  balnéaire: { emoji: '🌊', description: 'Villa sur la plage', cost: 4500 },
};

const UPGRADES = {
  rooms:    { name: 'Pièces', emoji: '🚪', basePrice: 800,  max: 10, desc: 'Ajouter une pièce (+prestige)' },
  furniture:{ name: 'Meubles', emoji: '🛋️', basePrice: 500, max: 20, desc: 'Meubler une pièce (+prestige)' },
  garden:   { name: 'Jardin', emoji: '🌺', basePrice: 1500, max: 1,  desc: 'Ajouter un jardin paysager' },
  pool:     { name: 'Piscine', emoji: '🏊', basePrice: 3000, max: 1,  desc: 'Ajouter une piscine' },
  garage:   { name: 'Garage', emoji: '🚗', basePrice: 2000, max: 1,  desc: 'Ajouter un garage double' },
};

function calcPrestige(house) {
  return (house.rooms * 10) + (house.furniture * 5) + (house.garden * 25) + (house.pool * 40) + (house.garage * 20) + (house.level * 15);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('maison')
    .setDescription('🏠 Gérez votre maison virtuelle — décorez, améliorez, invitez !')
    .addSubcommand(s => s.setName('construire').setDescription('🏗️ Construire votre maison')
      .addStringOption(o => o.setName('nom').setDescription('Nom de votre maison').setRequired(true).setMaxLength(40)))
    .addSubcommand(s => s.setName('voir').setDescription('🏠 Voir votre maison (ou celle d\'un autre)')
      .addUserOption(o => o.setName('membre').setDescription('Voir la maison d\'un autre')))
    .addSubcommand(s => s.setName('ameliorer').setDescription('⬆️ Améliorer votre maison')
      .addStringOption(o => o.setName('type').setDescription('Type d\'amélioration').setRequired(true)
        .addChoices(
          { name: '🚪 Pièces — Ajouter une pièce', value: 'rooms' },
          { name: '🛋️ Meubles — Ajouter des meubles', value: 'furniture' },
          { name: '🌺 Jardin — Ajouter un jardin', value: 'garden' },
          { name: '🏊 Piscine — Ajouter une piscine', value: 'pool' },
          { name: '🚗 Garage — Ajouter un garage', value: 'garage' },
        )))
    .addSubcommand(s => s.setName('style').setDescription('🎨 Changer le style de votre maison')
      .addStringOption(o => o.setName('style').setDescription('Nouveau style').setRequired(true)
        .addChoices(...Object.entries(STYLES).map(([k, v]) => ({ name: `${v.emoji} ${k} — ${v.description}`, value: k })))))
    .addSubcommand(s => s.setName('renommer').setDescription('✏️ Renommer votre maison')
      .addStringOption(o => o.setName('nom').setDescription('Nouveau nom').setRequired(true).setMaxLength(40)))
    .addSubcommand(s => s.setName('visiter').setDescription('🚶 Visiter la maison d\'un autre membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre à visiter').setRequired(true)))
    .addSubcommand(s => s.setName('top').setDescription('🏆 Classement des maisons les plus prestigieuses')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';
    const now = Math.floor(Date.now() / 1000);

    if (sub === 'construire') {
      const existing = db.db.prepare('SELECT id FROM maisons WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (existing) return interaction.editReply({ content: '❌ Vous avez déjà une maison ! Utilisez `/maison voir` pour la consulter.', ephemeral: true });

      const cost = 500;
      const u = db.getUser(userId, guildId);
      if ((u.balance || 0) < cost) return interaction.editReply({ content: `❌ Construire une maison coûte **${cost} ${coin}**.`, ephemeral: true });

      const nom = interaction.options.getString('nom');
      db.addCoins(userId, guildId, -cost);
      db.db.prepare('INSERT INTO maisons (guild_id,user_id,name) VALUES(?,?,?)').run(guildId, userId, nom);

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('🏠 Maison construite !')
        .setDescription(`**${nom}** est maintenant votre chez-vous ! Décorez-la avec \`/maison ameliorer\`.`)
        .addFields(
          { name: '💰 Coût', value: `-${cost} ${coin}`, inline: true },
          { name: '🏠 Style', value: '🏠 Moderne', inline: true },
          { name: '🚪 Pièces', value: '1', inline: true },
        )
        .setFooter({ text: 'Plus vous améliorez, plus votre prestige augmente !' })
      ]});
    }

    if (sub === 'voir') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const house = db.db.prepare('SELECT * FROM maisons WHERE guild_id=? AND user_id=?').get(guildId, target.id);
      if (!house) return interaction.editReply({ content: `❌ **${target.username}** n'a pas encore de maison.`, ephemeral: true });

      const style = STYLES[house.style] || STYLES.moderne;
      const prestige = calcPrestige(house);

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#3498DB').setTitle(`${style.emoji} ${house.name}`)
        .setDescription(`Propriétaire : <@${target.id}> • ${style.emoji} Style **${house.style}**`)
        .addFields(
          { name: '🚪 Pièces', value: `**${house.rooms}**/10`, inline: true },
          { name: '🛋️ Meubles', value: `**${house.furniture}**/20`, inline: true },
          { name: '🌺 Jardin', value: house.garden ? '✅ Oui' : '❌ Non', inline: true },
          { name: '🏊 Piscine', value: house.pool ? '✅ Oui' : '❌ Non', inline: true },
          { name: '🚗 Garage', value: house.garage ? '✅ Oui' : '❌ Non', inline: true },
          { name: '⭐ Prestige', value: `**${prestige}** pts`, inline: true },
          { name: '👁️ Visites', value: `**${house.visits}**`, inline: true },
        )
      ]});
    }

    if (sub === 'ameliorer') {
      const house = db.db.prepare('SELECT * FROM maisons WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!house) return interaction.editReply({ content: '❌ Vous n\'avez pas de maison. Utilisez `/maison construire`.', ephemeral: true });

      const type = interaction.options.getString('type');
      const upg = UPGRADES[type];
      const current = house[type];
      if (current >= upg.max) return interaction.editReply({ content: `❌ Vous avez déjà le maximum de **${upg.name}** (${upg.max}).`, ephemeral: true });

      const cost = upg.basePrice * (current + 1);
      const u = db.getUser(userId, guildId);
      if ((u.balance || 0) < cost) return interaction.editReply({ content: `❌ Cette amélioration coûte **${cost.toLocaleString()} ${coin}**.`, ephemeral: true });

      db.addCoins(userId, guildId, -cost);
      db.db.prepare(`UPDATE maisons SET ${type}=${type}+1, prestige_score=? WHERE guild_id=? AND user_id=?`)
        .run(calcPrestige({ ...house, [type]: current + 1 }), guildId, userId);

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle(`${upg.emoji} ${upg.name} ajouté(e) !`)
        .addFields(
          { name: upg.emoji + ' Amélioration', value: `${upg.name} : ${current} → **${current + 1}**`, inline: true },
          { name: '💰 Coût', value: `-${cost.toLocaleString()} ${coin}`, inline: true },
        )
      ]});
    }

    if (sub === 'style') {
      const house = db.db.prepare('SELECT * FROM maisons WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!house) return interaction.editReply({ content: '❌ Vous n\'avez pas de maison.', ephemeral: true });

      const style = interaction.options.getString('style');
      const s = STYLES[style];
      const u = db.getUser(userId, guildId);
      if ((u.balance || 0) < s.cost) return interaction.editReply({ content: `❌ Ce style coûte **${s.cost.toLocaleString()} ${coin}**.`, ephemeral: true });

      if (s.cost > 0) db.addCoins(userId, guildId, -s.cost);
      db.db.prepare('UPDATE maisons SET style=? WHERE guild_id=? AND user_id=?').run(style, guildId, userId);

      return interaction.editReply({ content: `✅ Style changé pour **${s.emoji} ${style}** !${s.cost > 0 ? ` (-${s.cost.toLocaleString()} ${coin})` : ''}` });
    }

    if (sub === 'renommer') {
      const house = db.db.prepare('SELECT * FROM maisons WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!house) return interaction.editReply({ content: '❌ Vous n\'avez pas de maison.', ephemeral: true });
      const nom = interaction.options.getString('nom');
      db.db.prepare('UPDATE maisons SET name=? WHERE guild_id=? AND user_id=?').run(nom, guildId, userId);
      return interaction.editReply({ content: `✅ Votre maison s'appelle maintenant **${nom}** !` });
    }

    if (sub === 'visiter') {
      const target = interaction.options.getUser('membre');
      if (target.id === userId) return interaction.editReply({ content: '❌ Visitez la maison d\'un autre !', ephemeral: true });
      const house = db.db.prepare('SELECT * FROM maisons WHERE guild_id=? AND user_id=?').get(guildId, target.id);
      if (!house) return interaction.editReply({ content: `❌ **${target.username}** n'a pas de maison.`, ephemeral: true });

      db.db.prepare('UPDATE maisons SET visits=visits+1 WHERE guild_id=? AND user_id=?').run(guildId, target.id);

      // Petit gain pour le propriétaire (1x par heure max)
      let visitReward = '';
      const lastReward = house.last_visit_reward || 0;
      if (now - lastReward >= 3600) {
        const reward = 20 + Math.floor(Math.random() * 30);
        db.addCoins(target.id, guildId, reward);
        db.db.prepare('UPDATE maisons SET last_visit_reward=? WHERE guild_id=? AND user_id=?').run(now, guildId, target.id);
        visitReward = `\n💰 Vous avez apporté **+${reward} ${coin}** à <@${target.id}> !`;
      }

      const style = STYLES[house.style] || STYLES.moderne;
      const prestige = calcPrestige(house);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#9B59B6').setTitle(`${style.emoji} Visite de ${house.name}`)
        .setDescription(`Propriétaire : <@${target.id}>` + visitReward)
        .addFields(
          { name: '🚪 Pièces', value: `${house.rooms}`, inline: true },
          { name: '🛋️ Meubles', value: `${house.furniture}`, inline: true },
          { name: '⭐ Prestige', value: `${prestige} pts`, inline: true },
          { name: '🌺 Jardin', value: house.garden ? '✅' : '❌', inline: true },
          { name: '🏊 Piscine', value: house.pool ? '✅' : '❌', inline: true },
          { name: '🚗 Garage', value: house.garage ? '✅' : '❌', inline: true },
          { name: '👁️ Total visites', value: `${house.visits + 1}`, inline: true },
        )
      ]});
    }

    if (sub === 'top') {
      const houses = db.db.prepare(`
        SELECT *, (rooms*10 + furniture*5 + garden*25 + pool*40 + garage*20 + level*15) as score
        FROM maisons WHERE guild_id=? ORDER BY score DESC LIMIT 10
      `).all(guildId);
      if (!houses.length) return interaction.editReply({ content: '❌ Aucune maison sur ce serveur encore.', ephemeral: true });
      const medals = ['🥇', '🥈', '🥉'];
      const desc = houses.map((h, i) => {
        const s = STYLES[h.style] || STYLES.moderne;
        return `${medals[i] || `**${i+1}.**`} ${s.emoji} **${h.name}** (<@${h.owner_id || h.user_id}>) — ⭐ ${h.score} pts`;
      }).join('\n');
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle('🏠 Top Maisons').setDescription(desc)] });
    }
  }
};
