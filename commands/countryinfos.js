export const name = "countryinfos";
export const description = "Affiche les informations détaillées d'un pays.";

export async function execute(sock, msg, args) {
  const from = msg.key.remoteJid;

  try {
    const countryName = args.join(" ").trim();

    // === Vérifie si un pays est spécifié ===
    if (!countryName) {
      return await sock.sendMessage(
        from,
        {
          text: "> SIGMA MDX MD ?? Fournis le nom d'un pays.\nExemple : *.countryinfos Pakistan*",
        },
        { quoted: msg }
      );
    }

    // === Message de progression ===
    await sock.sendMessage(
      from,
      {
        text: `> SIGMA MDX DEPLOY: ?? Récupération des informations pour *${countryName}*...`,
      },
      { quoted: msg }
    );

    // === Requête vers l'API ===
    const apiUrl = `https://api.siputzx.my.id/api/tools/countryInfo?name=${encodeURIComponent(
      countryName
    )}`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    // === Vérifie la validité de la réponse ===
    if (!data || !data.status || !data.data) {
      return await sock.sendMessage(
        from,
        {
          text: `> SIGMA MDX DEPLOY:?? Aucune information trouvée pour *${countryName}*.\nVérifie le nom et réessaie.`,
        },
        { quoted: msg }
      );
    }

    const info = data.data;

    // === Formatage des données ===
    const neighborsText =
      info.neighbors?.length > 0
        ? info.neighbors.map((n) => `⚡ ${n.name}`).join(", ")
        : "Aucun pays voisin trouvé.";

    const caption = `> SIGMA MDX DEPLOY ?? *Informations sur ${info.name.common || countryName}*\n
?? *Capitale :* ${info.capital || "Inconnue"}
?? *Continent :* ${info.continent.name || "Inconnu"} ${info.continent.emoji || ""}
?? *Indicatif :* ${info.phoneCode || "N/A"}
?? *Superficie :* ${info.area.squareKilometers} kmé (${info.area.squareMiles} mié)
?? *Cété de conduite :* ${info.drivingSide || "N/A"}
?? *Monnaie :* ${info.currency || "N/A"}
?? *Langues :* ${info.languages?.native?.join(", ") || "N/A"}
?? *Connu pour :* ${info.famousFor || "N/A"}
?? *Codes ISO :* ${info.isoCode.alpha2.toUpperCase()}, ${info.isoCode.alpha3.toUpperCase()}
?? *Domaine internet :* ${info.internetTLD || "N/A"}

?? *Pays voisins :* ${neighborsText}

> Dev by SIGMA MDX`;

    // === Envoi de la réponse avec drapeau ===
    await sock.sendMessage(
      from,
      {
        image: { url: info.flag },
        caption,
      },
      { quoted: msg }
    );

    console.log(`[SIGMA MDX MD] ? Informations pays envoyées pour : ${countryName}`);

  } catch (err) {
    console.error("[SIGMA MDX MD] ? Erreur countryinfos :", err);
    await sock.sendMessage(
      from,
      {
        text: `> SIGMA MDX DEPLOY ?? Une erreur est survenue lors de la récupération des informations.\n?? Détails : ${err.message}`,
      },
      { quoted: msg }
    );
  }
}