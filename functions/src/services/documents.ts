import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { config } from '../config';

// Document types
export type DocumentType = 'estatutos' | 'asambleas';

// Cache for documents (avoid reading file on every request)
const documentCache: Map<DocumentType, { content: string; loadedAt: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load document content from file
 */
function loadDocument(type: DocumentType): string {
  const cached = documentCache.get(type);
  const now = Date.now();
  
  // Return cached if still valid
  if (cached && (now - cached.loadedAt) < CACHE_TTL) {
    return cached.content;
  }
  
  // Load from file
  const filename = `${type}.txt`;
  const filePath = path.join(__dirname, '..', 'documents', filename);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    documentCache.set(type, { content, loadedAt: now });
    return content;
  } catch (error) {
    console.error(`Error loading document ${type}:`, error);
    return '';
  }
}

/**
 * Get OpenAI client
 */
function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: config.openaiApiKey,
  });
}

/**
 * System prompt for document Q&A
 */
const DOCUMENT_SYSTEM_PROMPT = `Eres un asistente del Patronato Nueva Tatumbla. Tu trabajo es responder preguntas basandote UNICAMENTE en el documento proporcionado.

REGLAS IMPORTANTES:
1. Solo responde con informacion que este en el documento
2. Si la informacion no esta en el documento, di "No encontre esa informacion en el documento"
3. Se conciso y directo
4. Usa un tono amigable y profesional
5. Si te preguntan sobre la ultima asamblea, busca la seccion mas reciente
6. Responde en español

FORMATO DE RESPUESTA:
- Respuestas cortas y claras (maximo 500 caracteres)
- Usa viñetas si hay varios puntos
- No inventes informacion`;

/**
 * Query a document with a question using AI
 */
export async function queryDocument(
  documentType: DocumentType,
  question: string
): Promise<string> {
  const documentContent = loadDocument(documentType);
  
  if (!documentContent) {
    return '❌ No pude cargar el documento. Por favor intenta más tarde.';
  }
  
  const client = getOpenAIClient();
  
  try {
    const documentLabel = documentType === 'estatutos' 
      ? 'ESTATUTOS DEL PATRONATO' 
      : 'REGISTRO DE ASAMBLEAS';
    
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: DOCUMENT_SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: `DOCUMENTO: ${documentLabel}\n\n${documentContent}\n\n---\n\nPREGUNTA DEL USUARIO: ${question}` 
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const answer = response.choices[0]?.message?.content?.trim();
    
    if (!answer) {
      return '❌ No pude procesar tu pregunta. Intenta reformularla.';
    }
    
    return answer;
  } catch (error) {
    console.error('Error querying document:', error);
    return '❌ Error consultando el documento. Por favor intenta de nuevo.';
  }
}

/**
 * Detect if a message is asking about documents
 * Returns the document type or null
 */
export function detectDocumentQuery(message: string): { type: DocumentType; question: string } | null {
  const lower = message.toLowerCase().trim();
  
  // Estatutos patterns
  const estatutosPatterns = [
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
  
  // Asambleas patterns
  const asambleasPatterns = [
    /asamblea/i,
    /ultima\s+reunion/i,
    /que (paso|sucedio|se (dijo|acordo|decidio))/i,
    /acuerdos?\s+(de|del|tomados)/i,
    /junta\s+directiva/i,
    /quien(es)?\s+(es|son|quedo)\s+(el|la|como)\s+(presidente|tesorero|secretario)/i,
    /que se (aprobo|voto|decidio)/i,
    /cuando (fue|es|sera) la (ultima|proxima)?\s*(asamblea|reunion)/i,
    /acta/i,
    /minuta/i,
  ];
  
  // Check estatutos
  for (const pattern of estatutosPatterns) {
    if (pattern.test(lower)) {
      return { type: 'estatutos', question: message };
    }
  }
  
  // Check asambleas
  for (const pattern of asambleasPatterns) {
    if (pattern.test(lower)) {
      return { type: 'asambleas', question: message };
    }
  }
  
  return null;
}

/**
 * Format document response for WhatsApp
 */
export function formatDocumentResponse(documentType: DocumentType, answer: string): string {
  const icon = documentType === 'estatutos' ? '📜' : '📋';
  const title = documentType === 'estatutos' ? 'Estatutos' : 'Asambleas';
  
  return `${icon} *Consulta de ${title}*\n\n${answer}`;
}
