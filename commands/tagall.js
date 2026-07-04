export const name = "tagall";

export async function execute(sock, msg, args) {
  try {
    const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
    const participants = groupMetadata.participants || [];
    const mentions = participants.map(p => p.id);

    // Décoration des mentions avec style SIGMA MDX MDX
    const decoratedMentions = participants
      .map(p => `> ?@${p.id.split("@")[0]}`)
      .join("\n");

    // Liste des images disponibles
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

    // Texte principal avec style menu
    const text = `> +--------------------+
        ? SIGMA MDX DEPLOY?
> +--------------------+

${decoratedMentions}

> Dev by SIGMA MDX`;

    await sock.sendMessage(msg.key.remoteJid, {
      image: { url: randomImage },
      caption: text,
      mentions
    }, { quoted: msg });

  } catch (err) {
    console.error("_⚡SIGMA MDX MDX⚡:_ ? Erreur tagall :", err);
    await sock.sendMessage(msg.key.remoteJid, {
      text: "> ?? SIGMA MDX DEPLOY : Impossible de taguer tous les membres."
    }, { quoted: msg });
  }
};