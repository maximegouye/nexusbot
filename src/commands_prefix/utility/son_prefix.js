/**
 * &son <nom> — Joue un son de la soundboard du serveur (même logique que /son).
 * &son liste → liste tous les sons disponibles.
 */
const { PermissionFlagsBits } = require('discord.js');
const ef = require('../../utils/embedFactory');

module.exports = {
  name: 'son',
  aliases: ['sound', 'sb', 'soundboard'],
  description: 'Joue un son de la soundboard du serveur dans ton vocal',
  category: 'Utilitaire',
  cooldown: 3,

  async run(message, args, client, db) {
    const first = (args[0] || '').toLowerCase();

    if (!first || first === 'liste' || first === 'list' || first === 'help' || first === 'aide') {
      try {
        const sounds = await message.guild.soundboardSounds.fetch();
        if (!sounds.size) {
          return message.reply({ embeds: [ef.info('🔊 Soundboard', 'Aucun son dans la soundboard du serveur.\n\nAjoutes-en via **Paramètres du serveur → Soundboard**.')] });
        }
        const lines = [...sounds.values()].map(s => `${s.emoji?.name || '🔊'} **${s.name}**`).join('\n');
        return message.reply({ embeds: [ef.info('🔊 Soundboard du serveur', lines + '\n\n💡 Joue un son : `&son <nom>`', { footer: `${sounds.size} son(s)` })] });
      } catch (e) {
        return message.reply({ embeds: [ef.error('Erreur', `Impossible de lire la soundboard : ${e.message}`)] });
      }
    }

    const name = args.join(' ').trim();
    const voice = message.member.voice?.channel;
    if (!voice) {
      return message.reply({ embeds: [ef.warning('Rejoins un vocal', 'Tu dois être dans un salon vocal pour que je puisse jouer un son.')] });
    }
    const perms = voice.permissionsFor(client.user);
    if (!perms?.has(PermissionFlagsBits.Connect) || !perms?.has(PermissionFlagsBits.Speak)) {
      return message.reply({ embeds: [ef.error('Permissions manquantes', 'Le bot doit pouvoir **se connecter** et **parler** dans ce salon vocal.')] });
    }

    try {
      const sounds = await message.guild.soundboardSounds.fetch();
      const sound = [...sounds.values()].find(s => s.name.toLowerCase() === name.toLowerCase());
      if (!sound) {
        return message.reply({ embeds: [ef.error('Son introuvable', `Aucun son nommé \`${name}\`. Tape \`&son liste\` pour voir les sons.`)] });
      }

      await client.rest.post(`/channels/${voice.id}/send-soundboard-sound`, {
        body: { sound_id: sound.id, source_guild_id: message.guild.id },
      });

      return message.reply({ embeds: [ef.success('🔊 Son joué', `**${sound.emoji?.name || '🔊'} ${sound.name}** dans <#${voice.id}>`)] });
    } catch (e) {
      console.error('[&son]', e);
      return message.reply({ embeds: [ef.error('Erreur', `Impossible de jouer : ${e.message?.slice(0, 200)}`)] });
    }
  },
};
