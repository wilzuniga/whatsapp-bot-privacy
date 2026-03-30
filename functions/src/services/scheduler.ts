import { getSheetData, findByPhone } from './sheets';
import { config } from '../config';

const HONDURAS_TZ = 'America/Tegucigalpa';

function hondurasCalendarParts(at: Date): { y: number; m: number; d: number; lastDayOfMonth: number } | null {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: HONDURAS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(at);
  const y = Number(parts.find(p => p.type === 'year')?.value);
  const m = Number(parts.find(p => p.type === 'month')?.value);
  const d = Number(parts.find(p => p.type === 'day')?.value);
  if (!y || !m || !d) return null;
  const lastDayOfMonth = new Date(y, m, 0).getDate();
  return { y, m, d, lastDayOfMonth };
}

/**
 * True if `at` is the last calendar day of the month in Honduras.
 */
export function isLastDayOfMonthHonduras(at: Date = new Date()): boolean {
  const cal = hondurasCalendarParts(at);
  if (!cal) return false;
  return cal.d === cal.lastDayOfMonth;
}

/**
 * True if `at` is the penultimate (second-to-last) calendar day in Honduras.
 * Ej: ene 30 si el mes termina en 31; feb 27 (o 28 en bisiesto) si feb termina 28/29.
 */
export function isPenultimateDayOfMonthHonduras(at: Date = new Date()): boolean {
  const cal = hondurasCalendarParts(at);
  if (!cal || cal.lastDayOfMonth < 2) return false;
  return cal.d === cal.lastDayOfMonth - 1;
}

/** Para logs: fecha legible en Honduras */
export function hondurasDateLabel(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: HONDURAS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(at);
}

function templateName(): string {
  return config.whatsappTemplateName;
}

function templateLang(): string {
  return config.whatsappTemplateLang;
}

/**
 * Format currency for display in template
 */
function formatCurrency(amount: number): string {
  if (amount < 0) {
    return `-${Math.abs(amount).toLocaleString('es-HN')}`;
  }
  return amount.toLocaleString('es-HN');
}

/**
 * Send a template message to a WhatsApp number
 */
async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  parameters: string[]
): Promise<{ success: boolean; error?: string }> {
  const url = `https://graph.facebook.com/v21.0/${config.whatsappPhoneId}/messages`;
  
  const body = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      components: [
        {
          type: 'body',
          parameters: parameters.map(text => ({
            type: 'text',
            text: text,
          })),
        },
      ],
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[reminder]', to, 'fallo_api');
      return { success: false, error: JSON.stringify(data.error || data) };
    }

    return { success: true };
  } catch (error) {
    console.error('[reminder]', to, 'fallo_excepcion', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send payment reminders to all residents with valid phone numbers
 * This function is called by the scheduled Cloud Function
 */
export async function sendMonthlyReminders(): Promise<{
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{ phone: string; status: string; error?: string }>;
}> {
  console.log('[reminder] inicio lote honduras_time=' + hondurasDateLabel());

  const results = {
    total: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    details: [] as Array<{ phone: string; status: string; error?: string }>,
  };

  try {
    // Get all records from the sheet
    const records = await getSheetData();
    results.total = records.length;
    
    console.log('[reminder] filas_sheet=' + records.length);

    for (const record of records) {
      // Skip records without a valid phone number
      const phone = record.telefono.replace(/\D/g, '');
      
      if (!phone || phone.length < 8) {
        console.log('[reminder]', record.telefono || 'sin_numero', 'omitido');
        results.skipped++;
        results.details.push({ 
          phone: record.telefono || 'N/A', 
          status: 'skipped', 
          error: 'No valid phone number' 
        });
        continue;
      }

      // Prepare template parameters
      const fullName = `${record.nombre} ${record.apellido}`.trim();
      const cuotaMensual = formatCurrency(record.cuota_mensual);
      const saldoActual = formatCurrency(record.deuda_total);
      const ultimoPago = record.ultimo_pago || 'Sin registro';

      const parameters = [
        fullName,           // {{1}} - Nombre
        cuotaMensual,       // {{2}} - Cuota mensual
        saldoActual,        // {{3}} - Saldo actual
        ultimoPago,         // {{4}} - Último pago
      ];

      // Send the template message
      const result = await sendTemplateMessage(
        phone,
        templateName(),
        templateLang(),
        parameters
      );

      if (result.success) {
        console.log('[reminder]', phone, 'enviado');
        results.sent++;
        results.details.push({ phone, status: 'sent' });
      } else {
        console.log('[reminder]', phone, 'no_enviado');
        results.failed++;
        results.details.push({ phone, status: 'failed', error: result.error });
      }

      // Rate limiting: wait 100ms between messages to avoid hitting API limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(
      '[reminder] fin lote enviados=' +
        results.sent +
        ' no_enviados=' +
        results.failed +
        ' omitidos=' +
        results.skipped +
        ' honduras_time=' +
        hondurasDateLabel()
    );

  } catch (error) {
    console.error('[reminder] error_lote', error);
    throw error;
  }

  return results;
}

/**
 * Test function: send reminder to one number using datos reales del Sheet (busqueda por telefono).
 */
export async function sendTestReminder(testPhone: string): Promise<{
  success: boolean;
  message: string;
}> {
  const digits = testPhone.replace(/\D/g, '');
  console.log(`Test reminder: looking up ${digits} in sheet...`);

  const record = await findByPhone(digits);
  if (!record) {
    return {
      success: false,
      message: `No hay registro en el Sheet para el telefono ${digits}. Verifica el numero en Vista_Bot Valores.`,
    };
  }

  const fullName = `${record.nombre} ${record.apellido}`.trim();
  const cuotaMensual = formatCurrency(record.cuota_mensual);
  const saldoActual = formatCurrency(record.deuda_total);
  const ultimoPago = record.ultimo_pago || 'Sin registro';

  const parameters = [fullName, cuotaMensual, saldoActual, ultimoPago];

  const result = await sendTemplateMessage(
    digits,
    templateName(),
    templateLang(),
    parameters
  );

  if (result.success) {
    console.log('[reminder]', digits, 'enviado');
    return {
      success: true,
      message: `Enviado a ${digits} (${fullName}). Estado: enviado.`,
    };
  }
  console.log('[reminder]', digits, 'no_enviado');
  return { success: false, message: `No enviado: ${result.error}` };
}
