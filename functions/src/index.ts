import { onRequest } from 'firebase-functions/v2/https';
import { handleMessage } from './handlers/message';
import { parseWebhookPayload, verifyWebhook } from './services/whatsapp';
import { WhatsAppWebhookPayload } from './types';

// Simple deduplication: track processed message IDs (in-memory, resets on cold start)
const processedMessages = new Set<string>();
const MAX_PROCESSED_MESSAGES = 1000;

/**
 * WhatsApp Webhook Endpoint (Firebase Functions v2)
 * 
 * GET: Webhook verification (Meta challenge)
 * POST: Incoming messages
 */
export const webhook = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (req, res) => {
    // GET - Webhook verification
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'] as string | undefined;
      const token = req.query['hub.verify_token'] as string | undefined;
      const challenge = req.query['hub.challenge'] as string | undefined;

      const result = verifyWebhook(mode, token, challenge);

      if (result) {
        console.log('Webhook verified successfully');
        res.status(200).send(result);
        return;
      }

      console.error('Webhook verification failed');
      res.status(403).send('Forbidden');
      return;
    }

    // POST - Incoming messages
    if (req.method === 'POST') {
      // Always respond 200 to Meta quickly to avoid retries
      res.status(200).send('OK');
      
      try {
        const payload = req.body as WhatsAppWebhookPayload;

        // Parse messages from the payload
        const messages = parseWebhookPayload(payload);

        // Process each message
        for (const message of messages) {
          // Skip if already processed (deduplication)
          if (processedMessages.has(message.id)) {
            console.log(`Skipping duplicate message: ${message.id}`);
            continue;
          }
          
          // Mark as processed
          processedMessages.add(message.id);
          
          // Clean up old entries if too many
          if (processedMessages.size > MAX_PROCESSED_MESSAGES) {
            const firstKey = processedMessages.values().next().value;
            if (firstKey) processedMessages.delete(firstKey);
          }
          
          console.log(`Processing message from ${message.from}: ${message.text.body}`);
          
          // Handle the message
          await handleMessage(message.from, message.text.body);
        }
      } catch (error) {
        console.error('Error processing webhook:', error);
      }
      return;
    }

    // Other methods not allowed
    res.status(405).send('Method Not Allowed');
  }
);
