export const name = "promote";

export async function execute(sock, msg, args) {

  try {

    const from = msg.key.remoteJid;

    // Récupère les JID mentionnés

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;

    // Récupère le JID si la commande est en réponse à un message

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;

    // On choisit : mention ou réponse

    const target = mentioned && mentioned.length > 0 ? mentioned[0] : quoted;

    if (!target) {

      return await sock.sendMessage(

        from,

        { text: "> SIGMA MDX DEPLOY:_ Mentionne ou répond au message de la personne é promouvoir." },

        { quoted: msg }

      );

    }

    // Promotion

    await sock.groupParticipantsUpdate(from, [target], "promote");

    await sock.sendMessage(from, {

      text: `> SIGMA MDX DEPLOY : ? @${target.split("@")[0]} est maintenant admin.`,

      mentions: [target],

    });

  } catch (err) {

    console.error("? Erreur promote :", err);

    await sock.sendMessage(msg.key.remoteJid, { text: "> SIGMA MDX DEPLOY: ? Une erreur est survenue." }, { quoted: msg });

  }

}