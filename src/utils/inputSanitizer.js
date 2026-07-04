/**
 * Module de sanitisation et validation des entrées - SIGMA MDX DEPLOY
 * Protège contre les injections, XSS, et entrées malformées
 */

/**
 * Nettoie une chaîne de caractères pour éviter les injections
 * @param {string} input - Entrée brute
 * @param {object} options - Options de sanitisation
 * @returns {string} Entrée nettoyée
 */
export function sanitizeString(input, options = {}) {
  if (typeof input !== "string") return "";
  
  const {
    maxLength = 1000,
    allowHtml = false,
    trimWhitespace = true,
  } = options;

  let cleaned = input;

  // Limiter la longueur
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
  }

  // Supprimer les caractères de contrôle (sauf newline et tab)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Échapper le HTML si non autorisé
  if (!allowHtml) {
    cleaned = cleaned
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }

  if (trimWhitespace) {
    cleaned = cleaned.trim();
  }

  return cleaned;
}

/**
 * Valide et nettoie un numéro de téléphone
 * @param {string} phoneNumber - Numéro brut
 * @returns {{ valid: boolean, normalized: string|null, error: string|null }}
 */
export function validatePhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== "string") {
    return { valid: false, normalized: null, error: "Numéro requis" };
  }

  // Nettoyer : garder uniquement les chiffres et le +
  const cleaned = phoneNumber.replace(/[^0-9+]/g, "");
  
  // Retirer le + initial pour la normalisation
  const digits = cleaned.replace(/^\+/, "");

  // Vérifier la longueur (E.164 : 10-15 chiffres)
  if (digits.length < 10) {
    return { valid: false, normalized: null, error: "Numéro trop court (minimum 10 chiffres)" };
  }
  if (digits.length > 15) {
    return { valid: false, normalized: null, error: "Numéro trop long (maximum 15 chiffres)" };
  }

  // Vérifier que ce ne sont que des chiffres
  if (!/^\d+$/.test(digits)) {
    return { valid: false, normalized: null, error: "Le numéro ne doit contenir que des chiffres" };
  }

  return { valid: true, normalized: digits, error: null };
}

/**
 * Valide un UUID v4
 * @param {string} uuid - UUID à valider
 * @returns {boolean}
 */
export function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

/**
 * Valide un token hexadécimal (64 chars)
 * @param {string} token - Token à valider
 * @returns {boolean}
 */
export function isValidToken(token) {
  if (!token || typeof token !== "string") return false;
  return /^[a-f0-9]{64}$/i.test(token);
}

/**
 * Valide un JID WhatsApp
 * @param {string} jid - JID à valider
 * @returns {boolean}
 */
export function isValidWhatsAppJid(jid) {
  if (!jid || typeof jid !== "string") return false;
  // Format: numéro@s.whatsapp.net ou numéro@g.us
  return /^\d{10,15}@(s\.whatsapp\.net|g\.us)$/.test(jid);
}

/**
 * Nettoie un argument de commande bot
 * @param {string} arg - Argument brut
 * @returns {string} Argument nettoyé
 */
export function sanitizeCommandArg(arg) {
  if (typeof arg !== "string") return "";
  // Retirer les caractères potentiellement dangereux pour les commandes shell
  return arg
    .replace(/[;&|`$(){}[\]\\]/g, "")
    .trim()
    .slice(0, 500);
}

/**
 * Valide une URL
 * @param {string} url - URL à valider
 * @returns {boolean}
 */
export function isValidUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Limite le nombre d'éléments dans un tableau
 * @param {Array} arr - Tableau à limiter
 * @param {number} max - Nombre maximum d'éléments
 * @returns {Array}
 */
export function limitArray(arr, max = 100) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, max);
}

export default {
  sanitizeString,
  validatePhoneNumber,
  isValidUUID,
  isValidToken,
  isValidWhatsAppJid,
  sanitizeCommandArg,
  isValidUrl,
  limitArray,
};
