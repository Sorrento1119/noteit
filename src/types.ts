export interface NoteData {
  id: string;
  title: string;
  content: string; // HTML content formatted by editor
  hasPassword: boolean;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface NoteVerificationResult {
  success: boolean;
  note?: NoteData;
  error?: string;
  requiresPassword?: boolean;
}

export type WebSocketClientMessage =
  | { type: 'join'; noteId: string; password?: string; clientName?: string }
  | { type: 'edit'; noteId: string; title: string; content: string; version: number }
  | { type: 'ping' };

export type WebSocketServerMessage =
  | { type: 'init'; note: NoteData; clientCount: number }
  | { type: 'edit'; noteId: string; title: string; content: string; version: number; senderId: string }
  | { type: 'presence'; clientCount: number }
  | { type: 'error'; message: string; code?: string }
  | { type: 'pong' };
