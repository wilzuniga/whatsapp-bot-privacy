import OpenAI from 'openai';
import { IntentResult } from '../types';
import { config } from '../config';

// System prompt for intent extraction (as specified)
const SYSTEM_PROMPT = `Tu tarea es identificar si el usuario está solicitando información por:
- número de teléfono
- número de lote

Respondé únicamente en JSON válido, sin texto adicional.

Formato:
{
  "tipo": "telefono" | "lote" | "ninguno",
  "valor": "string"
}

Ejemplos:
- "Dame los datos del lote 87" -> { "tipo": "lote", "valor": "87" }
- "50499907652" -> { "tipo": "telefono", "valor": "50499907652" }
- "información del 50499999999" -> { "tipo": "telefono", "valor": "50499999999" }
- "lote 12" -> { "tipo": "lote", "valor": "12" }
- "hola" -> { "tipo": "ninguno", "valor": "" }`;

/**
 * Creates an OpenAI client instance
 */
function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: config.openaiApiKey,
  });
}

/**
 * Extracts intent and value from user message
 * Uses OpenAI to determine if user is asking for phone or lote lookup
 */
export async function extractIntent(userMessage: string): Promise<IntentResult> {
  const client = getOpenAIClient();

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0,
      max_tokens: 100,
    });

    const content = response.choices[0]?.message?.content?.trim();
    
    if (!content) {
      return { tipo: 'ninguno', valor: '' };
    }

    // Parse the JSON response
    const parsed = JSON.parse(content) as IntentResult;
    
    // Validate the response structure
    if (!parsed.tipo || !['telefono', 'lote', 'ninguno'].includes(parsed.tipo)) {
      return { tipo: 'ninguno', valor: '' };
    }

    return {
      tipo: parsed.tipo,
      valor: parsed.valor || '',
    };
  } catch (error) {
    console.error('Error extracting intent:', error);
    return { tipo: 'ninguno', valor: '' };
  }
}
