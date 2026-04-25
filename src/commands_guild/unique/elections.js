/**
 * NexusBot — Système d'élections et de votes pour le serveur
 * UNIQUE : Élire des modérateurs, voter pour des décisions, référendums
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS elections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, creator_id TEXT,
    title TEXT, description TEXT DEFAULT '',
    candidates TEXT DEFAULT '[]',
    votes TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',
    end_time INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('election')
    .setDescription('🗳️ Organiser des élections et référendums sur le serveur !')
    .addSubcommand(s => s.setName('creer').setDescription('📋 Créer une élection ou un vote')
      .addStringOption(o => o.setName('titre').setDescription('Titre de l\'élection').setRequired(true).setMaxLength(80))
      .addStringOption(o => o.setName('candidats').setDescription('Candidats séparés par des virgules (ou @mentions)').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Description du vote').setMaxLength(300)))
    .addSubcommand(s => s.setName('voter').setDescription('🗳️ Voter dans une élection')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'élection').setRequired(true))
      .addStringOption(o => o.setName('choix').setDescription('Votre candidat/choix').setRequired(true)))
    .addSubcommand(s => s.setName('resultats').setDescription('📊 Voir les résultats d\'une élection')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'élection').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Liste des élections actives'))
    .addSubcommand(s => s.setName('cloturer').setDescription('🔒 Clôturer et annoncer les résultats (admins)')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'élection').setRequired(true)))
    .addSubcommand(s => s.setName('referendum').setDescription('📊 Référendum rapide oui/non')
      .addStringOption(o => o.setName('question').setDescription('Question du référendum').setRequired(true).setMaxLength(200))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const now = Math.floor(Date.now() / 1000);

    if (sub === 'creer') {
      if (!interaction.member.permissions.has(0x8n) && !interaction.member.permissions.has(0x20n)) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Seuls les admins et modérateurs peuvent créer des élections.', ephemeral: true });
      }
      const titre = interaction.options.getString('titre');
      const candidatsRaw = interaction.options.getString('candidats');
      const duree = parseInt(interaction.options.getString('duree_heures'));
      const desc = interaction.options.getString('description') || '';
      const endTime = now + duree * 3600;
      const candidats = candidatsRaw.split(',').map(c => c.trim()).filter(c => c.length > 0);
      if (candidats.length < 2) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Il faut au moins 2 candidats (séparés par des virgules).', ephemeral: true });

      const result = db.db.prepare('INSERT INTO elections (guild_id,creator_id,title,description,candidates,end_time) VALUES(?,?,?,?,?,?)')
        .run(guildId, userId, titre, desc, JSON.stringify(candidats), endTime);

      const candidatsList = candidats.map((c, i) => `**${i+1}.** ${c}`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle(`🗳️ Élection : ${titre}`)
        .setDescription(desc || '*Aucune description*')
        .addFields(
          { name: '📋 Candidats', value: candidatsList, inline: false },
          { name: '⏰ Fin du vote', value: `<t:${endTime}:R>`, inline: true },
          { name: '🆔 ID', value: `**#${result.lastInsertRowid}**`, inline: true },
        )
        .setFooter({ text: `Votez avec /election voter id:${result.lastInsertRowid} choix:<candidat>` })] });
    }

    if (sub === 'voter') {
      const id = parseInt(interaction.options.getString('id'));
      const choix = interaction.options.getString('choix');
      const elec = db.db.prepare('SELECT * FROM elections WHERE id=? AND guild_id=?').get(id, guildId);
      if (!elec) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Élection #${id} introuvable.`, ephemeral: true });
      if (elec.status !== 'active' || now > elec.end_time) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Cette élection est terminée.', ephemeral: true });

      const candidats = JSON.parse(elec.candidates);
      const votes = JSON.parse(elec.votes || '{}');

      if (votes[userId]) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous avez déjà voté dans cette élection.', ephemeral: true });

      // Trouver le candidat correspondant (insensible à la casse)
      const candidat = candidats.find(c => c.toLowerCase().includes(choix.toLowerCase()) || choix.toLowerCase().includes(c.toLowerCase().split(' ')[0]));
      if (!candidat) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Candidat "${choix}" introuvable. Disponibles : ${candidats.join(', ')}`, ephemeral: true });
      }

      votes[userId] = candidat;
      db.db.prepare('UPDATE elections SET votes=? WHERE id=?').run(JSON.stringify(votes), id);

      // Récompense participation
      db.addCoins(userId, guildId, 10);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ Vote enregistré pour **${candidat}** dans l\'élection "${elec.title}" ! (+10 🪙)`, ephemeral: true });
    }

    if (sub === 'resultats') {
      const id = parseInt(interaction.options.getString('id'));
      const elec = db.db.prepare('SELECT * FROM elections WHERE id=? AND guild_id=?').get(id, guildId);
      if (!elec) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Élection #${id} introuvable.`, ephemeral: true });

      const candidats = JSON.parse(elec.candidates);
      const votes = JSON.parse(elec.votes || '{}');
      const totalVotes = Object.keys(votes).length;

      const scores = {};
      candidats.forEach(c => scores[c] = 0);
      Object.values(votes).forEach(v => { if (scores[v] !== undefined) scores[v]++; });

      const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      const medals = ['🥇','🥈','🥉'];
      const desc = sorted.map(([cand, count], i) => {
        const pct = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : '0.0';
        const bar = '█'.repeat(Math.floor(parseFloat(pct) / 5)) + '░'.repeat(20 - Math.floor(parseFloat(pct) / 5));
        return `${medals[i] || `**${i+1}.**`} **${cand}** — ${count} vote(s) (${pct}%)\n\`${bar}\``;
      }).join('\n\n');

      const isActive = elec.status === 'active' && now < elec.end_time;
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle(`📊 Résultats : ${elec.title}`)
        .setDescription(desc || '*Aucun vote encore*')
        .addFields(
          { name: '🗳️ Total votes', value: totalVotes.toString(), inline: true },
          { name: '📊 Statut', value: isActive ? '🟢 En cours' : '🔒 Terminée', inline: true },
          ...(isActive ? [{ name: '⏰ Fin', value: `<t:${elec.end_time}:R>`, inline: true }] : []),
        )] });
    }

    if (sub === 'liste') {
      const elections = db.db.prepare('SELECT * FROM elections WHERE guild_id=? AND status=? AND end_time>? ORDER BY end_time ASC LIMIT 10').all(guildId, 'active', now);
      if (!elections.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '📋 Aucune élection active.', ephemeral: true });
      const desc = elections.map(e => {
        const votes = Object.keys(JSON.parse(e.votes || '{}')).length;
        return `**[#${e.id}] ${e.title}** — ${votes} vote(s) | Fin : <t:${e.end_time}:R>`;
      }).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle('🗳️ Élections actives')
        .setDescription(desc)] });
    }

    if (sub === 'cloturer') {
      if (!interaction.member.permissions.has(0x8n)) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Seuls les administrateurs peuvent clôturer.', ephemeral: true });
      }
      const id = parseInt(interaction.options.getString('id'));
      const elec = db.db.prepare('SELECT * FROM elections WHERE id=? AND guild_id=?').get(id, guildId);
      if (!elec) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Élection #${id} introuvable.`, ephemeral: true });
      if (elec.status !== 'active') return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Cette élection est déjà clôturée.', ephemeral: true });

      db.db.prepare('UPDATE elections SET status=? WHERE id=?').run('terminee', id);

      const votes = JSON.parse(elec.votes || '{}');
      const candidats = JSON.parse(elec.candidates);
      const scores = {};
      candidats.forEach(c => scores[c] = 0);
      Object.values(votes).forEach(v => { if (scores[v] !== undefined) scores[v]++; });
      const winner = Object.entries(scores).sort((a,b) => b[1]-a[1])[0];

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle(`🏆 Élection terminée — ${elec.title}`)
        .setDescription(`**Vainqueur : ${winner ? winner[0] : 'Aucun vote'}** ${winner ? `(${winner[1]} vote(s))` : ''}\n\nTotal : ${Object.keys(votes).length} votes`)
        .setFooter({ text: 'Félicitations au gagnant !' })] });
    }

    if (sub === 'referendum') {
      if (!interaction.member.permissions.has(0x8n) && !interaction.member.permissions.has(0x20n)) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Seuls les admins/modérateurs peuvent créer des référendums.', ephemeral: true });
      }
      const question = interaction.options.getString('question');
      const duree = parseInt(interaction.options.getString('duree_heures')) || 24;
      const endTime = now + duree * 3600;

      const result = db.db.prepare('INSERT INTO elections (guild_id,creator_id,title,description,candidates,end_time) VALUES(?,?,?,?,?,?)')
        .run(guildId, userId, question, 'Référendum', JSON.stringify(['✅ Oui','❌ Non']), endTime);

      const msg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle('📊 RÉFÉRENDUM')
        .setDescription(`**${question}**`)
        .addFields(
          { name: '⏰ Fin du vote', value: `<t:${endTime}:R>`, inline: true },
          { name: '🗳️ Vote', value: `/election voter id:${result.lastInsertRowid} choix:oui (ou non)`, inline: false },
        )
        .setFooter({ text: '✅ Oui — ❌ Non | Réagissez pour voter symboliquement !' })], fetchReply: true });
      await msg.react('✅');
      await msg.react('❌');
    }
  }
};
