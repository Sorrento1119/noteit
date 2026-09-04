import { useEffect, useRef, useState, useCallback } from 'react';
import { NoteData, WebSocketClientMessage, WebSocketServerMessage } from '../types';
import { getDynamicWebSocketUrl } from '../utils/domain';

interface UseNoteSocketOptions {
  noteId: string;
  password?: string;
  onRemoteUpdate?: (title: string, content: string, version: number) => void;
  onError?: (err: string, code?: string) => void;
}

export function useNoteSocket({ noteId, password, onRemoteUpdate, onError }: UseNoteSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(1);
  const [isSyncing, setIsSyncing] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!noteId) return;

    // Dynamically build ws protocol and address matching the active domain
    const wsUrl = getDynamicWebSocketUrl();

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        // Join room for this note
        const joinMsg: WebSocketClientMessage = {
          type: 'join',
          noteId,
          password,
        };
        socket.send(JSON.stringify(joinMsg));
      };

      socket.onmessage = (event) => {
        try {
          const msg: WebSocketServerMessage = JSON.parse(event.data);
          if (msg.type === 'init') {
            setPeerCount(msg.clientCount || 1);
            if (onRemoteUpdate) {
              onRemoteUpdate(msg.note.title, msg.note.content, msg.note.version);
            }
          } else if (msg.type === 'edit') {
            setIsSyncing(true);
            if (onRemoteUpdate) {
              onRemoteUpdate(msg.title, msg.content, msg.version);
            }
            setTimeout(() => setIsSyncing(false), 400);
          } else if (msg.type === 'presence') {
            setPeerCount(msg.clientCount);
          } else if (msg.type === 'error') {
            if (onError) {
              onError(msg.message, msg.code);
            }
          }
        } catch (err) {
          console.error('Socket message parse error:', err);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        // Auto-reconnect after 2.5 seconds
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2500);
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        socket.close();
      };
    } catch (err) {
      console.error('Failed to initiate WebSocket connection:', err);
    }
  }, [noteId, password, onRemoteUpdate, onError]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const broadcastEdit = useCallback((title: string, content: string, version: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsSyncing(true);
      const msg: WebSocketClientMessage = {
        type: 'edit',
        noteId,
        title,
        content,
        version,
      };
      wsRef.current.send(JSON.stringify(msg));
      setTimeout(() => setIsSyncing(false), 300);
    }
  }, [noteId]);

  return {
    isConnected,
    peerCount,
    isSyncing,
    broadcastEdit,
  };
}
