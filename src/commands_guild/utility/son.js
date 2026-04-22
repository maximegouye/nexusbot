/**
 * /son — Joue un son de la soundboard Discord du serveur dans le salon vocal
 * où tu es connecté. Utilise l'API native Discord (soundboard sounds).
 *
 * Le bot doit :
 *  - avoir la permission de rejoindre ton vocal
 *  - avoir la permission "Speak" dans ce vocal
 *  - avoir accès à la soundboard du serveur
 */
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ef = require('../../utils/embedFactory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('son')
    .setDescription('🔊 Joue un son de la soundboard du serveur dans ton salon vocal')
    .addSubcommand(s => s.setName('liste').setDescription('Afficher tous les sons disponibles'))
    .addSubcommand(s => s.setName('jouer').setDescription('Jouer un son')
      .addStringOption(o => o.setName('nom').setDescription('Nom du son à jouer').setRequired(true).setAutocomplete(true))),
  cooldown: 3,

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    try {
      const sounds = await interaction.guild.soundboardSounds.fetch().catch(() => null);
      if (!sounds) return interaction.respond([]);
      const list = [...sounds.values()]
        .filter(s => !focused || (s.name || '').toLowerCase().includes(focused))
        .slice(0, 25)
        .map(s => ({ name: `${s.emoji?.name || '🔊'} ${s.name}`.slice(0, 100), value: s.name }));
      return interaction.respond(list);
    } catch { return interaction.respond([]); }
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();

    if (sub === 'liste') {
      try {
        const sounds = await interaction.guild.soundboardSounds.fetch();
        if (!sounds.size) {
          return interaction.editReply({ embeds: [ef.info('🔊 Soundboard', 'Ce serveur n\'a aucun son dans sa soundboard pour l\'instant.\n\nAjoutez-en via **Paramètres du serveur → Soundboard**.')], ephemeral: true });
        }
        const lines = [...sounds.values()].map(s => `${s.emoji?.name || '🔊'} **${s.name}**`).join('\n');
        return interaction.editReply({
          embeds: [ef.info('🔊 Soundboard du serveur', lines, { footer: `${sounds.size} son(s)` })],
          ephemeral: true,
        });
      } catch (e) {
        return interaction.editReply({ embeds: [ef.error('Erreur', `Impossible de lire la soundboard : ${e.message}`)], ephemeral: true });
      }
    }

    if (sub === 'jouer') {
      const name = interaction.options.getString('nom');
      const member = interaction.member;
      const voice = member.voice?.channel;
      if (!voice) {
        return interaction.editReply({ embeds: [ef.warning('Rejoins un vocal', 'Tu dois être dans un salon vocal pour que je puisse jouer un son.')], ephemeral: true });
      }
      // Permissions
      const perms = voice.permissionsFor(interaction.client.user);
      if (!perms?.has(PermissionFlagsBits.Connect) || !perms?.has(PermissionFlagsBits.Speak)) {
        return interaction.editReply({ embeds: [ef.error('Permissions manquantes', 'Le bot doit pouvoir **se connecter** et **parler** dans ce salon vocal.')], ephemeral: true });
      }

      try {
        const sounds = await interaction.guild.soundboardSounds.fetch();
        const sound = [...sounds.values()].find(s => s.name.toLowerCase() === name.toLowerCase());
        if (!sound) {
          return interaction.editReply({ embeds: [ef.error('Son introuvable', `Aucun son nommé \`${name}\`. Utilise \`/son liste\` pour voir les sons disponibles.`)], ephemeral: true });
        }

        // Rejoindre le vocal et envoyer le son (API soundboard native)
        // discord.js v14.15+ expose `voiceChannel.send({ soundId })` mais l'API native
        // est `PUT /channels/{id}/send-soundboard-sound`. On utilise le REST directement.
        const rest = interaction.client.rest;
        await rest.post(`/channels/${voice.id}/send-soundboard-sound`, {
          body: {
            sound_id: sound.id,
            source_guild_id: interaction.guildId,
          },
        });

        return interaction.editReply({
          embeds: [ef.success('🔊 Son joué', `**${sound.emoji?.name || '🔊'} ${sound.name}** dans <#${voice.id}>`)],
          ephemeral: true,
        });
      } catch (e) {
        console.error('[SON]', e);
        return interaction.editReply({ embeds: [ef.error('Erreur', `Impossible de jouer le son : ${e.message?.slice(0, 200)}\n\n💡 Astuce : le bot doit être connecté au vocal. Si ce n'est pas le cas, le système Soundboard Discord peut refuser l'envoi.`)], ephemeral: true });
      }
    }
  },
};
