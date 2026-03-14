import { browser } from '$app/environment';
import { encryptApiKey, decryptApiKey } from '../crypto';
import type { ChatSettings, ChatMessage, ProviderPresetId, ChatSession } from './types';

const STORAGE_KEY = 'aiChat.state.v1';
const SESSIONS_KEY = 'aiChat.sessions.v1';

export interface StoredState {
  settings: ChatSettings;
  messages: ChatMessage[];
}

export function loadFromStorage(): Partial<StoredState> | null {
  if (!browser) return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const result: Partial<StoredState> = {};

    if (parsed.settings) {
      result.settings = {
        provider: (parsed.settings.provider as ProviderPresetId) || 'openai',
        apiBaseUrl: parsed.settings.apiBaseUrl || 'https://api.openai.com/v1',
        apiKey: parsed.settings.apiKey ? decryptApiKey(parsed.settings.apiKey) : '',
        model: parsed.settings.model || 'gpt-4o-mini',
        systemPrompt: parsed.settings.systemPrompt || '',
        maxHistory: parsed.settings.maxHistory || 10
      };
    }

    if (Array.isArray(parsed.messages)) {
      result.messages = parsed.messages;
    }

    return result;
  } catch (e) {
    console.error('Failed to load AI chat state:', e);
    return null;
  }
}

export function saveToStorage(settings: ChatSettings, messages: ChatMessage[]): void {
  if (!browser) return;

  try {
    const data = {
      settings: {
        ...settings,
        apiKey: settings.apiKey ? encryptApiKey(settings.apiKey) : ''
      },
      messages
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save AI chat state:', e);
  }
}

export function clearStorage(): void {
  if (!browser) return;
  localStorage.removeItem(STORAGE_KEY);
}

// Chat Sessions Storage
export function loadChatSessions(): ChatSession[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load chat sessions:', e);
    return [];
  }
}

export function saveChatSessions(sessions: ChatSession[]): void {
  if (!browser) return;
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to save chat sessions:', e);
  }
}

export function saveCurrentSession(session: ChatSession): void {
  if (!browser) return;
  const sessions = loadChatSessions();
  const existingIndex = sessions.findIndex(s => s.id === session.id);
  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.unshift(session);
  }
  // Keep only last 50 sessions
  saveChatSessions(sessions.slice(0, 50));
}

export function deleteChatSession(sessionId: string): void {
  if (!browser) return;
  const sessions = loadChatSessions().filter(s => s.id !== sessionId);
  saveChatSessions(sessions);
}
