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

export function verifyLocalPassword(id: string, pwd: string): boolean {
  if (!id) return false;
  const store = getStore();
  const record = store[id.toLowerCase()];
  if (!record) return false;
  if (!record.note.hasPassword) return true;
  return record.password === pwd;
}
