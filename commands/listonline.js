export const name = "listonline";
export const description = "Liste tous les membres supposés en ligne dans le groupe avec style SIGMA MDX DEPLOY";

export async function execute(sock, msg, args) {
  try {
    const jid = msg.key.remoteJid;

    // Vérifie que c'est un groupe
    if (!jid.endsWith("@g.us")) {
      return await sock.sendMessage(
        jid,
        { text: "> ?? SIGMA MDX DEPLOY : Cette commande fonctionne uniquement dans un groupe." },
        { quoted: msg }
      );
    }

    // Récupération des participants
    const groupMetadata = await sock.groupMetadata(jid);
    const participants = groupMetadata.participants || [];

    if (participants.length === 0) {
      return await sock.sendMessage(
        jid,
        { text: "> ?? SIGMA MDX DEPLOY : Aucun membre trouvé dans le groupe." },
        { quoted: msg }
      );
    }

    // Liste des images disponibles (reprise de tagall)
    const images = [
      "https://files.catbox.moe/gif51b.jpg",
      "https://files.catbox.moe/s0opn7.jpg",
      "https://files.catbox.moe/lhpf7b.jpg",
      "https://files.catbox.moe/degxst.jpg",
      "https://files.catbox.moe/weqqt6.jpg",
      "https://files.catbox.moe/5j2ukc.jpg",
      "https://files.catbox.moe/2g94h4.jpg",
      "https://files.catbox.moe/z7h6nj.jpg",
      "https://files.catbox.moe/e945km.jpg",
      "https://files.catbox.moe/tdh6zq.jpg",
      "https://files.catbox.moe/6uizvk.jpg",
      "https://files.catbox.moe/m34aop.jpg",
      "https://files.catbox.moe/jwbrkr.jpg",
      "https://files.catbox.moe/y7c9p5.jpg",
      "https://files.catbox.moe/a33171.jpg",
      "https://files.catbox.moe/2zl7vk.jpg",
      "https://files.catbox.moe/dnq77s.jpg",
      "https://files.catbox.moe/312znf.jpg",
      "https://files.catbox.moe/5le1e7.jpg",
      "https://files.catbox.moe/gpsy0t.jpg",
      "https://files.catbox.moe/gif51b.jpg",
      "https://files.catbox.moe/s0opn7.jpg"
    ];

    // Choix aléatoire d'une image
    const randomImage = images[Math.floor(Math.random() * images.length)];

    // Mentions décorées
    const mentions = participants.map(p => p.id);
    const decoratedMentions = participants
      .map(p => `> ?@${p.id.split("@")[0]}`)
      .join("\n");

    // Texte principal
    const text = `> +--------------------+
        ? SIGMA MDX DEPLOY ?
> +--------------------+

?? Membres en ligne supposés (${participants.length}) :

${decoratedMentions}

> Dev by SIGMA MDX`;

    // Envoi du message
    await sock.sendMessage(
      jid,
      {
        image: { url: randomImage },
        caption: text,
        mentions
      },
      { quoted: msg }
    );

  } catch (err) {
    console.error("_⚡SIGMA MDX MDX⚡:_ ? Erreur listonline :", err);
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: "> ?? SIGMA MDX DEPLOY : Impossible de lister les membres en ligne." },
      { quoted: msg }
    );
  }
};