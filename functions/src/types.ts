/**
 * Registro del Google Sheet
 */
export interface SheetRecord {
  telefono: string;
  lote: string;
  nombre: string;
  apellido: string;
  cuota_mensual: number;
  deuda_total: number;
  ultimo_pago: string;
  cuota_actual: number;
}

/**
 * Resultado de extracción de intención de OpenAI
 */
export interface IntentResult {
  tipo: 'telefono' | 'lote' | 'ninguno';
  valor: string;
}

/**
 * Contexto de conversación guardado en Firestore
 */
export interface ConversationContext {
  whatsappNumber: string;
  record: SheetRecord;
  timestamp: number;
}

/**
 * Mensaje entrante de WhatsApp
 */
export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text: {
    body: string;
  };
  type: string;
}

/**
 * Payload del webhook de WhatsApp
 */
export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}
