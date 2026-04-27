const { db } = require('../database/db');

// Cache pour stocker les invitations par guild
const inviteCache = new Map();

/**
 * Met en cache toutes les invitations d'une guilde
 * @param {Guild} guild - La guilde Discord
 */
async function cacheGuildInvites(guild) {
  try {
    // Récupérer toutes les invitations
    const invites = await guild.invites.fetch().catch(() => []);

    if (!inviteCache.has(guild.id)) {
      inviteCache.set(guild.id, new Map());
    }

    const guildInviteCache = inviteCache.get(guild.id);

    // Mettre en cache chaque invitation
    for (const invite of invites.values()) {
      guildInviteCache.set(invite.code, {
        code: invite.code,
        inviter: invite.inviter,
        uses: invite.uses || 0,
        maxUses: invite.maxUses || null,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt
      });
    }

    console.log(`[InviteCache] ${invites.size} invitation(s) mises en cache pour ${guild.name}`);
  } catch (error) {
    console.error(`Erreur lors de la mise en cache des invitations pour ${guild.id}:`, error);
  }
}

/**
 * Traite un membre qui a rejoint et trouve qui l'a invité
 * @param {GuildMember} member - Le membre qui a rejoint
 */
async function handleInviteJoin(member) {
  try {
    const guild = member.guild;

    // Récupérer les nouvelles invitations
    const currentInvites = await guild.invites.fetch().catch(() => []);

    if (!inviteCache.has(guild.id)) {
      // Si pas de cache, créer un nouveau
      await cacheGuildInvites(guild);
      return null;
    }

    const guildInviteCache = inviteCache.get(guild.id);
    let inviterId = null;
    let inviteCode = null;

    // Comparer avec le cache pour trouver quelle invitation a été utilisée
    for (const invite of currentInvites.values()) {
      const cachedInvite = guildInviteCache.get(invite.code);

      if (!cachedInvite) {
        // Nouvelle invitation créée
        guildInviteCache.set(invite.code, {
          code: invite.code,
          inviter: invite.inviter,
          uses: invite.uses || 0,
          maxUses: invite.maxUses || null,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt
        });
        continue;
      }

      // Vérifier si le nombre d'utilisations a augmenté
      const previousUses = cachedInvite.uses || 0;
      const currentUses = invite.uses || 0;

      if (currentUses > previousUses) {
        inviterId = invite.inviter?.id || null;
        inviteCode = invite.code;

        // Mettre à jour le cache
        guildInviteCache.set(invite.code, {
          code: invite.code,
          inviter: invite.inviter,
          uses: currentUses,
          maxUses: invite.maxUses || null,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt
        });

        break;
      }
    }

    // Vérifier les invitations supprimées du cache
    for (const [code, cachedInvite] of guildInviteCache.entries()) {
      if (!currentInvites.has(code)) {
        // L'invitation a été supprimée
        guildInviteCache.delete(code);
      }
    }

    // Enregistrer dans la base de données
    if (inviterId) {
      try {
        db.db.prepare(`
          INSERT INTO invites (guild_id, inviter_id, invitee_id, invite_code, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(guild.id, inviterId, member.user.id, inviteCode, new Date().toISOString());

        console.log(`[InviteCache] ${member.user.tag} invité par <@${inviterId}> avec le code ${inviteCode}`);
        return { inviterId, inviteCode };
      } catch (error) {
        console.error('Erreur lors de l\'enregistrement de l\'invitation:', error);
      }
    } else {
      // Impossible de déterminer qui a invité (might be join screen invites)
      console.log(`[InviteCache] Impossible de déterminer qui a invité ${member.user.tag}`);
    }

    return null;
  } catch (error) {
    console.error('Erreur lors du traitement de l\'invitation:', error);
    return null;
  }
}

/**
 * Initialise le cache des invitations pour un serveur
 * @param {Guild} guild - La guilde Discord
 */
async function initializeGuildInviteCache(guild) {
  try {
    await cacheGuildInvites(guild);
  } catch (error) {
    console.error(`Erreur lors de l'initialisation du cache des invitations pour ${guild.id}:`, error);
  }
}

/**
 * Efface le cache des invitations pour une guilde
 * @param {string} guildId - ID de la guilde
 */
function clearGuildInviteCache(guildId) {
  inviteCache.delete(guildId);
  console.log(`[InviteCache] Cache des invitations pour ${guildId} effacé`);
}

module.exports = {
  inviteCache,
  cacheGuildInvites,
  handleInviteJoin,
  initializeGuildInviteCache,
  clearGuildInviteCache
};
