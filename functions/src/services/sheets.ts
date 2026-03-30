import { google } from 'googleapis';
import { SheetRecord } from '../types';
import { config } from '../config';

// Column mapping based on actual sheet structure (0-indexed)
// A: WhatsApp, B: Lote, C: Nombre, D: Apellido, E: Cuota, F: SaldoActual, G: MesUltimoPago, H: MontoUltimoPago
const COLUMNS = {
  TELEFONO: 0,      // WhatsApp
  LOTE: 1,          // Lote
  NOMBRE: 2,        // Nombre
  APELLIDO: 3,      // Apellido
  CUOTA_MENSUAL: 4, // Cuota
  DEUDA_TOTAL: 5,   // SaldoActual
  ULTIMO_PAGO: 6,   // MesUltimoPago
  CUOTA_ACTUAL: 7,  // MontoUltimoPago
};

/**
 * Creates an authenticated Google Sheets client
 */
function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Parses currency values in multiple formats:
 * - "L 200,00" or "L200.00" (with or without space)
 * - "L 11,300.00" or "L11.300,00" (thousands with comma or dot)
 * - "-L100.00" or "-L 4,000.00" (negative values)
 * - "L-" or "L -" (zero)
 * - "-L4,000.00" (negative with thousands)
 * 
 * Handles both formats:
 * - US: comma for thousands, dot for decimal (L11,300.00)
 * - EU: dot for thousands, comma for decimal (L11.300,00)
 */
function parseCurrency(value: string | undefined | null): number {
  if (!value) {
    return 0;
  }
  
  const trimmed = value.trim();
  
  // Handle empty, dash only, or "L-" / "L -" cases
  if (trimmed === '' || trimmed === '-' || trimmed === 'L-' || trimmed === 'L -' || trimmed === 'L' || trimmed === '-L') {
    return 0;
  }
  
  // Check for "Sin pagos" text
  if (trimmed.toLowerCase().includes('sin pagos')) {
    return 0;
  }
  
  // Detect if negative: starts with - or has -L
  const isNegative = trimmed.startsWith('-') || trimmed.includes('-L');
  
  // Remove "L", spaces, and minus signs to get just the number
  let cleaned = trimmed
    .replace(/L/gi, '')  // Remove L (case insensitive)
    .replace(/\s/g, '')   // Remove spaces
    .replace(/-/g, '');   // Remove minus signs (we already tracked negativity)
  
  // If nothing left after cleaning, return 0
  if (!cleaned || cleaned === '') {
    return 0;
  }
  
  // Detect format by analyzing the pattern
  // US format: "11,300.00" - comma before dot, or only commas for thousands
  // EU format: "11.300,00" - dot before comma, or only dots for thousands
  
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  
  if (lastComma === -1 && lastDot === -1) {
    // No separators, just a number like "100" or "4000"
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : (isNegative ? -parsed : parsed);
  }
  
  if (lastComma === -1 && lastDot !== -1) {
    // Only dots: could be "11.300" (EU thousands) or "100.00" (US decimal)
    // If dot is in last 3 positions and has 1-2 digits after, treat as decimal
    const digitsAfterDot = cleaned.length - lastDot - 1;
    if (digitsAfterDot <= 2) {
      // Treat as decimal: "100.00" -> 100.00
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : (isNegative ? -parsed : parsed);
    } else {
      // Treat as thousands separator: "11.300" -> 11300
      cleaned = cleaned.replace(/\./g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : (isNegative ? -parsed : parsed);
    }
  }
  
  if (lastDot === -1 && lastComma !== -1) {
    // Only commas: could be "11,300" (US thousands) or "100,00" (EU decimal)
    const digitsAfterComma = cleaned.length - lastComma - 1;
    if (digitsAfterComma <= 2) {
      // Treat as decimal: "100,00" -> 100.00
      cleaned = cleaned.replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : (isNegative ? -parsed : parsed);
    } else {
      // Treat as thousands separator: "11,300" -> 11300
      cleaned = cleaned.replace(/,/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : (isNegative ? -parsed : parsed);
    }
  }
  
  // Both comma and dot present
  if (lastDot > lastComma) {
    // US format: "11,300.00" - comma is thousands, dot is decimal
    cleaned = cleaned.replace(/,/g, ''); // Remove thousand separators
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : (isNegative ? -parsed : parsed);
  } else {
    // EU format: "11.300,00" - dot is thousands, comma is decimal
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : (isNegative ? -parsed : parsed);
  }
}

/**
 * Converts a row from the sheet to a SheetRecord object
 */
function rowToRecord(row: string[]): SheetRecord {
  return {
    telefono: (row[COLUMNS.TELEFONO] || '').trim(),
    lote: (row[COLUMNS.LOTE] || '').trim(),
    nombre: (row[COLUMNS.NOMBRE] || '').trim(),
    apellido: (row[COLUMNS.APELLIDO] || '').trim(),
    cuota_mensual: parseCurrency(row[COLUMNS.CUOTA_MENSUAL]),
    deuda_total: parseCurrency(row[COLUMNS.DEUDA_TOTAL]),
    ultimo_pago: (row[COLUMNS.ULTIMO_PAGO] || '').trim(),
    cuota_actual: parseCurrency(row[COLUMNS.CUOTA_ACTUAL]),
  };
}

/**
 * Fetches all data from the Google Sheet
 */
export async function getSheetData(): Promise<SheetRecord[]> {
  const sheets = getSheetsClient();
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetsId,
    range: "'Vista_Bot Valores'!A2:H", // Sheet name + skip header row, columns A-H
  });

  const rows = response.data.values || [];
  return rows.map(row => rowToRecord(row as string[]));
}

