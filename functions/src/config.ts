/**
 * Configuration module - loads environment variables
 */

export const config = {
  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  
  // Google Sheets
  googleSheetsId: process.env.GOOGLE_SHEETS_ID || '',
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
  googlePrivateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  
  // WhatsApp
  whatsappToken: process.env.WHATSAPP_TOKEN || '',
  whatsappPhoneId: process.env.WHATSAPP_PHONE_ID || '',
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
  /** Message template for proactive reminders (must match Meta exactly) */
  whatsappTemplateName: process.env.WHATSAPP_TEMPLATE_NAME || 'recordatorio_de_pagos_nueva_tatumbla',
  /** Locale code as in Meta (e.g. es, es_HN, es_MX) */
  whatsappTemplateLang: process.env.WHATSAPP_TEMPLATE_LANG || 'es',
};
