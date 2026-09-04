import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

interface StoredNote {
  id: string;
  title: string;
  content: string;
  hasPassword: boolean;
  passwordHash?: string;
  createdAt: number;
  updatedAt: number;
  version: number;
}

const PORT = 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

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

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded media
app.use('/uploads', express.static(UPLOADS_DIR));

const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const notesStore = new Map<string, StoredNote>();

// Load persisted notes
function loadNotes() {
  try {
    if (fs.existsSync(NOTES_FILE)) {
      const data = fs.readFileSync(NOTES_FILE, 'utf-8');
      const parsed: Record<string, StoredNote> = JSON.parse(data);
      for (const [key, note] of Object.entries(parsed)) {
        notesStore.set(key.toLowerCase(), note);
      }
      console.log(`Loaded ${notesStore.size} notes from storage.`);
    } else {
      // Seed an example note for demo
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
    console.error('Failed to load notes from disk:', err);
  }
}

let saveTimeout: NodeJS.Timeout | null = null;
function saveNotes() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const obj: Record<string, StoredNote> = {};
      notesStore.forEach((value, key) => {
        obj[key] = value;
      });
      fs.writeFileSync(NOTES_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save notes to disk:', err);
    }
  }, 300);
}

loadNotes();

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function sanitizeNote(note: StoredNote) {
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

// REST APIs
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

app.get('/api/check-slug/:id', handleCheckSlug);
app.get('/api/check-slug', handleCheckSlug);

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

app.get('/api/notes/:id', handleGetNote);
app.get('/api/note/:id', handleGetNote);

// Root /api/notes info
app.get('/api/notes', (req, res) => {
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

app.post('/api/notes/:id/verify', handleVerifyNote);
app.post('/api/note/:id/verify', handleVerifyNote);
app.post('/api/notes/verify', handleVerifyNote);

// Create or update note (supports POST /api/notes, POST /api/notes/:id, PUT /api/notes/:id, etc.)
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
    // If overwrite is requested, or it's a PUT / direct path update
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
    title: (typeof title === 'string' && title.trim()) ? title.trim() : 'Untitled Note',
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

app.post('/api/notes', handleCreateOrUpdateNote);
app.post('/api/notes/:id', handleCreateOrUpdateNote);
app.post('/api/note', handleCreateOrUpdateNote);
app.post('/api/note/:id', handleCreateOrUpdateNote);
app.put('/api/notes/:id', handleCreateOrUpdateNote);
app.put('/api/notes', handleCreateOrUpdateNote);

// Image upload API
app.post('/api/upload', (req, res) => {
  const { imageBase64, filename } = req.body;
  if (!imageBase64) {
    res.status(400).json({ success: false, message: 'No image data provided' });
    return;
  }

  try {
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      // If raw data or URL, return directly
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
    console.error('Upload failed:', err);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// WebSocket Real-time collaboration
interface ClientState {
  ws: WebSocket;
  clientId: string;
  noteId?: string;
  isAuthorized: boolean;
  lastPing: number;
}

const clients = new Map<WebSocket, ClientState>();
const rooms = new Map<string, Set<WebSocket>>();

function broadcastToRoom(noteId: string, message: any, excludeWs?: WebSocket) {
  const room = rooms.get(noteId);
  if (!room) return;
  const payload = JSON.stringify(message);
  for (const clientWs of room) {
    if (clientWs !== excludeWs && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(payload);
    }
  }
}

function broadcastPresence(noteId: string) {
  const room = rooms.get(noteId);
  const count = room ? room.size : 0;
  broadcastToRoom(noteId, {
    type: 'presence',
    clientCount: count,
  });
}

wss.on('connection', (ws: WebSocket) => {
  const clientId = crypto.randomBytes(6).toString('hex');
  const clientState: ClientState = {
    ws,
    clientId,
    isAuthorized: false,
    lastPing: Date.now(),
  };
  clients.set(ws, clientState);

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === 'ping') {
        clientState.lastPing = Date.now();
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (data.type === 'join') {
        const noteId = (data.noteId || '').trim().toLowerCase();
        const note = notesStore.get(noteId);

        if (!note) {
          ws.send(JSON.stringify({ type: 'error', message: 'Note does not exist' }));
          return;
        }

        if (note.hasPassword) {
          const providedPassword = data.password || '';
          if (hashPassword(providedPassword) !== note.passwordHash) {
            ws.send(JSON.stringify({ type: 'error', code: 'UNAUTHORIZED', message: 'Password required' }));
            return;
          }
        }

        // Leave previous room if any
        if (clientState.noteId && rooms.has(clientState.noteId)) {
          rooms.get(clientState.noteId)!.delete(ws);
          broadcastPresence(clientState.noteId);
        }

        clientState.noteId = noteId;
        clientState.isAuthorized = true;

        if (!rooms.has(noteId)) {
          rooms.set(noteId, new Set());
        }
        rooms.get(noteId)!.add(ws);

        // Send current authoritative state to the newly joined client
        ws.send(
          JSON.stringify({
            type: 'init',
            note: sanitizeNote(note),
            clientCount: rooms.get(noteId)!.size,
          })
        );

        // Update presence for everyone in room
        broadcastPresence(noteId);
        return;
      }

      if (data.type === 'edit') {
        const noteId = clientState.noteId;
        if (!noteId || !clientState.isAuthorized) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not authorized for this note' }));
          return;
        }

        const note = notesStore.get(noteId);
        if (!note) return;

        // Apply edits (Last-Write-Wins / delta updates)
        if (typeof data.title === 'string') {
          note.title = data.title;
        }
        if (typeof data.content === 'string') {
          note.content = data.content;
        }
        note.updatedAt = Date.now();
        note.version = (note.version || 0) + 1;

        saveNotes();

        // Broadcast to all other peers in the room
        broadcastToRoom(
          noteId,
          {
            type: 'edit',
            noteId,
            title: note.title,
            content: note.content,
            version: note.version,
            senderId: clientState.clientId,
          },
          ws
        );
      }
    } catch (err) {
      console.error('WS message error:', err);
    }
  });

  ws.on('close', () => {
    if (clientState.noteId && rooms.has(clientState.noteId)) {
      rooms.get(clientState.noteId)!.delete(ws);
      broadcastPresence(clientState.noteId);
      if (rooms.get(clientState.noteId)!.size === 0) {
        rooms.delete(clientState.noteId);
      }
    }
    clients.delete(ws);
  });
});

// Periodic heartbeat
const pingInterval = setInterval(() => {
  const now = Date.now();
  for (const [ws, state] of clients.entries()) {
    if (now - state.lastPing > 45000) {
      ws.terminate();
      clients.delete(ws);
    } else {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }
  }
}, 25000);

wss.on('close', () => {
  clearInterval(pingInterval);
});

// Setup Vite middleware for dev / static for prod
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
