/**
 * NexusBot — Syndicats / Guildes de joueurs
 * UNIQUE : Créer une guilde, recruter, trésor commun, guerres inter-guildes, quêtes collectives
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS syndicats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, leader_id TEXT,
    name TEXT, tag TEXT, description TEXT DEFAULT '',
    color TEXT DEFAULT '#3498DB',
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    treasury INTEGER DEFAULT 0,
    members TEXT DEFAULT '[]',
    officers TEXT DEFAULT '[]',
    wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, name)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS syndicat_members (
    guild_id TEXT, user_id TEXT, syndicat_id INTEGER,
    role TEXT DEFAULT 'membre',
    joined_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY(guild_id, user_id)
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guilde')
    .setDescription('🏰 Guildes et syndicats — créez votre communauté de joueurs !')
    .addSubcommand(s => s.setName('creer').setDescription('🏰 Créer une guilde')
      .addStringOption(o => o.setName('nom').setDescription('Nom de la guilde').setRequired(true).setMaxLength(40))
      .addStringOption(o => o.setName('tag').setDescription('Tag de la guilde [3 lettres]').setRequired(true).setMaxLength(5))
      .addStringOption(o => o.setName('description').setDescription('Description').setMaxLength(200)))
    .addSubcommand(s => s.setName('rejoindre').setDescription('🚪 Rejoindre une guilde')
      .addStringOption(o => o.setName('nom').setDescription('Nom de la guilde').setRequired(true)))
    .addSubcommand(s => s.setName('quitter').setDescription('🚶 Quitter votre guilde'))
    .addSubcommand(s => s.setName('info').setDescription('📋 Voir les infos d\'une guilde')
      .addStringOption(o => o.setName('nom').setDescription('Nom de la guilde (laissez vide pour la vôtre)')))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Liste des guildes du serveur'))
    .addSubcommand(s => s.setName('don').setDescription('💰 Donner des coins au trésor de votre guilde')
      .addIntegerOption(o => o.setName('montant').setDescription('Montant à donner').setRequired(true).setMinValue(10)))
    .addSubcommand(s => s.setName('expulser').setDescription('👢 Expulser un membre (leader/officier)')
      .addUserOption(o => o.setName('membre').setDescription('Membre à expulser').setRequired(true)))
    .addSubcommand(s => s.setName('promouvoir').setDescription('⭐ Promouvoir un membre officier (leader)')
      .addUserOption(o => o.setName('membre').setDescription('Membre à promouvoir').setRequired(true)))
    .addSubcommand(s => s.setName('guerre').setDescription('⚔️ Déclarer la guerre à une autre guilde (fun)')
      .addStringOption(o => o.setName('ennemi').setDescription('Nom de la guilde ennemie').setRequired(true)))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Classement des guildes')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';

    // Helper
    function getMemberSyndicat(uid) {
      const m = db.db.prepare('SELECT * FROM syndicat_members WHERE guild_id=? AND user_id=?').get(guildId, uid);
      if (!m) return null;
      return db.db.prepare('SELECT * FROM syndicats WHERE id=?').get(m.syndicat_id);
    }

    if (sub === 'creer') {
      const existing = db.db.prepare('SELECT id FROM syndicat_members WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (existing) return interaction.reply({ content: '❌ Vous appartenez déjà à une guilde. Quittez-la d\'abord avec `/guilde quitter`.', ephemeral: true });

      const nom = interaction.options.getString('nom');
      const tag = interaction.options.getString('tag').toUpperCase().slice(0, 5);
      const desc = interaction.options.getString('description') || '';

      const cost = 500;
      const u = db.getUser(userId, guildId);
      if ((u.balance || 0) < cost) return interaction.reply({ content: `❌ Créer une guilde coûte **${cost} ${coin}**.`, ephemeral: true });

      const existingName = db.db.prepare('SELECT id FROM syndicats WHERE guild_id=? AND name=?').get(guildId, nom);
      if (existingName) return interaction.reply({ content: '❌ Une guilde avec ce nom existe déjà.', ephemeral: true });

      db.addCoins(userId, guildId, -cost);
      const result = db.db.prepare('INSERT INTO syndicats (guild_id,leader_id,name,tag,description,members,officers) VALUES(?,?,?,?,?,?,?)')
        .run(guildId, userId, nom, tag, desc, JSON.stringify([userId]), JSON.stringify([]));
      db.db.prepare('INSERT INTO syndicat_members (guild_id,user_id,syndicat_id,role) VALUES(?,?,?,?)')
        .run(guildId, userId, result.lastInsertRowid, 'leader');

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle(`🏰 Guilde [${tag}] ${nom} créée !`)
        .setDescription(desc || '*Aucune description*')
        .addFields(
          { name: '👑 Leader', value: `<@${userId}>`, inline: true },
          { name: '💰 Coût', value: `-${cost} ${coin}`, inline: true },
        )
        .setFooter({ text: 'Recrutez des membres avec /guilde rejoindre !' })] });
    }

    if (sub === 'rejoindre') {
      const existing = db.db.prepare('SELECT id FROM syndicat_members WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (existing) return interaction.reply({ content: '❌ Vous êtes déjà dans une guilde.', ephemeral: true });

      const nom = interaction.options.getString('nom');
      const synd = db.db.prepare('SELECT * FROM syndicats WHERE guild_id=? AND name=?').get(guildId, nom);
      if (!synd) return interaction.reply({ content: `❌ Guilde "${nom}" introuvable.`, ephemeral: true });

      const members = JSON.parse(synd.members || '[]');
      if (members.length >= 30) return interaction.reply({ content: '❌ Cette guilde est complète (30 membres max).', ephemeral: true });

      members.push(userId);
      db.db.prepare('UPDATE syndicats SET members=? WHERE id=?').run(JSON.stringify(members), synd.id);
      db.db.prepare('INSERT INTO syndicat_members (guild_id,user_id,syndicat_id,role) VALUES(?,?,?,?)').run(guildId, userId, synd.id, 'membre');

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle(`🚪 Bienvenue dans [${synd.tag}] ${synd.name} !`)
        .setDescription(`Vous avez rejoint la guilde.\n**Membres :** ${members.length}/30`)] });
    }

    if (sub === 'quitter') {
      const m = db.db.prepare('SELECT * FROM syndicat_members WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!m) return interaction.reply({ content: '❌ Vous n\'êtes dans aucune guilde.', ephemeral: true });

      const synd = db.db.prepare('SELECT * FROM syndicats WHERE id=?').get(m.syndicat_id);
      if (synd.leader_id === userId) return interaction.reply({ content: '❌ Vous êtes le leader. Transférez le leadership avant de quitter.', ephemeral: true });

      db.db.prepare('DELETE FROM syndicat_members WHERE guild_id=? AND user_id=?').run(guildId, userId);
      const members = JSON.parse(synd.members || '[]').filter(id => id !== userId);
      db.db.prepare('UPDATE syndicats SET members=? WHERE id=?').run(JSON.stringify(members), synd.id);

      return interaction.reply({ content: `✅ Vous avez quitté la guilde **[${synd.tag}] ${synd.name}**.`, ephemeral: true });
    }

    if (sub === 'info') {
      const nomArg = interaction.options.getString('nom');
      let synd;
      if (nomArg) {
        synd = db.db.prepare('SELECT * FROM syndicats WHERE guild_id=? AND name=?').get(guildId, nomArg);
      } else {
        const m = db.db.prepare('SELECT * FROM syndicat_members WHERE guild_id=? AND user_id=?').get(guildId, userId);
        if (m) synd = db.db.prepare('SELECT * FROM syndicats WHERE id=?').get(m.syndicat_id);
      }
      if (!synd) return interaction.reply({ content: '❌ Guilde introuvable.', ephemeral: true });

      const members = JSON.parse(synd.members || '[]');
      const officers = JSON.parse(synd.officers || '[]');

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle(`🏰 [${synd.tag}] ${synd.name}`)
        .setDescription(synd.description || '*Aucune description*')
        .addFields(
          { name: '👑 Leader', value: `<@${synd.leader_id}>`, inline: true },
          { name: '👥 Membres', value: `${members.length}/30`, inline: true },
          { name: '⭐ Officiers', value: `${officers.length}`, inline: true },
          { name: '💰 Trésor', value: `${synd.treasury} ${coin}`, inline: true },
          { name: '📊 Niveau', value: synd.level.toString(), inline: true },
          { name: '⚔️ Guerres V/D', value: `${synd.wins}/${synd.losses}`, inline: true },
          { name: '📅 Fondée', value: `<t:${synd.created_at}:D>`, inline: true },
        )] });
    }

    if (sub === 'liste') {
      const synds = db.db.prepare('SELECT * FROM syndicats WHERE guild_id=? ORDER BY level DESC, treasury DESC LIMIT 10').all(guildId);
      if (!synds.length) return interaction.reply({ content: '❌ Aucune guilde sur ce serveur. Créez-en une avec `/guilde creer` !', ephemeral: true });
      const medals = ['🥇','🥈','🥉'];
      const desc = synds.map((s, i) => {
        const members = JSON.parse(s.members || '[]').length;
        return `${medals[i]||`**${i+1}.**`} 🏰 **[${s.tag}] ${s.name}** — Niv.${s.level} | ${members} membres | ${s.treasury} ${coin}`;
      }).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle('🏰 Guildes du serveur')
        .setDescription(desc)] });
    }

    if (sub === 'don') {
      const m = db.db.prepare('SELECT * FROM syndicat_members WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!m) return interaction.reply({ content: '❌ Vous n\'êtes dans aucune guilde.', ephemeral: true });

      const montant = interaction.options.getInteger('montant');
      const u = db.getUser(userId, guildId);
      if ((u.balance || 0) < montant) return interaction.reply({ content: `❌ Solde insuffisant.`, ephemeral: true });

      db.addCoins(userId, guildId, -montant);
      db.db.prepare('UPDATE syndicats SET treasury=treasury+? WHERE id=?').run(montant, m.syndicat_id);

      const synd = db.db.prepare('SELECT * FROM syndicats WHERE id=?').get(m.syndicat_id);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setDescription(`💰 Vous avez donné **${montant} ${coin}** au trésor de **[${synd.tag}] ${synd.name}** !\n**Total trésor :** ${synd.treasury + montant} ${coin}`)] });
    }

    if (sub === 'guerre') {
      const m = db.db.prepare('SELECT * FROM syndicat_members WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!m) return interaction.reply({ content: '❌ Vous n\'êtes dans aucune guilde.', ephemeral: true });
      const synd1 = db.db.prepare('SELECT * FROM syndicats WHERE id=?').get(m.syndicat_id);
      if (synd1.leader_id !== userId) return interaction.reply({ content: '❌ Seul le leader peut déclarer la guerre.', ephemeral: true });

      const ennemiNom = interaction.options.getString('ennemi');
      const synd2 = db.db.prepare('SELECT * FROM syndicats WHERE guild_id=? AND name=?').get(guildId, ennemiNom);
      if (!synd2) return interaction.reply({ content: `❌ Guilde "${ennemiNom}" introuvable.`, ephemeral: true });
      if (synd2.id === m.syndicat_id) return interaction.reply({ content: '❌ Vous ne pouvez pas vous battre contre vous-même !', ephemeral: true });

      // Simulation de guerre basée sur les niveaux et taillles
      const m1 = JSON.parse(synd1.members || '[]').length;
      const m2 = JSON.parse(synd2.members || '[]').length;
      const force1 = (synd1.level * 10 + m1 * 5) * (0.7 + Math.random() * 0.6);
      const force2 = (synd2.level * 10 + m2 * 5) * (0.7 + Math.random() * 0.6);

      const winner = force1 > force2 ? synd1 : synd2;
      const loser = force1 > force2 ? synd2 : synd1;
      const prizeGold = Math.floor(Math.min(loser.treasury * 0.1, 500));

      db.db.prepare('UPDATE syndicats SET wins=wins+1, xp=xp+100 WHERE id=?').run(winner.id);
      db.db.prepare('UPDATE syndicats SET losses=losses+1, treasury=MAX(0,treasury-?) WHERE id=?').run(prizeGold, loser.id);
      db.db.prepare('UPDATE syndicats SET treasury=treasury+? WHERE id=?').run(prizeGold, winner.id);

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle(`⚔️ GUERRE : [${synd1.tag}] vs [${synd2.tag}]`)
        .setDescription(`Après une bataille épique de ${Math.floor(Math.random() * 20 + 5)} rounds...`)
        .addFields(
          { name: '🏆 Vainqueur', value: `🏰 **[${winner.tag}] ${winner.name}**`, inline: true },
          { name: '💀 Vaincu', value: `🏰 **[${loser.tag}] ${loser.name}**`, inline: true },
          { name: '💰 Butin', value: `${prizeGold} ${coin} transférés`, inline: false },
        )] });
    }

    if (sub === 'classement') {
      const synds = db.db.prepare('SELECT * FROM syndicats WHERE guild_id=? ORDER BY level DESC, xp DESC LIMIT 10').all(guildId);
      if (!synds.length) return interaction.reply({ content: '❌ Aucune guilde sur ce serveur.', ephemeral: true });
      const medals = ['🥇','🥈','🥉'];
      const desc = synds.map((s, i) => `${medals[i]||`**${i+1}.**`} **[${s.tag}] ${s.name}** — Niv.${s.level} | ⚔️ ${s.wins}V/${s.losses}D`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle('🏆 Classement des Guildes')
        .setDescription(desc)] });
    }

    if (sub === 'expulser' || sub === 'promouvoir') {
      const m = db.db.prepare('SELECT * FROM syndicat_members WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!m || !['leader','officier'].includes(m.role)) return interaction.reply({ content: '❌ Vous devez être leader ou officier.', ephemeral: true });

      const target = interaction.options.getUser('membre');
      const tm = db.db.prepare('SELECT * FROM syndicat_members WHERE guild_id=? AND user_id=?').get(guildId, target.id);
      if (!tm || tm.syndicat_id !== m.syndicat_id) return interaction.reply({ content: '❌ Ce membre n\'est pas dans votre guilde.', ephemeral: true });

      const synd = db.db.prepare('SELECT * FROM syndicats WHERE id=?').get(m.syndicat_id);

      if (sub === 'expulser') {
        if (synd.leader_id === target.id) return interaction.reply({ content: '❌ Vous ne pouvez pas expulser le leader.', ephemeral: true });
        db.db.prepare('DELETE FROM syndicat_members WHERE guild_id=? AND user_id=?').run(guildId, target.id);
        const members = JSON.parse(synd.members || '[]').filter(id => id !== target.id);
        db.db.prepare('UPDATE syndicats SET members=? WHERE id=?').run(JSON.stringify(members), synd.id);
        return interaction.reply({ content: `✅ **${target.username}** a été expulsé de la guilde **[${synd.tag}] ${synd.name}**.` });
      } else {
        if (synd.leader_id !== userId) return interaction.reply({ content: '❌ Seul le leader peut promouvoir.', ephemeral: true });
        db.db.prepare('UPDATE syndicat_members SET role=? WHERE guild_id=? AND user_id=?').run('officier', guildId, target.id);
        const officers = JSON.parse(synd.officers || '[]');
        if (!officers.includes(target.id)) officers.push(target.id);
        db.db.prepare('UPDATE syndicats SET officers=? WHERE id=?').run(JSON.stringify(officers), synd.id);
        return interaction.reply({ content: `⭐ **${target.username}** est maintenant **officier** de **[${synd.tag}] ${synd.name}** !` });
      }
    }
  }
};
