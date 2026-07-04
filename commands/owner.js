export const name = "owner";

export async function execute(sock, msg, args) {
  try {
    const from = msg.key.remoteJid;

const text = `╔═══════════════════════════════╗
║     *SIGMA MDX DEPLOY*        ║
╚═══════════════════════════════╝

┌──────────────────────────────┐
│  *DEVELOPPEUR*               │
│                              │
│  MUZAN SIGMA                 │
│  Createur & Developpeur      │
└──────────────────────────────┘

┌──────────────────────────────┐
│  *CONTACT*                   │
│                              │
│  Tel : +32 491 942 744       │
└──────────────────────────────┘

┌──────────────────────────────┐
│  *CANAL OFFICIEL*            │
│                              │
│  https://whatsapp.com/channel/0029VbBIAP58KMqoJluW8r06
└──────────────────────────────┘

┌──────────────────────────────┐
│  *COMMUNAUTE*                │
│                              │
│  Suivez les mises a jour     │
│  Acces aux bots exclusifs    │
│  Scripts et projets premium  │
└──────────────────────────────┘

_Powered by SIGMA MDX_`;

    await sock.sendMessage(from, {
      image: { url: "https://files.catbox.moe/gif51b.jpg" },
      caption: text,
      gifPlayback: true
    }, { quoted: msg });

    await sock.sendMessage(from, {
      audio: { url: "https://files.catbox.moe/59g6u8.mp3" },
      mimetype: "audio/mpeg"
    }, { quoted: msg });

  } catch (err) {
    console.error("Erreur commande owner :", err);
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: "> SIGMA MDX DEPLOY: Impossible d'afficher les informations du proprietaire." },
      { quoted: msg }
    );
  }
}
