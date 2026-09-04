import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { app, notesStore, saveNotes, sanitizeNote, hashPassword, StoredNote } from './api/app';

const PORT = 3000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

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
