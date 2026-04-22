const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits
} = require('discord.js');
const db = require('../../database/db');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickWinners(entries, count) {
  const arr = [...new Set(entries)];
  const winners = [];
  for (let i = 0; i < Math.min(count, arr.length); i++) {
    const idx = Math.floor(Math.random() * arr.length);
    winners.push(arr[idx]);
    arr.splice(idx, 1);
  }
  return winners;
}

function buildEmbed(giveaway, entriesArr) {
  const ended = giveaway.status !== 'active';
  const uniqueCount = new Set(entriesArr).size;
  const embed = new EmbedBuilder()
    .setTitle(`🎉 ${giveaway.prize}`)
    .setColor(ended ? 0x95a5a6 : 0xf1c40f)
    .addFields(
      { name: '🎯 Gagnants', value: `${giveaway.winners_count}`, inline: true },
      { name: '👥 Participants', value: `${uniqueCount}`, inline: true },
      { name: '🕒 Fin', value: ended ? 'Terminé' : `<t:${giveaway.ends_at}:R>`, inline: true },
      { name: '🏆 Organisé par', value: `<@${giveaway.host_id}>`, inline: true }
    )
    .setFooter({ text: ended ? 'Giveaway terminé' : 'Clique sur 🎉 pour participer !' })
    .setTimestamp();
  if (giveaway.min_level > 0) embed.addFields({ name: '📊 Niveau min.', value: `${giveaway.min_level}`, inline: true });
  if (giveaway.min_balance > 0) embed.addFields({ name: '💰 Balance min.', value: `${giveaway.min_balance}`, inline: true });
  if (giveaway.bonus_role_id) embed.addFields({ name: '⭐ Rôle bonus', value: `<@&${giveaway.bonus_role_id}>`, inline: true });
  return embed;
}

function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(s|m|h|j|d)$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const mult = { s: 1000, m: 60000, h: 3600000, j: 86400000, d: 86400000 };
  return val * (mult[unit] || 0);
}

async function endGiveaway(giveaway, client) {
  const entries = JSON.parse(giveaway.entries || '[]');
  const winners = pickWinners(entries, giveaway.winners_count);
  db.db.prepare('UPDATE giveaways SET status = ?, winner_ids = ? WHERE id = ?')
    .run('ended', JSON.stringify(winners), giveaway.id);
  try {
    const channel = await client.channels.fetch(giveaway.channel_id);
    if (giveaway.message_id) {
      try {
        const msg = await channel.messages.fetch(giveaway.message_id);
        const embed = buildEmbed({ ...giveaway, status: 'ended' }, entries);
        if (winners.length > 0) embed.addFields({ name: '🏆 Gagnants', value: winners.map(id => `<@${id}>`).join(', ') });
        else embed.addFields({ name: '😢 Résultat', value: 'Aucun participant' });
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`giveaway_ended_${giveaway.id}`).setLabel('🎉 Giveaway terminé').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );
        await msg.edit({ embeds: [embed], components: [disabledRow] });
      } catch {}
    }
    if (winners.length > 0) {
      await channel.send({ content: `🎉 **Félicitations** ${winners.map(id => `<@${id}>`).join(', ')} ! Vous avez gagné **${giveaway.prize}** ! <@${giveaway.host_id}> vous contactera bientôt.` });
    } else {
      await channel.send({ content: `😢 Giveaway **${giveaway.prize}** terminé. Aucun participant.` });
    }
  } catch (err) { console.error('[Giveaway] Erreur fin #' + giveaway.id + ':', err); }
}

