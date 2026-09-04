import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export interface StoredNote {
  id: string;
  title: string;
  content: string;
  hasPassword: boolean;
  passwordHash?: string;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export const app = express();

// CORS middleware allowing cross-domain / custom-domain requests
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Support JSON payloads up to 50mb for embedded images and rich content
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Express JSON body-parser error handler to prevent HTML 400 responses
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err) {
    console.error('Request parsing error:', err.message || err);
    if (err.type === 'entity.too.large') {
      res.status(413).json({ success: false, message: 'Payload too large. Please reduce image or note size.' });
      return;
    }
    res.status(400).json({ success: false, message: err.message || 'Invalid request body' });
    return;
  }
  next();
});

// Safe paths for storage across local Node and Vercel / serverless environments
const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

const DATA_DIR = isServerless ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data');
const UPLOADS_DIR = isServerless ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'public', 'uploads');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('DATA_DIR creation notice:', err);
}

try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('UPLOADS_DIR creation notice:', err);
}

// Serve uploaded media statically if directory exists
app.use('/uploads', express.static(UPLOADS_DIR));

const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
export const notesStore = new Map<string, StoredNote>();

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function sanitizeNote(note: StoredNote) {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    hasPassword: note.hasPassword,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    version: note.version,
  };
}

// Load persisted notes safely
export function loadNotes() {
  try {
    const seedFile = path.join(process.cwd(), 'data', 'notes.json');

    // First, load from target storage file if it exists
    if (fs.existsSync(NOTES_FILE)) {
      const data = fs.readFileSync(NOTES_FILE, 'utf-8');
      const parsed: Record<string, StoredNote> = JSON.parse(data);
      for (const [key, note] of Object.entries(parsed)) {
        notesStore.set(key.toLowerCase(), note);
      }
    }

    // Also load from repository seed file if not yet in store
    if (fs.existsSync(seedFile)) {
      try {
        const seedData = fs.readFileSync(seedFile, 'utf-8');
        const parsedSeed: Record<string, StoredNote> = JSON.parse(seedData);
        for (const [key, note] of Object.entries(parsedSeed)) {
          if (!notesStore.has(key.toLowerCase())) {
            notesStore.set(key.toLowerCase(), note);
          }
        }
      } catch (seedErr) {
        console.warn('Could not parse seed notes:', seedErr);
      }
    }

    // Seed default example note if completely empty
    if (notesStore.size === 0) {
      const sampleId = 'wopl';
      notesStore.set(sampleId, {
        id: sampleId,
        title: 'Welcome to note it.',
        content: `<h2>Collaborative Real-Time Notepad</h2><p>This is a live note accessible at <strong>/${sampleId}</strong> on any connected domain. You can open this exact link from your phone, laptop, or any other browser window to see live real-time synchronization in action!</p><ul><li>✏️ Format text with bold, italics, headings, checklists</li><li>🖼️ Paste or upload images seamlessly</li><li>🔒 Protect sensitive notes with a password</li><li>⚡ Instant 4-letter shareable URLs</li></ul><p>Start typing or delete this text to test!</p>`,
        hasPassword: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      });
      saveNotes();
    }
  } catch (err) {
    console.error('Failed to load notes:', err);
  }
}

let saveTimeout: NodeJS.Timeout | null = null;
export function saveNotes() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const obj: Record<string, StoredNote> = {};
      notesStore.forEach((value, key) => {
        obj[key] = value;
      });
      fs.writeFileSync(NOTES_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to save notes to disk (in-memory state preserved):', err);
    }
  }, 300);
}

loadNotes();

// REST API Handlers

// Health check
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', notesCount: notesStore.size });
});

// Check slug availability
const handleCheckSlug = (req: express.Request, res: express.Response) => {
  const raw = (req.params.id || (req.query.slug as string) || (req.query.id as string) || '').trim().toLowerCase();
  const id = raw.replace(/[^a-z0-9-_]/g, '');
  if (!id) {
    res.json({ id: '', available: false });
    return;
  }
  const exists = notesStore.has(id);
  res.json({ id, available: !exists });
};

app.get(['/api/check-slug/:id', '/check-slug/:id'], handleCheckSlug);
app.get(['/api/check-slug', '/check-slug'], handleCheckSlug);

