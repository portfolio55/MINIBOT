/**
 * Validation des numéros WhatsApp
 */

/**
 * Normalise un numéro de téléphone en format international
 * @param {string} phoneNumber - Numéro à normaliser
 * @returns {string|null} - Numéro normalisé ou null si invalide
 */
export function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;
  
  // Nettoyer le numéro (garder uniquement les chiffres)
  const cleaned = phoneNumber.replace(/[^0-9]/g, "");
  
  // Vérifier la longueur minimale (10 chiffres)
  if (cleaned.length < 10) return null;
  
  // Vérifier la longueur maximale (15 chiffres selon E.164)
  if (cleaned.length > 15) return null;
  
  return cleaned;
}

/**
 * Valide un numéro de téléphone WhatsApp
 * @param {string} phoneNumber - Numéro à valider
 * @returns {boolean} - true si valide
 */
export function isValidPhoneNumber(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  return normalized !== null && normalized.length >= 10 && normalized.length <= 15;
}

/**
 * Formate un numéro pour l'affichage
 * @param {string} phoneNumber - Numéro à formater
 * @returns {string} - Numéro formaté
 */
export function formatPhoneNumber(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return phoneNumber;
  
  // Format simple : +XX XXX XXX XXXX
  if (normalized.length > 10) {
    return `+${normalized}`;
  }
  return normalized;
}