/**
 * Finds a record by phone number match
 * Supports exact match or partial match (last 8 digits)
 * @param phone - Normalized phone number (digits only)
 */
export async function findByPhone(phone: string): Promise<SheetRecord | null> {
  const records = await getSheetData();
  
  // Normalize the search phone (remove any non-digits)
  const normalizedPhone = phone.replace(/\D/g, '');
  
  // First try exact match
  let found = records.find(record => {
    const recordPhone = record.telefono.replace(/\D/g, '');
    return recordPhone === normalizedPhone && recordPhone !== '';
  });
  
  // If not found and search has 8 digits, try matching last 8 digits
  if (!found && normalizedPhone.length === 8) {
    found = records.find(record => {
      const recordPhone = record.telefono.replace(/\D/g, '');
      // Check if record phone ends with the search number
      return recordPhone.endsWith(normalizedPhone) && recordPhone !== '';
    });
  }
  
  // If not found and search has more than 8 digits, try matching by last 8 of both
  if (!found && normalizedPhone.length > 8) {
    const searchLast8 = normalizedPhone.slice(-8);
    found = records.find(record => {
      const recordPhone = record.telefono.replace(/\D/g, '');
      const recordLast8 = recordPhone.slice(-8);
      return recordLast8 === searchLast8 && recordPhone !== '';
    });
  }

  return found || null;
}

/**
 * Finds a record by lote number (supports multiple lotes in a single field)
 * @param lote - Lote number to search for
 */
export async function findByLote(lote: string): Promise<SheetRecord | null> {
  const records = await getSheetData();
  
  // Normalize the search lote (trim and lowercase for comparison)
  const normalizedLote = lote.trim().toLowerCase();
  
  const found = records.find(record => {
    // Handle multiple lotes separated by comma (e.g., "87,88" or "69,70,71")
    // Also handle formats like "56,56B, 57" or "A1,A2,A3"
    const lotes = record.lote.split(',').map(l => l.trim().toLowerCase());
    return lotes.some(l => l === normalizedLote);
  });

  return found || null;
}
