/**
 * voiceStateUpdate.js
 * - Salons vocaux temporaires (tempvoice_config)
 * - Compteurs automatiques (mise à jour au changement)
 * - Logs vocaux (join/leave/move)
 * XP vocal géré par utils/voiceXPTick.js (cron chaque minute)
 */
const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const db = require('../database/db');

    if (newState.member?.user?.bot || oldState.member?.user?.bot) return;

    const guild  = newState.guild || oldState.guild;
    const guildId = guild?.id;
    const userId  = newState.member?.id || oldState.member?.id;
    if (!guildId || !userId) return;

    const member = newState.member || oldState.member;

    try {
      const cfg = db.getConfig(guildId);

      // ── TempVoice (nouvelle config via /tempvoice setup) ──
      const tvCfg = db.db.prepare('SELECT * FROM tempvoice_config WHERE guild_id=?').get(guildId);
      if (tvCfg?.hub_channel_id) {
        // Rejoindre le hub → créer un canal
        if (newState.channelId === tvCfg.hub_channel_id) {
          await createTempVoice(newState, db, tvCfg, guildId, userId, member);
        }
        // Quitter un salon temporaire → supprimer si vide
        if (oldState.channelId && oldState.channelId !== newState.channelId) {
          const tempRecord = db.db.prepare('SELECT * FROM tempvoice_channels WHERE channel_id=?').get(oldState.channelId);
          if (tempRecord) {
            const ch = oldState.channel;
            if (ch && ch.members.size === 0) {
              await ch.delete().catch(() => {});
              db.db.prepare('DELETE FROM tempvoice_channels WHERE channel_id=?').run(oldState.channelId);
            }
          }
        }
      }

      // ── TempVoice legacy (cfg.tempvoice_creator) ──────────
      if (cfg.tempvoice_creator && newState.channelId === cfg.tempvoice_creator) {
        await createLegacyTempChannel(newState, db, userId, guildId, member);
      }
      if (oldState.channelId && oldState.channelId !== newState.channelId) {
        const ch = oldState.channel;
        if (ch) {
          const tempRecord2 = db.db.prepare('SELECT * FROM temp_channels WHERE channel_id=?').get(oldState.channelId);
          if (tempRecord2 && ch.members.size === 0) {
            await ch.delete().catch(() => {});
            db.db.prepare('DELETE FROM temp_channels WHERE channel_id=?').run(oldState.channelId);
          }
        }
      }

      // ── Mise à jour compteurs vocaux (online count) ────────
      try {
        const counters = db.db.prepare("SELECT * FROM compteurs WHERE guild_id=? AND type LIKE 'online:%'").all(guildId);
        for (const c of counters) {
          const [, format] = c.type.split(':');
          if (!format) continue;
          const onlineCount = guild.members.cache.filter(m => m.presence?.status !== 'offline').size;
          const newName = format.replace('{count}', onlineCount);
          const ch = guild.channels.cache.get(c.channel_id);
          if (ch) ch.setName(newName).catch(() => {});
        }
      } catch {}

      // ── Logs vocaux ────────────────────────────────────────
      if (cfg.log_voice) {
        const logCh = guild.channels.cache.get(cfg.log_voice);
        if (logCh) {
          const joined  = !oldState.channelId && newState.channelId;
          const left    = oldState.channelId && !newState.channelId;
          const moved   = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

          if (joined) {
            logCh.send({ embeds: [new EmbedBuilder().setColor('#2ECC71')
              .setTitle('🔊 Connexion vocale')
              .setDescription(`<@${userId}> a rejoint **${newState.channel?.name}**`)
              .setThumbnail(member?.user.displayAvatarURL())
              .setTimestamp()
            ]}).catch(() => {});
          } else if (left) {
            logCh.send({ embeds: [new EmbedBuilder().setColor('#E74C3C')
              .setTitle('🔇 Déconnexion vocale')
              .setDescription(`<@${userId}> a quitté **${oldState.channel?.name}**`)
              .setThumbnail(member?.user.displayAvatarURL())
              .setTimestamp()
            ]}).catch(() => {});
          } else if (moved) {
            logCh.send({ embeds: [new EmbedBuilder().setColor('#F39C12')
              .setTitle('↔️ Changement de salon vocal')
              .addFields(
                { name: '📤 Avant', value: `**${oldState.channel?.name}**`, inline: true },
                { name: '📥 Après', value: `**${newState.channel?.name}**`, inline: true },
              )
              .setDescription(`<@${userId}>`)
              .setTimestamp()
            ]}).catch(() => {});
          }
        }
      }

    } catch (err) {
      console.error('[VoiceState] Erreur:', err.message);
    }
  }
};

async function createTempVoice(newState, db, tvCfg, guildId, userId, member) {
  try {
    const guild = newState.guild;
    const username = member.displayName.slice(0, 20);
    const hubCount = db.db.prepare('SELECT COUNT(*) as c FROM tempvoice_channels WHERE guild_id=?').get(guildId);
    const count = (hubCount?.c || 0) + 1;

    const channelName = tvCfg.default_name
      .replace('{username}', username)
      .replace('{count}', count)
      .replace('{server}', guild.name);

    const hubCh = guild.channels.cache.get(tvCfg.hub_channel_id);
    const parentId = tvCfg.category_id || hubCh?.parentId || null;

    const newCh = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: parentId,
      userLimit: tvCfg.default_limit || 0,
      permissionOverwrites: [
        { id: guild.roles.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
        { id: userId, allow: [
          PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect,
          PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers
        ]},
      ]
    });

    db.db.prepare('INSERT OR REPLACE INTO tempvoice_channels (channel_id, guild_id, owner_id) VALUES (?,?,?)')
      .run(newCh.id, guildId, userId);

    await member.voice.setChannel(newCh).catch(() => {});
  } catch (err) {
    console.error('[TempVoice] Erreur création:', err.message);
  }
}

async function createLegacyTempChannel(newState, db, userId, guildId, member) {
  try {
    const guild   = newState.guild;
    const creator = guild.channels.cache.get(newState.channelId);
    if (!creator) return;
    const username = member.displayName.slice(0, 20);

    const newChannel = await guild.channels.create({
      name: `🎙️ Salon de ${username}`,
      type: ChannelType.GuildVoice,
      parent: creator.parentId || null,
      userLimit: 0,
      permissionOverwrites: [
        { id: guild.roles.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
        { id: userId, allow: [
          PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect,
          PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers
        ]},
      ]
    });

    try {
      db.db.prepare('INSERT OR REPLACE INTO temp_channels (channel_id, guild_id, owner_id) VALUES (?,?,?)')
        .run(newChannel.id, guildId, userId);
    } catch {}

    await member.voice.setChannel(newChannel).catch(() => {});
  } catch (err) {
    console.error('[TempVoice Legacy] Erreur:', err.message);
  }
}
