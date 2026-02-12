/**
 * Quick responses for common messages that don't need AI
 * Returns null if no quick response matches (then use AI)
 */

export type DocumentType = 'estatutos' | 'asambleas';

export interface QuickResponseResult {
  type: 'greeting' | 'thanks' | 'help' | 'phone' | 'lote' | 'document' | 'none';
  response?: string;
  value?: string; // For phone or lote searches
  documentType?: DocumentType; // For document queries
  question?: string; // Original question for documents
}

// Greeting patterns
const GREETING_PATTERNS = [
  /^hola$/i,
  /^hola[!.]*$/i,
  /^buenas$/i,
  /^buenos d[ií]as?[!.]*$/i,
  /^buenas tardes?[!.]*$/i,
  /^buenas noches?[!.]*$/i,
  /^buen d[ií]a[!.]*$/i,
  /^hey[!.]*$/i,
  /^hi[!.]*$/i,
  /^que tal[!?.]*$/i,
  /^holis[!.]*$/i,
];

// Thanks patterns
const THANKS_PATTERNS = [
  /^gracias[!.]*$/i,
  /^muchas gracias[!.]*$/i,
  /^grax[!.]*$/i,
  /^thank[s]?[!.]*$/i,
  /^ok[,.]?\s*gracias[!.]*$/i,
  /^vale[,.]?\s*gracias[!.]*$/i,
  /^perfecto[,.]?\s*gracias[!.]*$/i,
  /^genial[,.]?\s*gracias[!.]*$/i,
  /^excelente[,.]?\s*gracias[!.]*$/i,
  /^gracias[,.]?\s*muy amable[!.]*$/i,
  /^mil gracias[!.]*$/i,
];

// Help patterns
const HELP_PATTERNS = [
  /^ayuda[!?]*$/i,
  /^help[!?]*$/i,
  /^\?+$/,
  /^como funciona[s]?[!?]*$/i,
  /^que (puedo|puede[s]?) hacer[!?]*$/i,
  /^menu[!?]*$/i,
  /^opciones[!?]*$/i,
  /^comandos[!?]*$/i,
];

// Direct phone number pattern (8+ digits, may have country code)
const PHONE_PATTERN = /^[+]?[0-9]{8,15}$/;

// Direct lote pattern: "lote X" or "lote: X" or just a lote number/code
const LOTE_PATTERN = /^lote[:\s]+(.+)$/i;
const LOTE_DIRECT_PATTERN = /^(\d{1,3}[a-z]?|[a-z]\d{1,2})$/i; // Like "87", "5A", "A1"

/**
 * Gets time-based greeting
 */
function getTimeGreeting(): string {
  // Honduras is UTC-6
  const now = new Date();
  const hondurasHour = (now.getUTCHours() - 6 + 24) % 24;
  
  if (hondurasHour >= 5 && hondurasHour < 12) {
    return '¡Buenos días!';
  } else if (hondurasHour >= 12 && hondurasHour < 18) {
    return '¡Buenas tardes!';
  } else {
    return '¡Buenas noches!';
  }
}

/**
 * Greeting message for new users (dynamic based on time)
 */
export function getGreetingMessage(): string {
  const greeting = getTimeGreeting();
  return `👋 ${greeting} Bienvenido al sistema de consultas del Patronato Nueva Tatumbla.

*Consultar cuotas y pagos:*
📱 Envía tu número de teléfono
📦 O escribe "lote" seguido del número

*Consultar documentos:*
📜 Pregunta sobre los estatutos
📋 Pregunta sobre las asambleas

¿Cómo te puedo ayudar?`;
}

// Keep static version for backward compatibility
export const GREETING_MESSAGE = `👋 ¡Hola! Bienvenido al sistema de consultas del Patronato Nueva Tatumbla.

*Consultar cuotas y pagos:*
📱 Envía tu número de teléfono
📦 O escribe "lote" seguido del número

*Consultar documentos:*
📜 Pregunta sobre los estatutos
📋 Pregunta sobre las asambleas

¿Cómo te puedo ayudar?`;

/**
 * Farewell message
 */
export const THANKS_MESSAGE = `😊 ¡Con gusto! Si necesitas algo más, aquí estaré.

¡Que tengas un excelente día! 👋`;

/**
 * Help message
 */
export const HELP_MESSAGE = `📋 *¿Cómo usar este bot?*

*Consultar cuotas y pagos:*
1️⃣ Envía tu número de teléfono (ej: 99907652)
2️⃣ O escribe "lote" y el número (ej: lote 87)

*Consultar documentos:*
📜 Pregunta sobre *estatutos* (ej: "¿Cuáles son mis derechos?")
📋 Pregunta sobre *asambleas* (ej: "¿Qué pasó en la última asamblea?")

¿En qué te puedo ayudar?`;

// Document detection patterns
const ESTATUTOS_PATTERNS = [
  /estatuto/i,
  /reglamento/i,
  /norma(s)?\s+(del|de)/i,
  /regla(s)?\s+(del|de)/i,
  /articulo\s+\d/i,
  /capitulo\s+/i,
  /cuales son (las|los|mis) (derechos|obligaciones)/i,
  /que dice el estatuto/i,
  /segun (el|los) estatuto/i,
];

const ASAMBLEAS_PATTERNS = [
  /asamblea/i,
  /ultima\s+reunion/i,
  /que (paso|sucedio|se (dijo|acordo|decidio))/i,
  /acuerdos?\s+(de|del|tomados)/i,
  /junta\s+directiva\s+(electa|nueva|actual)/i,
  /quien(es)?\s+(es|son|quedo)\s+(el|la|como)\s+(presidente|tesorero|secretario)/i,
  /que se (aprobo|voto|decidio)/i,
  /cuando (fue|es|sera) la (ultima|proxima)?\s*(asamblea|reunion)/i,
  /acta(s)?\s+(de|del)/i,
  /minuta/i,
];

/**
 * Check if message matches any quick response pattern
 */
export function getQuickResponse(message: string): QuickResponseResult {
  const trimmed = message.trim();
  
  // Check greetings
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: 'greeting', response: getGreetingMessage() };
    }
  }
  
  // Check thanks
  for (const pattern of THANKS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: 'thanks', response: THANKS_MESSAGE };
    }
  }
  
  // Check help
  for (const pattern of HELP_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: 'help', response: HELP_MESSAGE };
    }
  }
  
  // Check direct phone number (just digits)
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (PHONE_PATTERN.test(digitsOnly) && digitsOnly.length >= 8) {
    return { type: 'phone', value: digitsOnly };
  }
  
  // Check "lote X" pattern
  const loteMatch = trimmed.match(LOTE_PATTERN);
  if (loteMatch) {
    return { type: 'lote', value: loteMatch[1].trim() };
  }
  
  // Check direct lote pattern (just "87" or "5A" etc)
  if (LOTE_DIRECT_PATTERN.test(trimmed)) {
    return { type: 'lote', value: trimmed };
  }
  
  // Check for estatutos questions
  for (const pattern of ESTATUTOS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: 'document', documentType: 'estatutos', question: trimmed };
    }
  }
  
  // Check for asambleas questions
  for (const pattern of ASAMBLEAS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: 'document', documentType: 'asambleas', question: trimmed };
    }
  }
  
  // No quick response match
  return { type: 'none' };
}
