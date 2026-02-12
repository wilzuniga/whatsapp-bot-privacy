import { config } from '../config';
import { WhatsAppWebhookPayload, WhatsAppMessage } from '../types';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Sends a text message via WhatsApp Cloud API
 */
export async function sendMessage(to: string, text: string): Promise<void> {
  const url = `${WHATSAPP_API_URL}/${config.whatsappPhoneId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.whatsappToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('WhatsApp API error:', errorData);
    throw new Error(`WhatsApp API error: ${response.status}`);
  }
}

/**
 * Extracts messages from a WhatsApp webhook payload
 */
export function parseWebhookPayload(payload: WhatsAppWebhookPayload): WhatsAppMessage[] {
  const messages: WhatsAppMessage[] = [];

  if (payload.object !== 'whatsapp_business_account') {
    return messages;
  }

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field === 'messages' && change.value.messages) {
        for (const message of change.value.messages) {
          // Only process text messages
          if (message.type === 'text' && message.text?.body) {
            messages.push(message);
          }
        }
      }
    }
  }

  return messages;
}

/**
 * Verifies the webhook challenge from Meta
 */
export function verifyWebhook(
  mode: string | undefined,
  token: string | undefined,
  challenge: string | undefined
): string | null {
  if (mode === 'subscribe' && token === config.whatsappVerifyToken) {
    return challenge || null;
  }
  return null;
}
