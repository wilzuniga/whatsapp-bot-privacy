/**
 * Normalizes a phone number by removing all non-digit characters
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Normalizes a lote value by trimming whitespace
 */
export function normalizeLote(lote: string): string {
  return lote.trim();
}