async function handleGiveawayButton(interaction) {
  const parts = interaction.customId.split('_');
  const giveawayId = parseInt(parts[2]);
  if (isNaN(giveawayId)) return interaction.reply({ content: '❌ Giveaway invalide.', ephemeral: true });
  const giveaway = db.db.prepare('SELECT * FROM giveaways WHERE id = ? AND guild_id = ?').get(giveawayId, interaction.guildId);
  if (!giveaway) return interaction.reply({ content: '❌ Giveaway introuvable.', ephemeral: true });
  if (giveaway.status !== 'active') return interaction.reply({ content: '❌ Ce giveaway est terminé.', ephemeral: true });
  if (giveaway.ends_at < Math.floor(Date.now() / 1000)) return interaction.reply({ content: '❌ Ce giveaway est expiré.', ephemeral: true });
  if (giveaway.min_level > 0 || giveaway.min_balance > 0) {
    const user = db.db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(interaction.user.id, interaction.guildId);
    if (giveaway.min_level > 0 && (!user || user.level < giveaway.min_level))
      return interaction.reply({ content: `❌ Niveau minimum requis : **${giveaway.min_level}**. Ton niveau : **${user ? user.level : 0}**.`, ephemeral: true });
    if (giveaway.min_balance > 0) {
      const balance = user ? ((user.balance || 0) + (user.bank || 0)) : 0;
      if (balance < giveaway.min_balance)
        return interaction.reply({ content: `❌ Balance minimum requise : **${giveaway.min_balance}**. Ta balance : **${balance}**.`, ephemeral: true });
    }
  }
  const entries = JSON.parse(giveaway.entries || '[]');
  const alreadyIn = entries.includes(interaction.user.id);
  if (alreadyIn) {
    const newEntries = entries.filter(id => id !== interaction.user.id);
    db.db.prepare('UPDATE giveaways SET entries = ? WHERE id = ?').run(JSON.stringify(newEntries), giveawayId);
    try { await interaction.message.edit({ embeds: [buildEmbed({ ...giveaway, entries: JSON.stringify(newEntries) }, newEntries)] }); } catch {}
    return interaction.reply({ content: '👋 Tu as quitté le giveaway.', ephemeral: true });
  }
  let newEntries = [...entries, interaction.user.id];
  if (giveaway.bonus_role_id && interaction.member && interaction.member.roles.cache.has(giveaway.bonus_role_id)) newEntries.push(interaction.user.id);
  db.db.prepare('UPDATE giveaways SET entries = ? WHERE id = ?').run(JSON.stringify(newEntries), giveawayId);
  try { await interaction.message.edit({ embeds: [buildEmbed({ ...giveaway, entries: JSON.stringify(newEntries) }, newEntries)] }); } catch {}
  await interaction.reply({ content: `✅ Tu participes au giveaway **${giveaway.prize}** ! (${new Set(newEntries).size} participant(s))`, ephemeral: true });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('🎉 Organiser des giveaways sur le serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addSubcommand(s => s.setName('creer').setDescription('🎉 Lancer un nouveau giveaway')
      .addStringOption(o => o.setName('prix').setDescription('Ce qui est à gagner').setRequired(true).setMaxLength(200))
      .addStringOption(o => o.setName('duree').setDescription('Durée (ex: 10m, 2h, 1j)').setRequired(true))
      .addStringOption(o => o.setName('gagnants').setDescription('Nombre de gagnants (défaut: 1)'))
      .addChannelOption(o => o.setName('salon').setDescription('Salon du giveaway (défaut: actuel)'))
      .addRoleOption(o => o.setName('role_requis').setDescription('Rôle requis pour participer'))
      .addStringOption(o => o.setName('niveau_min').setDescription('Niveau minimum'))
      .addStringOption(o => o.setName('balance_min').setDescription('Balance minimum'))
      .addRoleOption(o => o.setName('role_bonus').setDescription('Rôle avec entrée supplémentaire')))
    .addSubcommand(s => s.setName('terminer').setDescription('🏁 Terminer un giveaway manuellement')
      .addStringOption(o => o.setName('id').setDescription('ID du giveaway').setRequired(true)))
    .addSubcommand(s => s.setName('reroll').setDescription('🔄 Retirer de nouveaux gagnants')
      .addStringOption(o => o.setName('id').setDescription('ID du giveaway').setRequired(true))
      .addStringOption(o => o.setName('nombre').setDescription('Nombre de gagnants (défaut: 1)')))
    .addSubcommand(s => s.setName('info').setDescription('📋 Infos d\'un giveaway')
      .addStringOption(o => o.setName('id').setDescription('ID du giveaway').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('📝 Voir les giveaways actifs')),

  handleGiveawayButton,
  endGiveaway,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'creer' || sub === 'start') {
      const prize = interaction.options.getString('prix');
      const dureeStr = interaction.options.getString('duree');
      const gagnants = Math.min(20, Math.max(1, parseInt(interaction.options.getString('gagnants') || '1') || 1));
      const channel = interaction.options.getChannel('salon') || interaction.channel;
      const roleRequis = interaction.options.getRole('role_requis');
      const niveauMin = parseInt(interaction.options.getString('niveau_min') || '0') || 0;
      const balanceMin = parseInt(interaction.options.getString('balance_min') || '0') || 0;
      const roleBonus = interaction.options.getRole('role_bonus');
      const dureeMs = parseDuration(dureeStr);
      if (!dureeMs || dureeMs < 60000) return interaction.reply({ content: '❌ Durée invalide. Exemples : `10m`, `2h`, `1j`.', ephemeral: true });
      if (dureeMs > 30 * 86400000) return interaction.reply({ content: '❌ Durée maximale : 30 jours.', ephemeral: true });
      const endsAt = Math.floor((Date.now() + dureeMs) / 1000);
      const result = db.db.prepare(`INSERT INTO giveaways (guild_id, channel_id, host_id, prize, winners_count, min_level, min_balance, bonus_role_id, status, ends_at, entries, winner_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, '[]', '[]')`).run(interaction.guildId, channel.id, interaction.user.id, prize, gagnants, niveauMin, balanceMin, roleBonus ? roleBonus.id : null, endsAt);
      const giveawayId = result.lastInsertRowid;
      const giveaway = { id: giveawayId, prize, winners_count: gagnants, host_id: interaction.user.id, min_level: niveauMin, min_balance: balanceMin, bonus_role_id: roleBonus ? roleBonus.id : null, status: 'active', ends_at: endsAt };
      const embed = buildEmbed(giveaway, []);
      if (roleRequis) embed.addFields({ name: '🔒 Rôle requis', value: `<@&${roleRequis.id}>`, inline: true });
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`giveaway_join_${giveawayId}`).setLabel('🎉 Participer').setStyle(ButtonStyle.Primary));
      const msg = await channel.send({ embeds: [embed], components: [row] });
      db.db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?').run(msg.id, giveawayId);
      await interaction.reply({ content: `✅ Giveaway **${prize}** créé dans <#${channel.id}> ! (ID: \`${giveawayId}\`)`, ephemeral: true });
    } else if (sub === 'terminer' || sub === 'end') {
      const idRaw = interaction.options.getString('id');
      const giveaway = db.db.prepare('SELECT * FROM giveaways WHERE (id = ? OR message_id = ?) AND guild_id = ?').get(idRaw, idRaw, interaction.guildId);
      if (!giveaway) return interaction.reply({ content: '❌ Giveaway introuvable.', ephemeral: true });
      if (giveaway.status !== 'active') return interaction.reply({ content: '❌ Ce giveaway est déjà terminé.', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      await endGiveaway(giveaway, interaction.client);
      await interaction.editReply({ content: `✅ Giveaway **${giveaway.prize}** terminé !` });
    } else if (sub === 'reroll') {
      const idRaw = interaction.options.getString('id');
      const nombre = Math.min(20, Math.max(1, parseInt(interaction.options.getString('nombre') || '1') || 1));
      const giveaway = db.db.prepare('SELECT * FROM giveaways WHERE (id = ? OR message_id = ?) AND guild_id = ?').get(idRaw, idRaw, interaction.guildId);
      if (!giveaway) return interaction.reply({ content: '❌ Giveaway introuvable.', ephemeral: true });
      if (giveaway.status === 'active') return interaction.reply({ content: '❌ Giveaway encore actif. Terminez-le d\'abord.', ephemeral: true });
      const entries = JSON.parse(giveaway.entries || '[]');
      if (entries.length === 0) return interaction.reply({ content: '❌ Aucun participant.', ephemeral: true });
      const winners = pickWinners(entries, nombre);
      const mentions = winners.map(id => `<@${id}>`).join(', ');
      try { const ch = await interaction.client.channels.fetch(giveaway.channel_id); const msg = await ch.messages.fetch(giveaway.message_id); await msg.reply({ content: `🔄 **Reroll !** Nouveaux gagnants : ${mentions} — félicitations pour **${giveaway.prize}** ! 🎉` }); } catch {}
      await interaction.reply({ content: `✅ Reroll ! Gagnants : ${mentions}`, ephemeral: true });
    } else if (sub === 'info') {
      const idRaw = interaction.options.getString('id');
      const giveaway = db.db.prepare('SELECT * FROM giveaways WHERE (id = ? OR message_id = ?) AND guild_id = ?').get(idRaw, idRaw, interaction.guildId);
      if (!giveaway) return interaction.reply({ content: '❌ Giveaway introuvable.', ephemeral: true });
      const entries = JSON.parse(giveaway.entries || '[]');
      const embed = buildEmbed(giveaway, entries);
      embed.setTitle(`📋 Giveaway #${giveaway.id} — ${giveaway.prize}`);
      embed.addFields({ name: '🆔 ID', value: `${giveaway.id}`, inline: true });
      if (giveaway.status !== 'active') { const w = JSON.parse(giveaway.winner_ids || '[]'); if (w.length > 0) embed.addFields({ name: '🏆 Gagnants', value: w.map(id => `<@${id}>`).join(', ') }); }
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'liste') {
      const list = db.db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND status = ? ORDER BY ends_at ASC LIMIT 10').all(interaction.guildId, 'active');
      if (list.length === 0) return interaction.reply({ content: '📭 Aucun giveaway actif.', ephemeral: true });
      const embed = new EmbedBuilder().setTitle('🎉 Giveaways actifs').setColor(0xf1c40f)
        .setDescription(list.map(g => { const e = JSON.parse(g.entries || '[]'); return `**#${g.id}** — ${g.prize}\n👥 ${new Set(e).size} participant(s) · 🕒 <t:${g.ends_at}:R> · <#${g.channel_id}>`; }).join('\n\n'));
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  async handleComponent(interaction) {
    const db = require('../../database/db');
    const { EmbedBuilder } = require('discord.js');
    const customId = interaction.customId;
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    // Bouton participer au giveaway
    if (customId.startsWith('giveaway_enter_') || customId.startsWith('giveaway_join_') || customId.startsWith('giveaway_particip')) {
      const giveawayId = customId.split('_').pop();
      try {
        const gw = await db.get('SELECT * FROM giveaways WHERE id = ? AND guild_id = ?', [giveawayId, guildId])
                || await db.get('SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ?', [giveawayId, guildId]);
        if (!gw) return interaction.reply({ content: '❌ Giveaway introuvable.', ephemeral: true });
        if (gw.status !== 'active' && gw.ended) return interaction.reply({ content: '❌ Ce giveaway est terminé.', ephemeral: true });

        const already = await db.get('SELECT 1 FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?', [gw.id || giveawayId, userId]);
        if (already) return interaction.reply({ content: '✅ Tu participes déjà à ce giveaway !', ephemeral: true });

        await db.run('INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id, guild_id) VALUES (?, ?, ?)', [gw.id || giveawayId, userId, guildId]);
        const count = await db.get('SELECT COUNT(*) as n FROM giveaway_entries WHERE giveaway_id = ?', [gw.id || giveawayId]);
        return interaction.reply({ content: `🎉 Tu participes au giveaway ! (${count?.n || '?'} participants)`, ephemeral: true });
      } catch(e) {
        console.error('[GIVEAWAY COMPONENT]', e);
        return interaction.reply({ content: '❌ Erreur lors de la participation.', ephemeral: true });
      }
    }
  },

};