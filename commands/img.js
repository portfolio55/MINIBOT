import fetch from "node-fetch";

export const name = "img";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function searchImages(query, count) {
  const url = `https://www.bing.com/images/async?q=${encodeURIComponent(query)}&first=1&count=${Math.min(count * 3, 50)}&async=content`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"
    },
    timeout: 15000
  });

  if (!res.ok) throw new Error(`Bing a répondu avec le statut ${res.status}`);

  const html = await res.text();
  const matches = [...html.matchAll(/murl&quot;:&quot;(.*?)&quot;/g)]
    .map(m => m[1])
    .filter(u => u.startsWith("http"));

  return [...new Set(matches)].slice(0, count);
}

export async function execute(sock, msg, args, prefix = ".") {
  const from = msg.key.remoteJid;

  try {
    if (!args[0]) {
      await sock.sendMessage(from, {
        text: `${prefix}Utilisation : .img <mot-clé> [nombre]\n\nExemples :\n${prefix}img naruto\n${prefix}img voiture 5`
      }, { quoted: msg });
      return;
    }

    const lastArg = args[args.length - 1];
    const count = !isNaN(lastArg) ? Math.min(parseInt(lastArg), 10) : 5;
    const query = !isNaN(lastArg) ? args.slice(0, -1).join(" ") : args.join(" ");

    await sock.sendMessage(from, {
      text: `> SIGMA MDX DEPLOY : Recherche de *${count}* image(s) pour : *${query}*...\n> ⏳ Veuillez patienter...`
    }, { quoted: msg });

    let imageUrls = [];
    try {
      imageUrls = await searchImages(query, count * 2);
    } catch (e) {
      console.error("Erreur recherche .img :", e.message);
    }

    if (imageUrls.length === 0) {
      await sock.sendMessage(from, {
        text: `${prefix}Aucune image trouvée pour : *${query}*.`
      }, { quoted: msg });
      return;
    }

    let sent = 0;
    for (const img of imageUrls) {
      if (sent >= count) break;
      try {
        const response = await fetch(img, { headers: { "User-Agent": UA }, timeout: 15000 });
        if (!response.ok) continue;
        const buffer = Buffer.from(await response.arrayBuffer());

        if (buffer.length < 5000) continue;

        await sock.sendMessage(from, {
          image: buffer,
          caption: `> SIGMA MDX DEPLOY: 🎨 *${query}* (${sent + 1}/${count})`
        }, { quoted: msg });

        sent++;
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.error("Erreur téléchargement image :", e.message);
      }
    }

    if (sent === 0) {
      await sock.sendMessage(from, {
        text: `> SIGMA MDX DEPLOY: ${prefix}Aucune image valide trouvée.`
      }, { quoted: msg });
    } else {
      await sock.sendMessage(from, {
        text: `> SIGMA MDX DEPLOY: ${sent}/${count} image(s) envoyée(s) pour *${query}*.`
      }, { quoted: msg });
      console.log(`✅ ${sent}/${count} images envoyées pour "${query}"`);
    }

  } catch (err) {
    console.error("❌ Erreur .img :", err);
    await sock.sendMessage(from, {
      text: `${prefix}Une erreur est survenue lors de la recherche d'image.`
    }, { quoted: msg });
  }
}
