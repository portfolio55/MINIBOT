import moment from "moment-timezone";

export const name = "time";

// City -> IANA timezone mapping. No external API required, avoids
// dependency on a paid/dead timezone service.
const CITY_TIMEZONES = {
  "paris": "Europe/Paris",
  "londres": "Europe/London",
  "london": "Europe/London",
  "new york": "America/New_York",
  "los angeles": "America/Los_Angeles",
  "tokyo": "Asia/Tokyo",
  "dakar": "Africa/Dakar",
  "abidjan": "Africa/Abidjan",
  "kinshasa": "Africa/Kinshasa",
  "lagos": "Africa/Lagos",
  "casablanca": "Africa/Casablanca",
  "tunis": "Africa/Tunis",
  "alger": "Africa/Algiers",
  "algiers": "Africa/Algiers",
  "moscou": "Europe/Moscow",
  "moscow": "Europe/Moscow",
  "berlin": "Europe/Berlin",
  "madrid": "Europe/Madrid",
  "rome": "Europe/Rome",
  "dubai": "Asia/Dubai",
  "beijing": "Asia/Shanghai",
  "pekin": "Asia/Shanghai",
  "sydney": "Australia/Sydney",
  "sao paulo": "America/Sao_Paulo",
  "toronto": "America/Toronto",
  "montreal": "America/Toronto",
  "nairobi": "Africa/Nairobi",
  "le caire": "Africa/Cairo",
  "cairo": "Africa/Cairo",
  "bamako": "Africa/Bamako",
  "yaounde": "Africa/Douala",
  "douala": "Africa/Douala",
  "brazzaville": "Africa/Brazzaville",
  "cotonou": "Africa/Porto-Novo",
  "conakry": "Africa/Conakry",
  "ouagadougou": "Africa/Ouagadougou",
  "niamey": "Africa/Niamey"
};

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    const cityInput = (args.join(" ") || "Paris").trim();
    const key = cityInput.toLowerCase();
    const zoneName = CITY_TIMEZONES[key] || (moment.tz.zone(cityInput) ? cityInput : null);

    if (!zoneName || !moment.tz.zone(zoneName)) {
      const available = Object.keys(CITY_TIMEZONES).slice(0, 10).join(", ");
      await sock.sendMessage(from, {
        text: `> SIGMA MDX DEPLOY : Ville non reconnue.\nVilles disponibles: ${available}, ...\n(ou utilise directement un fuseau IANA, ex: Europe/Paris)`
      }, { quoted: msg });
      return;
    }

    const now = moment.tz(zoneName);
    const offset = now.format("Z");

    const reply = `> 🕐 SIGMA MDX DEPLOY : Heure ${cityInput}
🎨🎨🎨🎨🎨🎨
🕐 Heure locale: ${now.format("DD/MM/YYYY HH:mm:ss")}
🌍 Fuseau: ${zoneName}
⏱️ Décalage UTC: ${offset}`;

    await sock.sendMessage(from, { text: reply }, { quoted: msg });

  } catch (err) {
    console.error("Erreur time :", err);
    await sock.sendMessage(from, { text: "> SIGMA MDX DEPLOY : Service heure indisponible." }, { quoted: msg });
  }
}
