import { getContext, saveContext } from '../services/context';
import { extractIntent } from '../services/openai';
import { findByPhone, findByLote } from '../services/sheets';
import { queryDocument, formatDocumentResponse } from '../services/documents';
import { sendMessage } from '../services/whatsapp';
import { normalizePhone } from '../utils/normalize';
import {
  formatRecordResponse,
  formatNotFoundResponse,
  formatNoIntentResponse,
  formatFollowUpResponse,
  isFollowUpQuestion,
} from '../utils/formatResponse';
import { getQuickResponse } from '../utils/quickResponses';

const WAITING_MESSAGE = '⏳ Un momento, revisando la base de datos...';
const WAITING_MESSAGE_DOC = '⏳ Un momento, consultando el documento...';

/**
 * Main message handler
 * Processes incoming WhatsApp messages and sends appropriate responses
 */
export async function handleMessage(from: string, text: string): Promise<void> {
  try {
    // 1. Check for quick responses first (no AI needed)
    const quickResponse = getQuickResponse(text);
    
    // Handle greeting, thanks, help - immediate response (no waiting message)
    if (quickResponse.type === 'greeting' || 
        quickResponse.type === 'thanks' || 
        quickResponse.type === 'help') {
      await sendMessage(from, quickResponse.response!);
      return;
    }
    
    // Handle direct phone search
    if (quickResponse.type === 'phone') {
      await sendMessage(from, WAITING_MESSAGE);
      
      try {
        const record = await findByPhone(quickResponse.value!);
        
        if (!record) {
          await sendMessage(from, formatNotFoundResponse('telefono', quickResponse.value!));
          return;
        }
        
        // Send response FIRST, then save context (don't wait for context)
        await sendMessage(from, formatRecordResponse(record));
        saveContext(from, record).catch(err => console.error('Context save error:', err));
      } catch (err) {
        console.error('Phone search error:', err);
        await sendMessage(from, '❌ Error buscando por teléfono. Intenta de nuevo.');
      }
      return;
    }
    
    // Handle direct lote search
    if (quickResponse.type === 'lote') {
      await sendMessage(from, WAITING_MESSAGE);
      
      try {
        const record = await findByLote(quickResponse.value!);
        
        if (!record) {
          await sendMessage(from, formatNotFoundResponse('lote', quickResponse.value!));
          return;
        }
        
        // Send response FIRST, then save context (don't wait for context)
        await sendMessage(from, formatRecordResponse(record));
        saveContext(from, record).catch(err => console.error('Context save error:', err));
      } catch (err) {
        console.error('Lote search error:', err);
        await sendMessage(from, '❌ Error buscando por lote. Intenta de nuevo.');
      }
      return;
    }
    
    // Handle document queries (estatutos, asambleas)
    if (quickResponse.type === 'document' && quickResponse.documentType) {
      await sendMessage(from, WAITING_MESSAGE_DOC);
      
      try {
        const answer = await queryDocument(quickResponse.documentType, quickResponse.question!);
        const response = formatDocumentResponse(quickResponse.documentType, answer);
        await sendMessage(from, response);
      } catch (err) {
        console.error('Document query error:', err);
        await sendMessage(from, '❌ Error consultando el documento. Intenta de nuevo.');
      }
      return;
    }
    
    // 2. Check for existing context (for follow-up questions)
    const contextRecord = await getContext(from);

    // 3. If we have context and this looks like a follow-up question
    if (contextRecord && isFollowUpQuestion(text)) {
      const response = formatFollowUpResponse(text, contextRecord);
      await sendMessage(from, response);
      return;
    }

    // 4. No quick match - use AI to extract intent
    // Send waiting message for complex queries
    await sendMessage(from, WAITING_MESSAGE);
    
    const intent = await extractIntent(text);

    // 5. If no valid intent detected
    if (intent.tipo === 'ninguno') {
      // If we have context, maybe they want to see the record again
      if (contextRecord) {
        const response = formatRecordResponse(contextRecord);
        await sendMessage(from, response);
        return;
      }
      
      // No context, no intent - show help
      const response = formatNoIntentResponse();
      await sendMessage(from, response);
      return;
    }

    // 6. Search based on intent type
    let record = null;

    if (intent.tipo === 'telefono') {
      const normalizedPhone = normalizePhone(intent.valor);
      record = await findByPhone(normalizedPhone);
      
      if (!record) {
        const response = formatNotFoundResponse('telefono', intent.valor);
        await sendMessage(from, response);
        return;
      }
    } else if (intent.tipo === 'lote') {
      record = await findByLote(intent.valor);
      
      if (!record) {
        const response = formatNotFoundResponse('lote', intent.valor);
        await sendMessage(from, response);
        return;
      }
    }

    // 7. Record found - save context and respond
    if (record) {
      await saveContext(from, record);
      const response = formatRecordResponse(record);
      await sendMessage(from, response);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    
    // Send a generic error message to the user
    try {
      await sendMessage(
        from,
        '⚠️ Ocurrió un error procesando tu mensaje. Por favor intenta de nuevo.'
      );
    } catch (sendError) {
      console.error('Error sending error message:', sendError);
    }
  }
}
