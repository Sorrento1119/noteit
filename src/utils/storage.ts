import { NoteData } from '../types';

const STORAGE_KEY = 'noteit_local_notes';
const PASSWORD_CACHE_KEY = 'noteit_passwords';

interface StoredLocalRecord {
  note: NoteData;
  password?: string;
}

function getStore(): Record<string, StoredLocalRecord> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setStore(store: Record<string, StoredLocalRecord>): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('Could not persist to localStorage:', err);
  }
}

export function getLocalNote(id: string): NoteData | null {
  if (!id) return null;
  const store = getStore();
  const record = store[id.toLowerCase()];
  return record ? record.note : null;
}

export function saveLocalNote(note: NoteData, password?: string): void {
  if (!note || !note.id) return;
  const store = getStore();
  const cleanId = note.id.toLowerCase();
  const existing = store[cleanId];
  
  store[cleanId] = {
    note: {
      ...note,
      updatedAt: Date.now(),
    },
    password: password !== undefined ? password : existing?.password,
  };
  setStore(store);
}

export function getSavedPassword(id: string): string | undefined {
  if (!id) return undefined;
  const store = getStore();
  return store[id.toLowerCase()]?.password;
}

export function deleteLocalNote(id: string): void {
  if (!id) return;
  const store = getStore();
  const cleanId = id.toLowerCase();
  delete store[cleanId];
  setStore(store);
}

export function verifyLocalPassword(id: string, pwd: string): boolean {
  if (!id) return false;
  const store = getStore();
  const record = store[id.toLowerCase()];
  if (!record) return false;
  if (!record.note.hasPassword) return true;
  return record.password === pwd;
}

// Compact portable URL payload for instant zero-config cross-device sharing
export function encodeNotePayload(note: NoteData): string {
  try {
    const mini = {
      i: note.id,
      t: note.title,
      c: note.content,
      p: note.hasPassword ? 1 : 0,
      u: note.updatedAt || Date.now(),
      v: note.version || 1,
    };
    const json = JSON.stringify(mini);
    const encoded = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return encoded;
  } catch (err) {
    console.warn('Failed to encode note payload:', err);
    return '';
  }
}

export function decodeNotePayload(payload: string): NoteData | null {
  if (!payload || typeof payload !== 'string') return null;
  try {
    let base64 = payload.trim().replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const json = decodeURIComponent(escape(atob(base64)));
    const parsed = JSON.parse(json);
    if (!parsed || !parsed.i) return null;
    return {
      id: String(parsed.i).toLowerCase(),
      title: parsed.t || 'Untitled Note',
      content: parsed.c || '',
      hasPassword: Boolean(parsed.p),
      createdAt: parsed.u || Date.now(),
      updatedAt: parsed.u || Date.now(),
      version: parsed.v || 1,
    };
  } catch (err) {
    console.warn('Failed to decode note payload:', err);
    return null;
  }
}

