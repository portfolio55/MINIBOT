import { getDevice } from "@whiskeysockets/baileys";

export const name = "device";

export async function execute(sock, msg, args) {

  const from = msg.key.remoteJid;

  // Vérifier si la commande est utilisée en réponse à un message

  const quoted = msg.message?.extendedTextMessage?.contextInfo;

  if (!quoted?.stanzaId) {

    await sock.sendMessage(

      from,

      { text: "> SIGMA MDX DEPLOY : Réponds à un message pour détecter léappareil utilisé." },

      { quoted: msg }

    );

    return;

  }

  try {

    // Récupérer léappareil de léauteur du message cité

    const device = getDevice(quoted.stanzaId);

    await sock.sendMessage(

      from,

      { text: `> SIGMA MDX DEPLOY : Léutilisateur visé utilise ${device ?? "un appareil inconnu"}.` },

      { quoted: msg }

    );

  } catch (err) {

    console.error("Erreur device :", err);

    await sock.sendMessage(

      from,

      { text: "> SIGMA MDX DEPLOY : Impossible de détecter léappareil. Vérifie que tu as bien répondu à un message." },

      { quoted: msg }

    );

  }

}