// Get note by ID
const handleGetNote = (req: express.Request, res: express.Response) => {
  const raw = (req.params.id || (req.query.id as string) || '').trim().toLowerCase();
  const id = raw.replace(/[^a-z0-9-_]/g, '');
  const note = notesStore.get(id);

  if (!note) {
    res.status(404).json({ exists: false, message: 'Note not found' });
    return;
  }

  if (note.hasPassword) {
    res.json({
      exists: true,
      hasPassword: true,
      id: note.id,
      title: note.title || 'Untitled Note',
      updatedAt: note.updatedAt,
    });
    return;
  }

  res.json({
    exists: true,
    hasPassword: false,
    note: sanitizeNote(note),
  });
};

app.get(['/api/notes/:id', '/api/note/:id', '/notes/:id', '/note/:id'], handleGetNote);

// Root /api/notes info
app.get(['/api/notes', '/notes'], (req, res) => {
  res.json({ success: true, count: notesStore.size });
});

// Password verification for protected notes
const handleVerifyNote = (req: express.Request, res: express.Response) => {
  const raw = (req.params.id || req.body.id || '').trim().toLowerCase();
  const id = raw.replace(/[^a-z0-9-_]/g, '');
  const { password } = req.body;
  const note = notesStore.get(id);

  if (!note) {
    res.status(404).json({ success: false, message: 'Note not found' });
    return;
  }

  if (!note.hasPassword) {
    res.json({ success: true, note: sanitizeNote(note) });
    return;
  }

  if (!password || hashPassword(password) !== note.passwordHash) {
    res.status(401).json({ success: false, message: 'Incorrect password' });
    return;
  }

  res.json({ success: true, note: sanitizeNote(note) });
};

app.post(
  [
    '/api/notes/:id/verify',
    '/api/note/:id/verify',
    '/api/notes/verify',
    '/notes/:id/verify',
    '/note/:id/verify',
    '/notes/verify',
  ],
  handleVerifyNote
);

// Create or update note
const handleCreateOrUpdateNote = (req: express.Request, res: express.Response) => {
  const rawId = req.body.id || req.params.id || (req.query.id as string);
  const { title = 'Untitled Note', content = '', password, overwrite } = req.body;

  if (!rawId || typeof rawId !== 'string') {
    res.status(400).json({ success: false, message: 'Valid note ID is required' });
    return;
  }

  const id = rawId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
  if (!id || id.length < 2) {
    res.status(400).json({ success: false, message: 'ID must be at least 2 characters (alphanumeric)' });
    return;
  }

  const existing = notesStore.get(id);
  if (existing) {
    const isUpdateRequest = Boolean(overwrite || req.method === 'PUT' || req.params.id);
    if (isUpdateRequest) {
      if (existing.hasPassword && password && hashPassword(password) !== existing.passwordHash) {
        res.status(401).json({ success: false, message: 'Incorrect password for existing note' });
        return;
      }
      if (typeof title === 'string' && title.trim()) {
        existing.title = title.trim();
      }
      if (typeof content === 'string') {
        existing.content = content;
      }
      existing.updatedAt = Date.now();
      existing.version = (existing.version || 1) + 1;
      saveNotes();

      res.json({
        success: true,
        note: sanitizeNote(existing),
        updated: true,
      });
      return;
    }

    res.status(409).json({ success: false, message: `The path "/${id}" is already taken. Please choose another.` });
    return;
  }

  const hasPassword = Boolean(password && password.trim().length > 0);
  const newNote: StoredNote = {
    id,
    title: typeof title === 'string' && title.trim() ? title.trim() : 'Untitled Note',
    content: typeof content === 'string' ? content : '',
    hasPassword,
    passwordHash: hasPassword ? hashPassword(password.trim()) : undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  };

  notesStore.set(id, newNote);
  saveNotes();

  res.json({
    success: true,
    note: sanitizeNote(newNote),
  });
};

app.post(
  ['/api/notes', '/notes', '/api/notes/:id', '/notes/:id', '/api/note', '/note', '/api/note/:id', '/note/:id'],
  handleCreateOrUpdateNote
);
app.put(['/api/notes/:id', '/notes/:id', '/api/notes', '/notes'], handleCreateOrUpdateNote);

// Image upload API
app.post(['/api/upload', '/upload'], (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) {
    res.status(400).json({ success: false, message: 'No image data provided' });
    return;
  }

  try {
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      res.json({ success: true, url: imageBase64 });
      return;
    }

    const ext = matches[1].split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    const buffer = Buffer.from(matches[2], 'base64');
    const safeName = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    fs.writeFileSync(filePath, buffer);

    res.json({
      success: true,
      url: `/uploads/${safeName}`,
    });
  } catch (err) {
    // Return base64 directly on serverless/read-only filesystem
    res.json({
      success: true,
      url: imageBase64,
    });
  }
});

export default app;
