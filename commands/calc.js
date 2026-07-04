import { Parser } from 'expr-eval';

const parser = new Parser();

export const name = "calc";

export async function execute(sock, msg, args) {
  try {
    const from = msg.key.remoteJid;
    
    if (!args.length) {
      return await sock.sendMessage(from, { 
        text: "> ?? SIGMA MDX DEPLOY: Veuillez fournir une expression.\nExemple: `!calc 2+2*5` ou `!calc sin(45)`" 
      }, { quoted: msg });
    }

    const expression = args.join(" ");
    
    // Message de traitement
    const processingMsg = await sock.sendMessage(from, { 
      text: "> ❌ SIGMA MDX DEPLOY: Calcul en cours..." 
    }, { quoted: msg });

    // Nettoyer et évaluer l'expression mathématique
    const result = safeEvaluate(expression);
    
    if (result.error) {
      await sock.sendMessage(from, { 
        text: `> ❌ SIGMA MDX DEPLOY: Erreur de calcul\nExpression: ${expression}\nErreur: ${result.message}` 
      }, { quoted: processingMsg });
      return;
    }

    // Réponse stylisée
    const reply = `> ?? SIGMA MDX DEPLOY: Calculatrice\n🎨🎨🎨🎨🎨🎨\n?? Expression: ${expression}\n? Résultat: ${result.value}\n🎨🎨🎨🎨🎨🎨\n?? Format: ${result.format}`;
    
    await sock.sendMessage(from, { text: reply }, { quoted: processingMsg });

  } catch (err) {
    console.error("? Erreur calc :", err);
    await sock.sendMessage(msg.key.remoteJid, {
      text: "> ?? SIGMA MDX DEPLOY: Erreur lors du calcul."
    }, { quoted: msg });
  }
};

function safeEvaluate(expression) {
  try {
    let cleanExpr = expression
      .replace(/\^/g, '**')
      .replace(/\bpi\b/gi, 'PI')
      .replace(/\bsqrt\b/gi, 'sqrt')
      .replace(/\bsin\b/gi, 'sin')
      .replace(/\bcos\b/gi, 'cos')
      .replace(/\btan\b/gi, 'tan')
      .replace(/\blog\b/gi, 'log')
      .replace(/\bln\b/gi, 'ln');

    let value = parser.evaluate(cleanExpr);

    let format = "Nombre décimal";

    if (Number.isInteger(value)) {
      format = "Entier";
    }

    if (Math.abs(value) >= 1e6 || (Math.abs(value) <= 1e-6 && value !== 0)) {
      value = value.toExponential(4);
      format = "Notation scientifique";
    } else {
      value = Math.round(value * 1e6) / 1e6;
    }

    if (!isNaN(value) && Math.abs(value) >= 1000 && format !== "Notation scientifique") {
      value = value.toLocaleString('fr-FR');
      format = "Nombre formaté";
    }

    let conversions = "";
    if (!isNaN(value) && value > 0) {
      const binary = Math.round(value).toString(2);
      const hex = Math.round(value).toString(16).toUpperCase();
      if (binary.length <= 16) {
        conversions = `\n?? Binaire: ${binary}\n?? Hexadécimal: ${hex}`;
      }
    }

    return { 
      error: false, 
      value: value,
      format: format + conversions
    };

  } catch (err) {
    return { 
      error: true, 
      message: "Expression mathématique invalide" 
    };
  }
}