// reorder_categories.js — Commande TEMPORAIRE pour réorganiser les catégories
// Usage : /reorder-categories (Admin uniquement)
// Ordre cible : INFORMATIONS → ANNONCES → GÉNÉRAL → COMMUNAUTÉ → JEUX FUN →
//               CASINO → ÉCONOMIE → ÉVÉNEMENTS → VOCAUX → TICKETS (x7) → ADMINISTRATION
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const TARGET_ORDER = [
  'INFORMATIONS',
  'ANNONCES',
  'GÉNÉRAL',
  'COMMUNAUTÉ',
  'JEUX FUN',
  'CASINO',
  'ÉCONOMIE',
  'ÉVÉNEMENTS',
  'VOCAUX',
  // Les 7 catégories TICKETS (triées par position actuelle)
  'TICKETS',
  // ADMINISTRATION tout en bas
  'ADMINISTRATION',
];

function normalize(s) {
  return s.toUpperCase()
    .replace(/[ÉÊÈË]/g, 'E')
    .replace(/[ÀÂÄÃ]/g, 'A')
    .replace(/[ÙÛÜÚ]/g, 'U')
    .replace(/[ÎÏÍÌ]/g, 'I')
    .replace(/[ÔÖÓÒ]/g, 'O')
    .trim();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reorder-categories')
    .setDescription('Réorganise les catégories du serveur [ADMIN TEMPORAIRE]')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const channels = await interaction.guild.channels.fetch();
      // Catégories = type 4
      const cats = [...channels.values()]
        .filter(c => c && c.type === 4)
        .sort((a, b) => a.position - b.position);

      const ordered = [];
      const used = new Set();

      for (const target of TARGET_ORDER) {
        const normTarget = normalize(target);

        if (target === 'TICKETS') {
          // Toutes les catégories contenant "TICKETS"
          const ticketCats = cats
            .filter(c => !used.has(c.id) && normalize(c.name).includes('TICKET'))
            .sort((a, b) => a.position - b.position);

          for (const tc of ticketCats) {
            ordered.push(tc);
            used.add(tc.id);
          }
        } else {
          const match = cats.find(c =>
            !used.has(c.id) && (
              normalize(c.name) === normTarget ||
              normalize(c.name).includes(normTarget) ||
              normTarget.includes(normalize(c.name))
            )
          );
          if (match) {
            ordered.push(match);
            used.add(match.id);
          }
        }
      }

      // Catégories non matchées → à la fin
      const remaining = cats.filter(c => !used.has(c.id));
      ordered.push(...remaining);

      // Appliquer les nouvelles positions (espacées de 2)
      const positionUpdates = ordered.map((c, i) => ({ id: c.id, position: i * 2 }));
      await interaction.guild.setChannelPositions(positionUpdates);

      const resultText = ordered.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
      await interaction.editReply(
        `✅ **Catégories réorganisées !**\n\n${resultText}`
      );
    } catch (err) {
      console.error('[reorder-categories]', err);
      await interaction.editReply(`❌ Erreur : ${err.message}`);
    }
  },
};
