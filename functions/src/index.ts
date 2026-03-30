import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { handleMessage } from './handlers/message';
import { parseWebhookPayload, verifyWebhook } from './services/whatsapp';
import {
  sendMonthlyReminders,
  sendTestReminder,
  isPenultimateDayOfMonthHonduras,
  hondurasDateLabel,
} from './services/scheduler';
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

/**
 * Recordatorios: penultimo dia del mes a las 18:00 America/Tegucigalpa.
 * El cron corre cada dia a las 18:00; solo envia si es penultimo dia en Honduras.
 */
export const monthlyReminders = onSchedule(
  {
    schedule: '0 18 * * *',
    timeZone: 'America/Tegucigalpa',
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    console.log('[monthlyReminders] tick honduras_time=' + hondurasDateLabel());

    if (!isPenultimateDayOfMonthHonduras()) {
      console.log('[monthlyReminders] skip not_penultimate_day honduras_time=' + hondurasDateLabel());
      return;
    }

    console.log('[monthlyReminders] run penultimate_day honduras_time=' + hondurasDateLabel());

    try {
      const results = await sendMonthlyReminders();
      console.log(
        '[monthlyReminders] finished ' +
          JSON.stringify({
            sent: results.sent,
            failed: results.failed,
            skipped: results.skipped,
            total: results.total,
          })
      );
    } catch (error) {
      console.error('[monthlyReminders] fatal', error);
      throw error;
    }
  }
);

/**
 * HTTP endpoint to manually trigger reminders (for testing or manual runs)
 * 
 * GET /sendReminders - Send to all residents
 * GET /sendReminders?test=50499999999 - Send test to specific number
 */
export const sendReminders = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (req, res) => {
    // Simple auth check - require a secret header
    const authHeader = req.headers['x-admin-key'];
    if (authHeader !== 'PatronatoAdmin2026') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const testPhone = req.query['test'] as string | undefined;

    try {
      if (testPhone) {
        // Send test to single number
        console.log(`Sending test reminder to ${testPhone}`);
        const result = await sendTestReminder(testPhone);
        res.json(result);
      } else {
        // Send to all residents
        console.log('Sending reminders to all residents');
        const results = await sendMonthlyReminders();
        res.json(results);
      }
    } catch (error) {
      console.error('Error sending reminders:', error);
      res.status(500).json({ error: String(error) });
    }
  }
);
