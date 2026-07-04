import axios from "axios";

export const name = "SIGMA MDX";

export async function execute(sock, msg, args) {

  try {

    const from = msg.key.remoteJid;

    const query = args.join(" ");

    // Vérification si une question est posée

    if (!query) {

      await sock.sendMessage(from, {

        text: `> SIGMA MDX DEPLOY : *Usage incorrect...

> Exemple : .SIGMA MDX combien de continent compte la Terre? ?`

      }, { quoted: msg });

      return;

    }

    // Message déattente

    const sentMsg = await sock.sendMessage(from, {

      text: "> SIGMA MDX DEPLOY : ⚡'⚡ 🎨🎨🎨?....🎨🎨?? ⚡"

    }, { quoted: msg });

    // Appel API

    const apiUrl = `https://apis.davidcyriltech.my.id/ai/chatbot?query=${encodeURIComponent(query)}`;

    const { data } = await axios.get(apiUrl);

    if (!data.success || !data.result) {

      throw new Error("Aucune réponse obtenue.");

    }

    // Réponse stylisée

    const reply = `> SIGMA MDX MD :

-Reponse: ${data.result}`;

    await sock.sendMessage(from, { text: reply }, { quoted: sentMsg });

  } catch (err) {

    console.error("? Erreur commande hades :", err);

    await sock.sendMessage(msg.key.remoteJid, {

      text: `> SIGMA MDX DEPLOY:❌ Erreur : ${err.message}`

    }, { quoted: msg });

  }

}