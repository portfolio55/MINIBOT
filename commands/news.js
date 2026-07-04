import axios from "axios";
import * as cheerio from "cheerio";

export const name = "news";

// Google News RSS feed - free, no API key required.
const GOOGLE_NEWS_RSS = "https://news.google.com/rss";

export async function execute(sock, msg, args) {
  try {
    const from = msg.key.remoteJid;
    const topic = args?.join(" ").trim();

    const url = topic
      ? `${GOOGLE_NEWS_RSS}/search?q=${encodeURIComponent(topic)}&hl=fr&gl=FR&ceid=FR:fr`
      : `${GOOGLE_NEWS_RSS}?hl=fr&gl=FR&ceid=FR:fr`;

    const { data } = await axios.get(url, { timeout: 20000 });
    const $ = cheerio.load(data, { xmlMode: true });

    const articles = [];
    $("item").each((i, el) => {
      if (i >= 5) return;
      const title = $(el).find("title").first().text();
      const link = $(el).find("link").first().text();
      const pubDate = $(el).find("pubDate").first().text();
      const source = $(el).find("source").first().text();
      articles.push({ title, link, pubDate, source });
    });

    if (!articles.length) throw new Error("Aucune actualité disponible.");

    let message = `> SIGMA MDX DEPLOY:
    +---- 📰 ACTUALITÉS${topic ? ` : ${topic.toUpperCase()}` : " DU JOUR"} ----+\n`;
    articles.forEach((a, i) => {
      message += `> 📰 *${i + 1}. ${a.title || "Sans titre"}*\n`;
      if (a.source) message += `>    Source: ${a.source}\n`;
      if (a.link) message += `>    🔗 ${a.link}\n`;
      message += `>\n`;
    });
    message += `> +----------------------------+`;

    await sock.sendMessage(from, { text: message }, { quoted: msg });

  } catch (err) {
    console.error("❌ Erreur News:", err?.message || err);
    await sock.sendMessage(
      msg.key.remoteJid,
      {
        text: "> ⚠️ SIGMA MDX DEPLOY: Impossible de récupérer les actualités pour le moment.",
      },
      { quoted: msg }
    );
  }
}
