// Database-backed chat storage utilities

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  preview?: string | null;
  messageCount?: number;
};

// Track saved message IDs to avoid duplicates
const savedMessageIds = new Set<string>();

// Save or update chat session
export async function saveChatSession(session: ChatSession): Promise<void> {
  try {
    // Check if session exists
    const existing = await getChatSession(session.id);
    
    if (existing) {
      // Update existing session
      await fetch(`/api/chat/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: session.title,
          preview: session.messages[0]?.content?.slice(0, 100),
          messageCount: session.messages.length,
        }),
      });
      
      // Only save new messages (not already in database)
      const existingMessageCount = existing.messages.length;
      const newMessages = session.messages.slice(existingMessageCount);
      
      for (const message of newMessages) {
        const messageId = `${session.id}-${message.timestamp}`;
        if (!savedMessageIds.has(messageId)) {
          await fetch('/api/chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: session.id,
              role: message.role,
              content: message.content,
            }),
          });
          savedMessageIds.add(messageId);
        }
      }
    } else {
      // Create new session
      await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: session.title,
          preview: session.messages[0]?.content?.slice(0, 100),
        }),
      });
      
      // Save all messages for new session
      for (const message of session.messages) {
        const messageId = `${session.id}-${message.timestamp}`;
        if (!savedMessageIds.has(messageId)) {
          await fetch('/api/chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: session.id,
              role: message.role,
              content: message.content,
            }),
          });
          savedMessageIds.add(messageId);
        }
      }
    }
  } catch (error) {
    console.error('Failed to save chat session:', error);
    // Fallback to localStorage if API fails
    saveToLocalStorage(session);
  }
}

// Get all chat sessions
export async function getChatSessions(): Promise<ChatSession[]> {
  try {
    const response = await fetch('/api/chat/sessions');
    if (!response.ok) throw new Error('Failed to fetch sessions');
    
    const dbSessions = await response.json();
    
    // Convert to ChatSession format
    return dbSessions.map((s: any) => ({
      id: s.id,
      title: s.title,
      messages: [], // Messages loaded separately when needed
      createdAt: new Date(s.createdAt).getTime(),
      updatedAt: new Date(s.updatedAt).getTime(),
      preview: s.preview,
      messageCount: s.messageCount,
    }));
  } catch (error) {
    console.error('Failed to load chat sessions:', error);
    // Fallback to localStorage
    return getFromLocalStorage();
  }
}

// Get specific chat session with messages
export async function getChatSession(id: string): Promise<ChatSession | null> {
  try {
    const response = await fetch(`/api/chat/sessions/${id}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    return {
      id: data.id,
      title: data.title,
      messages: data.messages.map((m: any) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.createdAt).getTime(),
      })),
      createdAt: new Date(data.createdAt).getTime(),
      updatedAt: new Date(data.updatedAt).getTime(),
      preview: data.preview,
      messageCount: data.messageCount,
    };
  } catch (error) {
    console.error('Failed to load chat session:', error);
    return null;
  }
}

// Delete chat session
export async function deleteChatSession(id: string): Promise<void> {
  try {
    await fetch(`/api/chat/sessions/${id}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Failed to delete chat session:', error);
  }
}

// Generate session ID
export function generateSessionId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate title from first message
export function generateTitle(firstMessage: string): string {
  return firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
}

// ===== FALLBACK: localStorage functions =====
const STORAGE_KEY = 'chat_history';

function saveToLocalStorage(session: ChatSession): void {
  try {
    const sessions = getFromLocalStorage();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.unshift(session);
    }
    
    const trimmedSessions = sessions.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedSessions));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

function getFromLocalStorage(): ChatSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return [];
  }
}
