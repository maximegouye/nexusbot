/**
 * NexusBot — Système RPG complet
 * UNIQUE : Créer un personnage, classes, stats, combat, quêtes, inventaire, guildes
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS rpg_chars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    name TEXT, class TEXT DEFAULT 'guerrier',
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 100, max_hp INTEGER DEFAULT 100,
    attack INTEGER DEFAULT 10, defense INTEGER DEFAULT 5,
    speed INTEGER DEFAULT 8, magic INTEGER DEFAULT 3,
    gold INTEGER DEFAULT 50,
    inventory TEXT DEFAULT '[]',
    skills TEXT DEFAULT '[]',
    wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0,
    quests_done INTEGER DEFAULT 0,
    last_quest INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

const CLASSES = {
  guerrier:  { emoji:'⚔️',  hp:130, attack:14, defense:10, speed:6,  magic:2,  desc:'Tank robuste. Fort en défense et attaque physique.' },
  mage:      { emoji:'🧙',  hp:80,  attack:7,  defense:3,  speed:8,  magic:18, desc:'Puissance magique extrême. Fragile physiquement.' },
  archer:    { emoji:'🏹',  hp:100, attack:12, defense:5,  speed:14, magic:5,  desc:'Vitesse et précision. Attaques à distance.' },
  paladin:   { emoji:'🛡️',  hp:120, attack:10, defense:12, speed:6,  magic:10, desc:'Équilibre défense/magie. Soigneur partiel.' },
  assassin:  { emoji:'🗡️',  hp:90,  attack:16, defense:4,  speed:16, magic:4,  desc:'Attaque surprise dévastatrice. Très rapide.' },
  druide:    { emoji:'🌿',  hp:95,  attack:8,  defense:6,  speed:9,  magic:14, desc:'Magie nature. Soins et altérations.' },
  berserker: { emoji:'🪓',  hp:140, attack:18, defense:6,  speed:10, magic:1,  desc:'Fureur pure. Plus fort quand blessé.' },
};

const QUETES = [
  { name:'Patrouille forestière',  xp:30,  gold:20,  difficulte:'Facile',  cooldown:1800 },
  { name:'Chasse au gobelin',      xp:60,  gold:40,  difficulte:'Facile',  cooldown:3600 },
  { name:'Escorte de marchands',   xp:80,  gold:60,  difficulte:'Moyen',   cooldown:7200 },
  { name:'Donjon des ombres',      xp:150, gold:100, difficulte:'Moyen',   cooldown:14400 },
  { name:'Dragon corrompu',        xp:300, gold:200, difficulte:'Difficile',cooldown:28800 },
  { name:'Roi nécromancien',       xp:500, gold:350, difficulte:'Épique',  cooldown:86400 },
];

const ITEMS_SHOP = [
  { id:'potion_hp',    name:'Potion de vie',     cost:30,  effect:'+40 PV', emoji:'🧪' },
  { id:'epee_acier',   name:'Épée en acier',     cost:200, effect:'+5 ATK', emoji:'⚔️' },
  { id:'armure_cuir',  name:'Armure de cuir',    cost:150, effect:'+4 DEF', emoji:'🛡️' },
  { id:'bottes_vent',  name:'Bottes du vent',    cost:180, effect:'+4 SPD', emoji:'👢' },
  { id:'tome_magie',   name:'Tome arcanique',    cost:250, effect:'+6 MAG', emoji:'📖' },
  { id:'amulette',     name:'Amulette de force', cost:400, effect:'+8 ATK, +4 HP', emoji:'📿' },
];

function xpForLevel(level) { return Math.floor(100 * Math.pow(1.5, level - 1)); }

function checkLevelUp(char) {
  const needed = xpForLevel(char.level);
  if (char.xp >= needed && char.level < 100) {
    char.level++;
    char.xp -= needed;
    char.max_hp += 10;
    char.hp = Math.min(char.hp + 20, char.max_hp);
    char.attack += 2;
    char.defense += 1;
    return true;
  }
  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rpg')
    .setDescription('⚔️ Système RPG complet — créez un héros et partez à l\'aventure !')
    .addSubcommand(s => s.setName('creer').setDescription('⚔️ Créer votre personnage RPG')
      .addStringOption(o => o.setName('nom').setDescription('Nom de votre personnage').setRequired(true).setMaxLength(30))
      .addStringOption(o => o.setName('classe').setDescription('Classe du personnage').setRequired(true)
        .addChoices(...Object.entries(CLASSES).map(([k, v]) => ({ name: `${v.emoji} ${k.charAt(0).toUpperCase()+k.slice(1)} — ${v.desc}`, value: k })))))
    .addSubcommand(s => s.setName('profil').setDescription('📊 Voir votre fiche de personnage')
      .addUserOption(o => o.setName('joueur').setDescription('Voir le profil d\'un autre joueur')))
    .addSubcommand(s => s.setName('quete').setDescription('🗺️ Partir en quête pour gagner XP et or'))
    .addSubcommand(s => s.setName('combat').setDescription('⚔️ Défier un autre joueur en duel')
      .addUserOption(o => o.setName('adversaire').setDescription('Joueur à défier').setRequired(true)))
    .addSubcommand(s => s.setName('shop').setDescription('🏪 Boutique RPG — acheter équipements'))
    .addSubcommand(s => s.setName('acheter').setDescription('💰 Acheter un item')
      .addStringOption(o => o.setName('item').setDescription('ID de l\'item').setRequired(true)
        .addChoices(...ITEMS_SHOP.map(i => ({ name: `${i.emoji} ${i.name} (${i.cost}g) — ${i.effect}`, value: i.id })))))
    .addSubcommand(s => s.setName('soigner').setDescription('🧪 Utiliser une potion de vie'))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Classement RPG du serveur')),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';
    const now = Math.floor(Date.now() / 1000);

    if (sub === 'creer') {
      const existing = db.db.prepare('SELECT id FROM rpg_chars WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (existing) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous avez déjà un personnage ! Utilisez `/rpg profil` pour le voir.', ephemeral: true });

      const nom = interaction.options.getString('nom');
      const classe = interaction.options.getString('classe');
      const cl = CLASSES[classe];

      db.db.prepare('INSERT INTO rpg_chars (guild_id,user_id,name,class,hp,max_hp,attack,defense,speed,magic) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run(guildId, userId, nom, classe, cl.hp, cl.hp, cl.attack, cl.defense, cl.speed, cl.magic);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(`${cl.emoji} ${nom} est né(e) !`)
        .setDescription(`**Classe :** ${classe.charAt(0).toUpperCase()+classe.slice(1)}\n${cl.desc}`)
        .addFields(
          { name: '❤️ PV', value: cl.hp.toString(), inline: true },
          { name: '⚔️ ATK', value: cl.attack.toString(), inline: true },
          { name: '🛡️ DEF', value: cl.defense.toString(), inline: true },
          { name: '💨 VIT', value: cl.speed.toString(), inline: true },
          { name: '✨ MAG', value: cl.magic.toString(), inline: true },
          { name: '💰 Or', value: '50', inline: true },
        )
        .setFooter({ text: 'Partez en quête avec /rpg quete !' })] });
    }

    if (sub === 'profil') {
      const target = interaction.options.getUser('joueur') || interaction.user;
      const char = db.db.prepare('SELECT * FROM rpg_chars WHERE guild_id=? AND user_id=?').get(guildId, target.id);
      if (!char) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ **${target.username}** n'a pas de personnage RPG.`, ephemeral: true });
      const cl = CLASSES[char.class] || CLASSES.guerrier;
      const needed = xpForLevel(char.level);
      const inventory = JSON.parse(char.inventory || '[]');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setTitle(`${cl.emoji} ${char.name} — Niveau ${char.level}`)
        .setDescription(`**Classe :** ${char.class.charAt(0).toUpperCase()+char.class.slice(1)}\n**Joueur :** <@${target.id}>`)
        .addFields(
          { name: '❤️ PV', value: `${char.hp}/${char.max_hp}`, inline: true },
          { name: '⚔️ ATK', value: char.attack.toString(), inline: true },
          { name: '🛡️ DEF', value: char.defense.toString(), inline: true },
          { name: '💨 VIT', value: char.speed.toString(), inline: true },
          { name: '✨ MAG', value: char.magic.toString(), inline: true },
          { name: '💰 Or', value: char.gold.toString(), inline: true },
          { name: '✨ XP', value: `${char.xp}/${needed}`, inline: true },
          { name: '⚔️ V/D', value: `${char.wins}/${char.losses}`, inline: true },
          { name: '🗺️ Quêtes', value: char.quests_done.toString(), inline: true },
          { name: '🎒 Inventaire', value: inventory.length ? inventory.join(', ') : 'Vide', inline: false },
        )] });
    }

    if (sub === 'quete') {
      const char = db.db.prepare('SELECT * FROM rpg_chars WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!char) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Créez d\'abord un personnage avec `/rpg creer`.', ephemeral: true });

      // Choisir une quête en fonction du niveau
      const availableQuests = QUETES.filter(q => {
        if (char.level < 5) return q.difficulte === 'Facile';
        if (char.level < 15) return ['Facile','Moyen'].includes(q.difficulte);
        if (char.level < 30) return ['Facile','Moyen','Difficile'].includes(q.difficulte);
        return true;
      });
      const quete = availableQuests[Math.floor(Math.random() * availableQuests.length)];

      if (now - char.last_quest < quete.cooldown / availableQuests.length) {
        const waitSecs = (quete.cooldown / availableQuests.length) - (now - char.last_quest);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `⏳ Vous êtes fatigué(e). Reposez-vous encore **${Math.ceil(waitSecs/60)} minutes**.`, ephemeral: true });
      }

      // Simuler la quête (succès probabiliste selon les stats)
      const successRate = Math.min(95, 40 + char.level * 3 + char.attack + char.defense);
      const success = Math.random() * 100 < successRate;

      let xpGain = quete.xp, goldGain = quete.gold;
      let dmgTaken = 0;

      if (success) {
        xpGain = Math.floor(quete.xp * (0.8 + Math.random() * 0.4));
        goldGain = Math.floor(quete.gold * (0.8 + Math.random() * 0.4));
        dmgTaken = Math.max(0, Math.floor(Math.random() * 20) - char.defense);
      } else {
        xpGain = Math.floor(quete.xp * 0.3);
        goldGain = 0;
        dmgTaken = Math.floor(20 + Math.random() * 20);
      }

      const newHp = Math.max(1, char.hp - dmgTaken);
      db.db.prepare('UPDATE rpg_chars SET xp=xp+?, gold=gold+?, hp=?, last_quest=?, quests_done=quests_done+1 WHERE guild_id=? AND user_id=?')
        .run(xpGain, goldGain, newHp, now, guildId, userId);

      // Check level up
      const updatedChar = db.db.prepare('SELECT * FROM rpg_chars WHERE guild_id=? AND user_id=?').get(guildId, userId);
      const leveledUp = checkLevelUp(updatedChar);
      if (leveledUp) {
        db.db.prepare('UPDATE rpg_chars SET level=?, xp=?, max_hp=?, hp=?, attack=?, defense=? WHERE guild_id=? AND user_id=?')
          .run(updatedChar.level, updatedChar.xp, updatedChar.max_hp, updatedChar.hp, updatedChar.attack, updatedChar.defense, guildId, userId);
      }

      // Récompense economy aussi
      if (success && goldGain > 0) db.addCoins(userId, guildId, Math.floor(goldGain / 2));

      const color = success ? '#2ECC71' : '#E74C3C';
      const emoji = success ? '✅' : '❌';
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor(color)
        .setTitle(`${emoji} Quête : ${quete.name}`)
        .addFields(
          { name: success ? '🏆 Victoire !' : '💀 Défaite...', value: success ? `Vous avez accompli la quête avec brio !` : `Vous avez subi une défaite cuisante...`, inline: false },
          { name: '✨ XP gagné', value: `+${xpGain}`, inline: true },
          { name: '💰 Or gagné', value: success ? `+${goldGain}g` : '0g', inline: true },
          { name: '❤️ Dégâts reçus', value: `-${dmgTaken} PV`, inline: true },
          ...(leveledUp ? [{ name: '🎉 LEVEL UP !', value: `Niveau **${updatedChar.level}** atteint !`, inline: false }] : []),
        )
        .setFooter({ text: `PV restants : ${newHp}/${char.max_hp}` })] });
    }

    if (sub === 'combat') {
      const target = interaction.options.getUser('adversaire');
      if (target.id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous ne pouvez pas vous battre contre vous-même.', ephemeral: true });

      const char1 = db.db.prepare('SELECT * FROM rpg_chars WHERE guild_id=? AND user_id=?').get(guildId, userId);
      const char2 = db.db.prepare('SELECT * FROM rpg_chars WHERE guild_id=? AND user_id=?').get(guildId, target.id);
      if (!char1) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'avez pas de personnage RPG.', ephemeral: true });
      if (!char2) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ **${target.username}** n'a pas de personnage RPG.`, ephemeral: true });

      // Simulation de combat
      let hp1 = char1.hp, hp2 = char2.hp;
      let log = [];
      let rounds = 0;

      while (hp1 > 0 && hp2 > 0 && rounds < 20) {
        rounds++;
        // Attaque de char1 sur char2
        const dmg1 = Math.max(1, char1.attack + Math.floor(Math.random() * 8) - char2.defense);
        hp2 -= dmg1;
        if (hp2 <= 0) break;

        // Attaque de char2 sur char1
        const dmg2 = Math.max(1, char2.attack + Math.floor(Math.random() * 8) - char1.defense);
        hp1 -= dmg2;

        if (rounds <= 3) log.push(`R${rounds}: ${char1.name} inflige ${dmg1}dmg | ${char2.name} inflige ${dmg2}dmg`);
      }

      const winner = hp1 > 0 ? char1 : char2;
      const loser = hp1 > 0 ? char2 : char1;
      const winnerId = hp1 > 0 ? userId : target.id;
      const loserId = hp1 > 0 ? target.id : userId;

      const xpGain = 50 + Math.floor(Math.random() * 50);
      const goldGain = 20 + Math.floor(Math.random() * 30);

      db.db.prepare('UPDATE rpg_chars SET wins=wins+1, xp=xp+?, gold=gold+?, hp=? WHERE guild_id=? AND user_id=?').run(xpGain, goldGain, Math.max(1, hp1 > 0 ? hp1 : hp2), guildId, winnerId);
      db.db.prepare('UPDATE rpg_chars SET losses=losses+1, hp=? WHERE guild_id=? AND user_id=?').run(Math.max(1, loserId === userId ? hp1 : hp2), guildId, loserId);
      db.addCoins(winnerId, guildId, goldGain);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle(`⚔️ Combat : ${char1.name} vs ${char2.name}`)
        .setDescription(log.join('\n') + `\n*... ${rounds} rounds ...*`)
        .addFields(
          { name: '🏆 Vainqueur', value: `<@${winnerId}> (${winner.name})`, inline: true },
          { name: '💀 Perdant', value: `<@${loserId}> (${loser.name})`, inline: true },
          { name: '✨ XP gagnée', value: `+${xpGain}`, inline: true },
          { name: '💰 Or gagné', value: `+${goldGain}g`, inline: true },
        )] });
    }

    if (sub === 'shop') {
      const lines = ITEMS_SHOP.map(i => `${i.emoji} **${i.name}** (ID: \`${i.id}\`) — **${i.cost}g** — ${i.effect}`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle('🏪 Boutique RPG')
        .setDescription(lines)
        .setFooter({ text: '/rpg acheter item:<id> pour acheter' })] });
    }

    if (sub === 'acheter') {
      const itemId = interaction.options.getString('item');
      const item = ITEMS_SHOP.find(i => i.id === itemId);
      if (!item) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Item introuvable.', ephemeral: true });
      const char = db.db.prepare('SELECT * FROM rpg_chars WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!char) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'avez pas de personnage RPG.', ephemeral: true });
      if (char.gold < item.cost) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Vous n\'avez que **${char.gold}g** (il faut ${item.cost}g).`, ephemeral: true });

      const inventory = JSON.parse(char.inventory || '[]');
      inventory.push(item.name);
      db.db.prepare('UPDATE rpg_chars SET gold=gold-?, inventory=? WHERE guild_id=? AND user_id=?').run(item.cost, JSON.stringify(inventory), guildId, userId);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle(`${item.emoji} Achat : ${item.name}`)
        .addFields(
          { name: '💰 Prix payé', value: `${item.cost}g`, inline: true },
          { name: '✨ Effet', value: item.effect, inline: true },
        )] });
    }

    if (sub === 'soigner') {
      const char = db.db.prepare('SELECT * FROM rpg_chars WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (!char) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'avez pas de personnage RPG.', ephemeral: true });
      const inventory = JSON.parse(char.inventory || '[]');
      const idx = inventory.findIndex(i => i === 'Potion de vie');
      if (idx === -1) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'avez pas de Potion de vie. Achetez-en une à la boutique !', ephemeral: true });
      inventory.splice(idx, 1);
      const newHp = Math.min(char.max_hp, char.hp + 40);
      db.db.prepare('UPDATE rpg_chars SET hp=?, inventory=? WHERE guild_id=? AND user_id=?').run(newHp, JSON.stringify(inventory), guildId, userId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setDescription(`🧪 Potion utilisée ! PV : **${char.hp} → ${newHp}/${char.max_hp}** (+40 PV)`)] });
    }

    if (sub === 'classement') {
      const top = db.db.prepare('SELECT * FROM rpg_chars WHERE guild_id=? ORDER BY level DESC, xp DESC LIMIT 10').all(guildId);
      if (!top.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun personnage RPG sur ce serveur.', ephemeral: true });
      const medals = ['🥇','🥈','🥉'];
      const desc = top.map((c, i) => {
        const cl = CLASSES[c.class] || CLASSES.guerrier;
        return `${medals[i] || `**${i+1}.**`} ${cl.emoji} **${c.name}** (<@${c.user_id}>) — Niv. **${c.level}** | ${c.wins}V/${c.losses}D`;
      }).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle('🏆 Classement RPG')
        .setDescription(desc)] });
    }
  },


  // Prefix-only: accessible via &rpg (not registered as slash command)
  _prefixOnly: true,
  name: 'rpg',
};