import { SheetRecord } from '../types';

/**
 * Formats a currency value with Lempiras symbol
 */
function formatCurrency(value: number): string {
  return `L ${value.toLocaleString('es-HN')}`;
}

/**
 * Gets status indicator based on debt amount
 */
function getStatusIndicator(deuda: number, cuota: number): string {
  if (deuda <= 0) {
    return '✅ AL DÍA';
  } else if (deuda <= cuota * 2) {
    return '⚠️ DEUDA BAJA';
  } else if (deuda <= cuota * 6) {
    return '🟠 DEUDA MEDIA';
  } else {
    return '❌ DEUDA ALTA';
  }
}

/**
 * Gets suggestions based on the record status
 */
function getSuggestions(record: SheetRecord): string {
  const suggestions = [
    '',
    '━━━━━━━━━━━━━━━━━━━━━',
    '💡 *Puedes preguntarme:*',
  ];
  
  if (record.deuda_total > 0) {
    suggestions.push('• "¿Cuánto debe?"');
    suggestions.push('• "¿Cuándo fue el último pago?"');
  } else {
    suggestions.push('• "¿Cuándo fue el último pago?"');
    suggestions.push('• "¿Cuál es la cuota?"');
  }
  
  suggestions.push('');
  suggestions.push('O envía otro número/lote para consultar.');
  
  return suggestions.join('\n');
}

/**
 * Formats a SheetRecord into a WhatsApp-friendly message
 */
export function formatRecordResponse(record: SheetRecord): string {
  const fullName = `${record.nombre} ${record.apellido}`.trim();
  const status = getStatusIndicator(record.deuda_total, record.cuota_mensual);
  
  const lines = [
    `📄 *Información encontrada*`,
    '',
    `${status}`,
    '',
    `👤 *${fullName}*`,
  ];

  // Add lote if available
  if (record.lote) {
    lines.push(`📦 Lote: ${record.lote}`);
  }

  // Add phone if available
  if (record.telefono) {
    lines.push(`📞 Teléfono: ${record.telefono}`);
  }

  lines.push('');
  lines.push(`💰 Cuota mensual: ${formatCurrency(record.cuota_mensual)}`);
  lines.push(`📊 Saldo actual: ${formatCurrency(record.deuda_total)}`);
  
  // Handle ultimo_pago - show as-is (could be date or text like "Sin pagos registrados")
  if (record.ultimo_pago) {
    lines.push(`📅 Último pago: ${record.ultimo_pago}`);
  }
  
  // Add suggestions
  lines.push(getSuggestions(record));

  return lines.join('\n');
}

/**
 * Formats a "not found" response
 */
export function formatNotFoundResponse(searchType: 'telefono' | 'lote', searchValue: string): string {
  if (searchType === 'telefono') {
    return `❌ No se encontró ningún registro con el teléfono: ${searchValue}

💡 Verifica el número e intenta de nuevo, o prueba buscando por lote.`;
  }
  return `❌ No se encontró ningún registro con el lote: ${searchValue}

💡 Verifica el número de lote e intenta de nuevo, o prueba con tu número de teléfono.`;
}

/**
 * Formats a response for when no intent was detected
 */
export function formatNoIntentResponse(): string {
  return `👋 ¡Hola! Puedo ayudarte a consultar información.

Por favor envíame:
📱 Un número de teléfono (ej: 50499907652)
📦 O un número de lote (ej: "lote 87")`;
}

/**
 * Formats a follow-up response based on the question and context
 */
export function formatFollowUpResponse(question: string, record: SheetRecord): string {
  const lowerQuestion = question.toLowerCase();
  const fullName = `${record.nombre} ${record.apellido}`.trim();

  // Check for debt-related questions
  if (lowerQuestion.includes('debe') || lowerQuestion.includes('deuda') || lowerQuestion.includes('saldo')) {
    if (record.deuda_total <= 0) {
      return `✅ *${fullName}* está al día.
      
No tiene deuda pendiente. ¡Felicidades! 🎉`;
    }
    return `💰 *${fullName}* tiene un saldo de ${formatCurrency(record.deuda_total)}

📅 Último pago: ${record.ultimo_pago || 'Sin información'}`;
  }

  // Check for payment-related questions
  if (lowerQuestion.includes('pago') || lowerQuestion.includes('pagó') || lowerQuestion.includes('pagar')) {
    if (record.ultimo_pago) {
      return `📅 *Último pago de ${fullName}:*
${record.ultimo_pago}

💰 Monto: ${formatCurrency(record.cuota_actual)}`;
    }
    return `📅 No hay información de pagos registrados para *${fullName}*`;
  }

  // Check for "al día" / "está al día" questions
  if (lowerQuestion.includes('al día') || lowerQuestion.includes('al dia')) {
    if (record.deuda_total <= 0) {
      return `✅ Sí, *${fullName}* está al día.

No tiene deuda pendiente.`;
    }
    return `❌ No, *${fullName}* tiene un saldo pendiente de ${formatCurrency(record.deuda_total)}`;
  }

  // Check for cuota questions
  if (lowerQuestion.includes('cuota')) {
    return `💵 La cuota mensual de *${fullName}* es de ${formatCurrency(record.cuota_mensual)}`;
  }

  // Default: show full record again
  return formatRecordResponse(record);
}

/**
 * Checks if a message looks like a follow-up question
 */
export function isFollowUpQuestion(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  const followUpPatterns = [
    'cuánto debe',
    'cuanto debe',
    'está al día',
    'esta al dia',
    'al día',
    'al dia',
    'último pago',
    'ultimo pago',
    'cuándo pagó',
    'cuando pago',
    'deuda',
    'saldo',
    'cuota',
  ];

  return followUpPatterns.some(pattern => lowerMessage.includes(pattern));
}
