/**
 * NexusBot — Système d'espionnage
 * UNIQUE : missions secrètes, voler des infos, contre-espionnage, rang agent
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    codename TEXT,
    rank TEXT DEFAULT 'Recrue',
    rank_level INTEGER DEFAULT 1,
    missions_done INTEGER DEFAULT 0,
    missions_failed INTEGER DEFAULT 0,
    intel INTEGER DEFAULT 0,
    detected INTEGER DEFAULT 0,
    last_mission INTEGER DEFAULT 0,
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

const RANKS = [
  { level: 1, name: 'Recrue',        emoji: '🔵', required: 0,   mission_bonus: 0 },
  { level: 2, name: 'Agent',         emoji: '🟢', required: 5,   mission_bonus: 10 },
  { level: 3, name: 'Opérateur',     emoji: '🟡', required: 15,  mission_bonus: 20 },
  { level: 4, name: 'Spécialiste',   emoji: '🟠', required: 30,  mission_bonus: 35 },
  { level: 5, name: 'Analyste',      emoji: '🔴', required: 50,  mission_bonus: 50 },
  { level: 6, name: 'Commandant',    emoji: '⚫', required: 80,  mission_bonus: 75 },
  { level: 7, name: 'Directeur',     emoji: '🟣', required: 120, mission_bonus: 100 },
  { level: 8, name: 'Agent Fantôme', emoji: '👻', required: 200, mission_bonus: 150 },
];

const MISSIONS = [
  { id: 'surveillance',  name: 'Surveillance',      emoji: '👁️',  difficulty: 1, reward: [80, 180],  intel: [5, 15],  successRate: 0.85, cooldown: 1800,  description: 'Surveiller les communications d\'une cible' },
  { id: 'infiltration',  name: 'Infiltration',       emoji: '🕵️',  difficulty: 2, reward: [150, 300], intel: [10, 25], successRate: 0.70, cooldown: 3600,  description: 'S\'infiltrer dans un bâtiment sécurisé' },
  { id: 'extraction',    name: 'Extraction',         emoji: '🚁',  difficulty: 3, reward: [250, 500], intel: [20, 40], successRate: 0.60, cooldown: 5400,  description: 'Extraire un asset de haute valeur' },
  { id: 'sabotage',      name: 'Sabotage',           emoji: '💣',  difficulty: 3, reward: [200, 450], intel: [15, 35], successRate: 0.55, cooldown: 5400,  description: 'Saboter les infrastructures ennemies' },
  { id: 'vol_donnees',   name: 'Vol de données',     emoji: '💻',  difficulty: 2, reward: [180, 350], intel: [25, 50], successRate: 0.65, cooldown: 3600,  description: 'Voler des données classifiées' },
  { id: 'assassinat',    name: 'Neutralisation',     emoji: '🎯',  difficulty: 4, reward: [400, 800], intel: [30, 60], successRate: 0.45, cooldown: 7200,  description: 'Neutraliser une menace de haute priorité' },
  { id: 'double_agent',  name: 'Agent Double',       emoji: '🎭',  difficulty: 5, reward: [600, 1200],intel: [50, 100],successRate: 0.35, cooldown: 10800, description: 'Infiltrer une organisation ennemie pendant 24h' },
];

function getAgentRank(missions) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (missions >= r.required) rank = r;
  }
  return rank;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('espion')
    .setDescription('🕵️ Bureau des Opérations Secrètes — Missions, rang, intel')
    .addSubcommand(s => s.setName('rejoindre').setDescription('🔵 Rejoindre le bureau et choisir votre nom de code')
      .addStringOption(o => o.setName('codename').setDescription('Votre nom de code (ex: Ombre, Viper...)').setRequired(true).setMaxLength(20)))
    .addSubcommand(s => s.setName('profil').setDescription('🪪 Voir votre dossier agent')
      .addUserOption(o => o.setName('membre').setDescription('Voir le dossier d\'un agent')))
    .addSubcommand(s => s.setName('missions').setDescription('📋 Voir les missions disponibles'))
    .addSubcommand(s => s.setName('mission').setDescription('🎯 Effectuer une mission secrète')
      .addStringOption(o => o.setName('type').setDescription('Type de mission').setRequired(true)
        .addChoices(...MISSIONS.map(m => ({ name: `${m.emoji} ${m.name} — ${m.description}`, value: m.id })))))
    .addSubcommand(s => s.setName('voler').setDescription('🗂️ Voler l\'intel d\'un autre agent')
      .addUserOption(o => o.setName('cible').setDescription('Agent à voler').setRequired(true)))
    .addSubcommand(s => s.setName('proteger').setDescription('🛡️ Activer la protection contre-espionnage (2h)'))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Classement des meilleurs agents')),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';
    const now = Math.floor(Date.now() / 1000);

    if (sub === 'rejoindre') {
      const existing = db.db.prepare('SELECT id FROM agents WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (existing) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous êtes déjà un agent enregistré.', ephemeral: true });

      const codename = interaction.options.getString('codename');
      const nameExists = db.db.prepare('SELECT id FROM agents WHERE guild_id=? AND codename=?').get(guildId, codename);
      if (nameExists) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce nom de code est déjà pris.', ephemeral: true });

      db.db.prepare('INSERT INTO agents (guild_id,user_id,codename) VALUES(?,?,?)').run(guildId, userId, codename);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle('🔵 Bienvenue, Agent !')
        .setDescription(`Dossier créé. Nom de code : **${codename}**\nVotre rang actuel : 🔵 **Recrue**\n\nEffectuez des missions avec \`/espion mission\` pour monter en grade.`)
        .setFooter({ text: 'Bureau des Opérations Secrètes — NexusBot' })
      ]});
    }

    const getAgent = (uid) => db.db.prepare('SELECT * FROM agents WHERE guild_id=? AND user_id=?').get(guildId, uid);

    if (sub === 'profil') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const agent = getAgent(target.id);
      if (!agent) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ **${target.username}** n'est pas un agent enregistré.`, ephemeral: true });

      const rank = getAgentRank(agent.missions_done);
      const nextRank = RANKS.find(r => r.level === rank.level + 1);
      const successRate = agent.missions_done + agent.missions_failed > 0
        ? Math.round(agent.missions_done / (agent.missions_done + agent.missions_failed) * 100)
        : 100;

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2C3E50')
        .setTitle(`${rank.emoji} Dossier Agent — ${agent.codename}`)
        .setDescription(`Agent : <@${target.id}>`)
        .addFields(
          { name: `${rank.emoji} Rang`, value: `**${rank.name}**`, inline: true },
          { name: '✅ Missions réussies', value: `**${agent.missions_done}**`, inline: true },
          { name: '❌ Missions échouées', value: `**${agent.missions_failed}**`, inline: true },
          { name: '📊 Taux de succès', value: `**${successRate}%**`, inline: true },
          { name: '🗂️ Intel collecté', value: `**${agent.intel}** pts`, inline: true },
          { name: '🚨 Fois détecté', value: `**${agent.detected}**x`, inline: true },
          { name: '⬆️ Prochain rang', value: nextRank ? `${nextRank.emoji} ${nextRank.name} (${nextRank.required - agent.missions_done} missions)` : '👻 Rang maximum !', inline: false },
        )
        .setFooter({ text: `Bonus mission : +${rank.mission_bonus}%` })
      ]});
    }

    if (sub === 'missions') {
      const agent = getAgent(userId);
      if (!agent) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'êtes pas enregistré. Utilisez `/espion rejoindre`.', ephemeral: true });

      const rank = getAgentRank(agent.missions_done);
      const lines = MISSIONS.map(m => {
        const diff = '⭐'.repeat(m.difficulty);
        const cd = `${Math.floor(m.cooldown / 60)}min`;
        return `${m.emoji} **${m.name}** ${diff}\n> ${m.description}\n> Récompense : ${m.reward[0]}–${m.reward[1]} ${coin} • Intel : +${m.intel[0]}–${m.intel[1]} • CD : ${cd} • Succès : ${Math.round(m.successRate * 100 + rank.mission_bonus * 0.3)}%`;
      }).join('\n\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2C3E50')
        .setTitle('📋 Missions Disponibles')
        .setDescription(lines)
        .setFooter({ text: `Votre rang : ${rank.emoji} ${rank.name} • Bonus : +${rank.mission_bonus}%` })
      ]});
    }

    if (sub === 'mission') {
      const agent = getAgent(userId);
      if (!agent) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'êtes pas enregistré.', ephemeral: true });

      const missionId = interaction.options.getString('type');
      const mission = MISSIONS.find(m => m.id === missionId);
      const cooldownKey = `last_mission_${missionId}`;
      const lastMission = agent.last_mission || 0;

      // Simple cooldown: use last_mission globally (simplified)
      const elapsed = now - lastMission;
      const requiredCd = mission.cooldown;
      if (elapsed < requiredCd) {
        const remaining = requiredCd - elapsed;
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `⏳ Vous êtes en repos. Prochaine mission disponible dans **${Math.floor(remaining / 60)}min ${remaining % 60}s**.`, ephemeral: true });
      }

      const rank = getAgentRank(agent.missions_done);
      const adjustedRate = Math.min(0.95, mission.successRate + rank.mission_bonus / 100 * 0.5);
      const success = Math.random() < adjustedRate;
      const detected = !success && Math.random() < 0.4;

      db.db.prepare('UPDATE agents SET last_mission=? WHERE guild_id=? AND user_id=?').run(now, guildId, userId);

      if (success) {
        const reward = Math.floor(mission.reward[0] + Math.random() * (mission.reward[1] - mission.reward[0]));
        const intel = Math.floor(mission.intel[0] + Math.random() * (mission.intel[1] - mission.intel[0]));
        db.addCoins(userId, guildId, reward);
        db.db.prepare('UPDATE agents SET missions_done=missions_done+1, intel=intel+? WHERE guild_id=? AND user_id=?').run(intel, guildId, userId);

        const newMissions = agent.missions_done + 1;
        const newRank = getAgentRank(newMissions);
        const rankUp = newRank.level > rank.level;

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71')
          .setTitle(`${mission.emoji} Mission Réussie — ${mission.name}`)
          .setDescription(
            `✅ **Opération accomplie avec succès.**\n\n` +
            (rankUp ? `🎉 **PROMOTION !** Vous êtes maintenant ${newRank.emoji} **${newRank.name}** !\n\n` : '') +
            `Taux de détection évité : ${Math.round((1 - adjustedRate) * 100)}%`
          )
          .addFields(
            { name: '💰 Récompense', value: `+${reward.toLocaleString()} ${coin}`, inline: true },
            { name: '🗂️ Intel', value: `+${intel} pts`, inline: true },
            { name: '📊 Missions totales', value: `${newMissions}`, inline: true },
          )
          .setFooter({ text: `${newRank.emoji} ${newRank.name}` })
        ]});
      } else {
        db.db.prepare('UPDATE agents SET missions_failed=missions_failed+1' + (detected ? ', detected=detected+1' : '') + ' WHERE guild_id=? AND user_id=?').run(guildId, userId);
        const fineLoss = detected ? Math.floor(50 + Math.random() * 100) : 0;
        if (fineLoss > 0) db.addCoins(userId, guildId, -fineLoss);

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle(`${mission.emoji} Mission Échouée — ${mission.name}`)
          .setDescription(
            `❌ **L'opération a échoué.**\n\n` +
            (detected ? `🚨 **DÉTECTÉ !** Vous avez été repéré par les forces ennemies ! (-${fineLoss} ${coin})\n` : `Vous avez réussi à vous éclipser sans être détecté.\n`) +
            `\nTentez une autre mission ou attendez avant de réessayer.`
          )
          .addFields(
            { name: '📊 Taux de succès', value: `${Math.round(adjustedRate * 100)}%`, inline: true },
            { name: '🚨 Statut', value: detected ? '**Détecté**' : 'Non détecté', inline: true },
          )
        ]});
      }
    }

    if (sub === 'voler') {
      const agent = getAgent(userId);
      if (!agent) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'êtes pas enregistré.', ephemeral: true });
      const target = interaction.options.getUser('cible');
      if (target.id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous ne pouvez pas vous voler vous-même !', ephemeral: true });
      const targetAgent = getAgent(target.id);
      if (!targetAgent) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ <@${target.id}> n'est pas un agent.`, ephemeral: true });

      const cooldown = 3600;
      if (now - agent.last_mission < cooldown) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `⏳ Vous ne pouvez pas encore effectuer d'opération. Cooldown : **${Math.floor((cooldown - (now - agent.last_mission)) / 60)}min**.`, ephemeral: true });
      }

      if (targetAgent.intel < 10) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ <@${target.id}> n'a pas assez d'intel à voler.`, ephemeral: true });

      const success = Math.random() < 0.50;
      db.db.prepare('UPDATE agents SET last_mission=? WHERE guild_id=? AND user_id=?').run(now, guildId, userId);

      if (success) {
        const stolen = Math.floor(targetAgent.intel * 0.15 + Math.random() * 20);
        db.db.prepare('UPDATE agents SET intel=intel+? WHERE guild_id=? AND user_id=?').run(stolen, guildId, userId);
        db.db.prepare('UPDATE agents SET intel=MAX(0,intel-?) WHERE guild_id=? AND user_id=?').run(stolen, guildId, target.id);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ Vol d'intel réussi ! Vous avez dérobé **${stolen} pts d'intel** à <@${target.id}> !` });
      } else {
        const fine = Math.floor(30 + Math.random() * 50);
        db.addCoins(userId, guildId, -fine);
        db.db.prepare('UPDATE agents SET detected=detected+1 WHERE guild_id=? AND user_id=?').run(guildId, userId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Vol raté ! <@${target.id}> vous a repéré. Amende : **-${fine} ${coin}**.` });
      }
    }

    if (sub === 'proteger') {
      const agent = getAgent(userId);
      if (!agent) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous n\'êtes pas enregistré.', ephemeral: true });
      const cost = 200;
      const u = db.getUser(userId, guildId);
      if ((u.balance || 0) < cost) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ La protection coûte **${cost} ${coin}**.`, ephemeral: true });
      db.addCoins(userId, guildId, -cost);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle('🛡️ Protection activée !')
        .setDescription(`Votre dossier est sécurisé pendant **2 heures**. Aucun agent ne peut voler votre intel.\n-${cost} ${coin}`)
      ]});
    }

    if (sub === 'classement') {
      const top = db.db.prepare('SELECT * FROM agents WHERE guild_id=? ORDER BY missions_done DESC LIMIT 10').all(guildId);
      if (!top.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun agent enregistré.', ephemeral: true });
      const medals = ['🥇', '🥈', '🥉'];
      const desc = top.map((a, i) => {
        const rank = getAgentRank(a.missions_done);
        return `${medals[i] || `**${i+1}.**`} ${rank.emoji} **${a.codename}** (<@${a.user_id}>) — ${a.missions_done} missions • ${a.intel} intel`;
      }).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2C3E50').setTitle('🕵️ Classement des Agents').setDescription(desc)] });
    }
  },


  // Prefix-only: accessible via &espion (not registered as slash command)
  _prefixOnly: true,
  name: 'espion',
};