import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ConversationContext, SheetRecord } from '../types';

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const COLLECTION_NAME = 'conversations';

// Context TTL: 30 minutes in milliseconds
const CONTEXT_TTL_MS = 30 * 60 * 1000;

/**
 * Gets the conversation context for a WhatsApp number
 * Returns null if no context exists or if it has expired
 */
export async function getContext(whatsappNumber: string): Promise<SheetRecord | null> {
  try {
    const docRef = db.collection(COLLECTION_NAME).doc(whatsappNumber);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as ConversationContext;
    
    // Check if context has expired
    const now = Date.now();
    if (now - data.timestamp > CONTEXT_TTL_MS) {
      // Context expired, delete it
      await docRef.delete();
      return null;
    }

    return data.record;
  } catch (error) {
    console.error('Error getting context:', error);
    return null;
  }
}

/**
 * Saves the conversation context for a WhatsApp number
 * Overwrites any existing context
 */
export async function saveContext(whatsappNumber: string, record: SheetRecord): Promise<void> {
  try {
    const context: ConversationContext = {
      whatsappNumber,
      record,
      timestamp: Date.now(),
    };

    await db.collection(COLLECTION_NAME).doc(whatsappNumber).set(context);
  } catch (error) {
    console.error('Error saving context:', error);
    throw error;
  }
}

/**
 * Clears the conversation context for a WhatsApp number
 */
export async function clearContext(whatsappNumber: string): Promise<void> {
  try {
    await db.collection(COLLECTION_NAME).doc(whatsappNumber).delete();
  } catch (error) {
    console.error('Error clearing context:', error);
  }
}
