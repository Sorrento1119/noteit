import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Lock,
  Share2,
  Copy,
  Check,
  RefreshCw,
  Plus,
  ArrowRight,
  ExternalLink,
  Users,
  FileText,
} from 'lucide-react';
import { RichEditor } from './components/RichEditor';
import { GlobeBackground } from './components/GlobeBackground';
import { ShareModal } from './components/ShareModal';
import { PasswordPrompt } from './components/PasswordPrompt';
import { generate4LetterWord, cleanSlug } from './utils/words';
import { getDynamicHost, getDynamicOrigin, getDynamicNoteUrl } from './utils/domain';
import { getLocalNote, saveLocalNote, verifyLocalPassword } from './utils/storage';
import { useNoteSocket } from './hooks/useNoteSocket';
import { NoteData } from './types';

export default function App() {
  // Dynamic host and origin for custom domains
  const [dynamicHost, setDynamicHost] = useState<string>(() => getDynamicHost());
  const [dynamicOrigin, setDynamicOrigin] = useState<string>(() => getDynamicOrigin());

  useEffect(() => {
    setDynamicHost(getDynamicHost());
    setDynamicOrigin(getDynamicOrigin());
  }, []);

  // Routing state based on window.location.pathname
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const p = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    return p;
  });

  // Landing Page state
  const [draftTitle, setDraftTitle] = useState('Untitled Note');
  const [draftContent, setDraftContent] = useState('');
  const [customSlug, setCustomSlug] = useState(() => generate4LetterWord());
  const [isSlugAvailable, setIsSlugAvailable] = useState<boolean | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [enablePassword, setEnablePassword] = useState(false);
  const [draftPassword, setDraftPassword] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  // Active Note state (when viewing /{slug})
  const [activeNote, setActiveNote] = useState<NoteData | null>(null);
  const [isLoadingNote, setIsLoadingNote] = useState(false);
  const [noteNotFound, setNoteNotFound] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [unlockedPassword, setUnlockedPassword] = useState<string | undefined>(undefined);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Listen to browser navigation popstate
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
      setCurrentPath(p);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update browser URL
  const navigateTo = (slug: string, preserveSlug?: string) => {
    const targetUrl = slug ? `/${slug}` : '/';
    try {
      window.history.pushState(null, '', targetUrl);
    } catch (err) {
      console.warn('history.pushState unavailable (e.g. sandboxed iframe):', err);
    }
    const cleaned = slug.toLowerCase();
    setCurrentPath(cleaned);
    if (!cleaned) {
      setCustomSlug(preserveSlug || generate4LetterWord());
      setDraftTitle('Untitled Note');
      setDraftContent('');
      setEnablePassword(false);
      setDraftPassword('');
      setSlugError(null);
      setActiveNote(null);
      setIsLocked(false);
    }
  };

  // Check slug availability on landing page
  const checkSlugAvailability = useCallback(async (slug: string) => {
    if (!slug || slug.length < 2) {
      setIsSlugAvailable(false);
      setSlugError('Path must be at least 2 characters');
      return;
    }
    setIsCheckingSlug(true);
    setSlugError(null);
    try {
      const res = await fetch(`/api/check-slug/${encodeURIComponent(slug)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setIsSlugAvailable(data.available);
        if (!data.available) {
          setSlugError(`"/${slug}" is already taken`);
        }
      } else {
        // If API returned 404 or non-ok, check local storage
        const local = getLocalNote(slug);
        setIsSlugAvailable(!local);
        if (local) {
          setSlugError(`"/${slug}" is already taken`);
        }
      }
    } catch {
      const local = getLocalNote(slug);
      setIsSlugAvailable(!local);
      if (local) {
        setSlugError(`"/${slug}" is already taken`);
      }
    } finally {
      setIsCheckingSlug(false);
    }
  }, []);

  useEffect(() => {
    if (!currentPath && customSlug) {
      const timeout = setTimeout(() => {
        checkSlugAvailability(customSlug);
      }, 250);
      return () => clearTimeout(timeout);
    }
  }, [customSlug, currentPath, checkSlugAvailability]);

  // Regenerate random 4-letter word
  const handleRegenerateWord = () => {
    const newWord = generate4LetterWord();
    setCustomSlug(newWord);
  };

  // Load note data when route changes to a slug
  const fetchNote = useCallback(async (slug: string, pwd?: string) => {
    setIsLoadingNote(true);
    setNoteNotFound(false);
    setIsLocked(false);

    let backendFound = false;
    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(slug)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        backendFound = true;
        if (data.hasPassword && !pwd) {
          setIsLocked(true);
          setActiveNote(null);
          return;
        }

        // If unlocked or public
        if (data.note) {
          saveLocalNote(data.note, pwd);
          setActiveNote(data.note);
          setIsLocked(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Backend note fetch notice:', err);
    } finally {
      setIsLoadingNote(false);
    }

    // Fallback to local storage if not found in backend or offline
    const local = getLocalNote(slug);
    if (local) {
      if (local.hasPassword && !pwd) {
        setIsLocked(true);
        setActiveNote(null);
        return;
      }
      setActiveNote(local);
      setIsLocked(false);
      return;
    }

    if (!backendFound) {
      setNoteNotFound(true);
      setActiveNote(null);
    }
  }, []);

  useEffect(() => {
    if (currentPath) {
      fetchNote(currentPath, unlockedPassword);
    } else {
      setActiveNote(null);
      setNoteNotFound(false);
      setIsLocked(false);
    }
  }, [currentPath, unlockedPassword, fetchNote]);

  // Real-time WebSocket connection for active note
  const lastBroadcastRef = useRef<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveHttpTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleRemoteUpdate = useCallback((newTitle: string, newContent: string, version: number) => {
    setActiveNote((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        title: newTitle,
        content: newContent,
        version,
        updatedAt: Date.now(),
      };
    });
  }, []);

  const handleSocketError = useCallback((errMessage: string, code?: string) => {
    if (code === 'UNAUTHORIZED') {
      setIsLocked(true);
    }
  }, []);

  const { isConnected, peerCount, isSyncing, broadcastEdit } = useNoteSocket({
    noteId: currentPath,
    password: unlockedPassword,
    onRemoteUpdate: handleRemoteUpdate,
    onError: handleSocketError,
  });

  // Helper to persist edits both locally and via HTTP PUT (for serverless environments)
  const persistNoteChanges = useCallback(
    (title: string, content: string, version: number) => {
      if (!activeNote) return;
      // 1. Cache immediately in browser localStorage
      saveLocalNote(
        {
          ...activeNote,
          title,
          content,
          version,
          updatedAt: Date.now(),
        },
        unlockedPassword
      );

      // 2. Debounce HTTP PUT request to backend
      if (saveHttpTimerRef.current) clearTimeout(saveHttpTimerRef.current);
      saveHttpTimerRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/notes/${encodeURIComponent(activeNote.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              id: activeNote.id,
              title,
              content,
              password: unlockedPassword,
              overwrite: true,
            }),
          });
        } catch {
          // In-memory / local storage copy is already safe
        }
      }, 500);
    },
    [activeNote, unlockedPassword]
  );

  // Dispatch local changes through WebSocket & HTTP with debouncing
  const handleEditorChange = (newContent: string) => {
    if (!activeNote) return;
    const newVersion = (activeNote.version || 0) + 1;
    setActiveNote((prev) => (prev ? { ...prev, content: newContent, version: newVersion } : null));

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      broadcastEdit(activeNote.title, newContent, newVersion);
      lastBroadcastRef.current = Date.now();
    }, 150);

    persistNoteChanges(activeNote.title, newContent, newVersion);
  };

  const handleTitleChange = (newTitle: string) => {
    if (!activeNote) return;
    const newVersion = (activeNote.version || 0) + 1;
    setActiveNote((prev) => (prev ? { ...prev, title: newTitle, version: newVersion } : null));

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      broadcastEdit(newTitle, activeNote.content, newVersion);
    }, 200);

    persistNoteChanges(newTitle, activeNote.content, newVersion);
  };

  // Publish note from landing page modal
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSlug = cleanSlug(customSlug);
    if (!finalSlug || finalSlug.length < 2) {
      setSlugError('Path must be at least 2 characters');
      return;
    }

    if (isSlugAvailable === false) {
      setSlugError(`Path "/${finalSlug}" is already taken. Try another.`);
      return;
    }

    setIsPublishing(true);
    setSlugError(null);

    const payload = JSON.stringify({
      id: finalSlug,
      title: draftTitle.trim() || 'Untitled Note',
      content: draftContent,
      password: enablePassword && draftPassword ? draftPassword.trim() : undefined,
      overwrite: true,
    });

    try {
      let res: Response | null = null;
      const origin = getDynamicOrigin();
      // Candidate endpoints to handle custom domains, proxies, and path variations
      const endpoints = [
        '/api/notes',
        `/api/notes/${encodeURIComponent(finalSlug)}`,
        origin ? `${origin}/api/notes` : '',
        origin ? `${origin}/api/notes/${encodeURIComponent(finalSlug)}` : '',
      ].filter(Boolean);

      let lastStatus = 0;
      let lastErrorMessage = '';
      let data: any = null;

      for (const endpoint of endpoints) {
        try {
          const attemptRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: payload,
          });

          lastStatus = attemptRes.status;

          // If successful or non-404 error (e.g. 400 or 409)
          if (attemptRes.ok || (attemptRes.status !== 404 && attemptRes.status !== 502)) {
            res = attemptRes;
            try {
              data = await attemptRes.json();
            } catch (jsonErr) {
              console.warn('Failed parsing JSON response:', jsonErr);
            }
            break;
          }
        } catch (attemptErr) {
          console.warn(`Fetch to ${endpoint} failed:`, attemptErr);
        }
      }

      // If backend succeeded with note data
      if (res && res.ok && data?.success && data?.note) {
        if (enablePassword && draftPassword) {
          setUnlockedPassword(draftPassword.trim());
        }
        saveLocalNote(data.note, enablePassword ? draftPassword.trim() : undefined);
        setActiveNote(data.note);
        try {
          navigateTo(finalSlug);
        } catch {
          setCurrentPath(finalSlug);
        }
        setShowShareModal(true);
        return;
      }

      // If backend returned a specific non-404 business error (like 409 already taken or 400 invalid)
      if (res && !res.ok && data?.message && res.status !== 404) {
        setSlugError(data.message);
        setIsPublishing(false);
        return;
      }

      // Graceful fallback for serverless / static environments:
      // Create and save note locally so the user is never blocked with 404
      const fallbackNote: NoteData = {
        id: finalSlug,
        title: draftTitle.trim() || 'Untitled Note',
        content: draftContent,
        hasPassword: Boolean(enablePassword && draftPassword),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      saveLocalNote(fallbackNote, enablePassword ? draftPassword.trim() : undefined);

      if (enablePassword && draftPassword) {
        setUnlockedPassword(draftPassword.trim());
      }

      setActiveNote(fallbackNote);
      try {
        navigateTo(finalSlug);
      } catch {
        setCurrentPath(finalSlug);
      }
      setShowShareModal(true);
    } catch (err: any) {
      console.error('Publish error:', err);
      // Even on exception, guarantee local note creation
      const fallbackNote: NoteData = {
        id: finalSlug,
        title: draftTitle.trim() || 'Untitled Note',
        content: draftContent,
        hasPassword: Boolean(enablePassword && draftPassword),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      saveLocalNote(fallbackNote, enablePassword ? draftPassword.trim() : undefined);
      if (enablePassword && draftPassword) {
        setUnlockedPassword(draftPassword.trim());
      }
      setActiveNote(fallbackNote);
      try {
        navigateTo(finalSlug);
      } catch {
        setCurrentPath(finalSlug);
      }
      setShowShareModal(true);
    } finally {
      setIsPublishing(false);
    }
  };

  // Unlock password protected note
  const handleUnlockNote = async (pwd: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(currentPath)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: pwd }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUnlockedPassword(pwd);
          setActiveNote(data.note);
          saveLocalNote(data.note, pwd);
          setIsLocked(false);
          return true;
        }
      }
    } catch {
      // fallback to local verification
    }

    if (verifyLocalPassword(currentPath, pwd)) {
      const local = getLocalNote(currentPath);
      if (local) {
        setUnlockedPassword(pwd);
        setActiveNote(local);
        setIsLocked(false);
        return true;
      }
    }

    return false;
  };

  // Quick copy URL button
  const handleCopyCurrentUrl = () => {
    const url = getDynamicNoteUrl(currentPath);
    navigator.clipboard.writeText(url);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-neutral-900 relative font-sans flex flex-col selection:bg-neutral-900 selection:text-white">
      {/* Background Graphic */}
      <GlobeBackground />

      {/* Top Navigation Bar */}
      <header className="relative z-10 w-full border-b border-neutral-200/80 bg-[#F8F7F4]/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <button
            type="button"
            id="nav-brand-btn"
            onClick={() => navigateTo('')}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-sm tracking-tighter transition-transform group-hover:scale-105">
              n.
            </div>
            <span className="font-extrabold text-xl tracking-tight font-mono text-neutral-900">
              note it.
            </span>
          </button>

          {/* Active Note Controls in Header */}
          {currentPath && activeNote ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Live Presence indicator */}
              <div
                title={isConnected ? `${peerCount} active device(s)` : 'Reconnecting...'}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-white border border-neutral-200 text-neutral-700 shadow-2xs"
              >
                {isConnected ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="hidden sm:inline">Live</span>
                    <span className="text-neutral-400">({peerCount})</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="text-amber-600">Connecting</span>
                  </>
                )}
              </div>

              {/* Path copy badge */}
              <button
                type="button"
                id="header-path-copy"
                onClick={handleCopyCurrentUrl}
                className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200/80 border border-neutral-200/80 text-xs font-mono text-neutral-800 transition-colors cursor-pointer"
              >
                <span>/{currentPath}</span>
                {copiedNotification ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-neutral-400" />
                )}
              </button>

              {/* Share & QR button */}
              <button
                type="button"
                id="header-share-btn"
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer shadow-2xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Share & QR</span>
              </button>

              {/* New note button */}
              <button
                type="button"
                id="header-new-note-btn"
                onClick={() => navigateTo('')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New</span>
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col">
        {/* VIEW 1: LANDING PAGE */}
        {!currentPath && (
          <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-10 pb-16 flex flex-col items-center">
            {/* Centered dominant title: "note it." in large dominant font centered on top */}
            <div className="text-center mb-8 sm:mb-10">
              <h1 className="text-6xl sm:text-7xl md:text-8xl font-extrabold tracking-tight font-mono text-neutral-900 select-none">
                note it.
              </h1>
            </div>

            {/* Below that: A modal/card for the notepad where we can type, format, publish, and set custom path */}
            <div
              id="notepad-modal-container"
              className="w-full bg-white rounded-2xl border border-neutral-300 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
            >
              {/* Modal Top Bar */}
              <div className="px-5 py-3.5 bg-neutral-100/90 border-b border-neutral-200">
                {/* Note title in modal */}
                <input
                  type="text"
                  id="landing-draft-title-input"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Note Title (e.g. Project Ideas)"
                  className="bg-transparent font-bold text-base sm:text-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none w-full"
                />
              </div>

              {/* Rich Text Editor inside Modal */}
              <div className="p-4 sm:p-6 space-y-5">
                <RichEditor
                  content={draftContent}
                  onChange={setDraftContent}
                  placeholder="Start typing your note here... Use formatting, headings, bullet lists, or drag and drop images directly."
                />

                {/* Path Configuration & Password Settings Form */}
                <form onSubmit={handlePublish} className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 4-Letter Path Configuration */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                          Custom Path
                        </label>
                        <button
                          type="button"
                          id="regenerate-slug-btn"
                          onClick={handleRegenerateWord}
                          className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 font-mono transition-colors cursor-pointer"
                          title="Generate fresh random 4-letter word"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Random 4-letter</span>
                        </button>
                      </div>

                      <div className="flex items-center rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 focus-within:ring-2 focus-within:ring-neutral-900/10 focus-within:border-neutral-900 transition-all">
                        <span className="text-xs sm:text-sm font-mono text-neutral-400 select-none">
                          {dynamicHost ? `${dynamicHost}/` : '/'}
                        </span>
                        <input
                          type="text"
                          id="landing-custom-slug-input"
                          value={customSlug}
                          onChange={(e) => {
                            const val = cleanSlug(e.target.value);
                            setCustomSlug(val);
                            setSlugError(null);
                          }}
                          maxLength={24}
                          placeholder="wopl"
                          className="flex-1 bg-transparent font-mono font-bold text-xs sm:text-sm text-neutral-900 outline-none px-1"
                        />
                        {/* Status availability badge */}
                        <div className="text-xs font-mono shrink-0">
                          {isCheckingSlug ? (
                            <span className="text-neutral-400 animate-pulse">checking...</span>
                          ) : isSlugAvailable === true ? (
                            <span className="text-emerald-600 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Available</span>
                            </span>
                          ) : isSlugAvailable === false ? (
                            <span className="text-rose-600 font-semibold">Taken</span>
                          ) : null}
                        </div>
                      </div>

                      {slugError && (
                        <p className="text-[11px] text-rose-600 font-mono">{slugError}</p>
                      )}
                    </div>

                    {/* Optional Password Protection */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1">
                          <Lock className="w-3 h-3 text-neutral-500" />
                          <span>Password (Optional)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            id="enable-password-checkbox"
                            checked={enablePassword}
                            onChange={(e) => setEnablePassword(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-[11px] text-neutral-600">Enable</span>
                        </label>
                      </div>

                      {enablePassword ? (
                        <input
                          type="password"
                          id="landing-password-input"
                          value={draftPassword}
                          onChange={(e) => setDraftPassword(e.target.value)}
                          placeholder="Set view password..."
                          className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs sm:text-sm font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all"
                        />
                      ) : (
                        <div className="px-3 py-2 rounded-lg bg-neutral-100/60 border border-neutral-200 text-neutral-400 text-xs font-mono">
                          Public note (anyone with link can view & edit)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Publish CTA */}
                  <div className="pt-3 flex items-center justify-end border-t border-neutral-100">
                    <button
                      type="submit"
                      id="publish-note-btn"
                      disabled={isPublishing || isSlugAvailable === false}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 active:scale-98 text-white font-bold text-sm tracking-wider uppercase transition-all shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {isPublishing ? (
                        <span>Publishing...</span>
                      ) : (
                        <>
                          <span>▸ PUBLISH NOTE ◂</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: ACTIVE LIVE NOTE (/{slug}) */}
        {currentPath && (
          <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 flex flex-col">
            {isLoadingNote ? (
              <div className="flex-1 flex flex-col items-center justify-center py-24 text-neutral-400 space-y-3">
                <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono">Loading note /{currentPath}...</span>
              </div>
            ) : isLocked ? (
              <PasswordPrompt
                noteId={currentPath}
                onUnlock={handleUnlockNote}
                onCancel={() => navigateTo('')}
              />
            ) : noteNotFound ? (
              <div className="max-w-md mx-auto my-16 bg-white rounded-2xl border border-neutral-200 shadow-lg p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-500">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900">Note Not Found</h2>
                  <p className="text-xs text-neutral-500 mt-1 font-mono">
                    The note "/{currentPath}" does not exist yet.
                  </p>
                </div>
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    id="create-this-path-btn"
                    onClick={() => {
                      navigateTo('', currentPath);
                    }}
                    className="w-full py-2.5 px-4 rounded-lg bg-neutral-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors"
                  >
                    Create Note at /{currentPath}
                  </button>
                  <button
                    type="button"
                    id="back-home-btn"
                    onClick={() => navigateTo('')}
                    className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
                  >
                    Back to note it.
                  </button>
                </div>
              </div>
            ) : activeNote ? (
              <div className="flex-1 flex flex-col space-y-4 animate-in fade-in duration-200">
                {/* Note Meta Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 backdrop-blur-xs p-4 rounded-xl border border-neutral-200 shadow-2xs">
                  {/* Note Title Input */}
                  <div className="flex-1 min-w-[220px]">
                    <input
                      type="text"
                      id="active-note-title-input"
                      value={activeNote.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="Note Title"
                      className="w-full bg-transparent text-xl sm:text-2xl font-bold text-neutral-900 outline-none placeholder:text-neutral-300"
                    />
                  </div>

                  {/* Action Badges */}
                  <div className="flex items-center gap-2">
                    {activeNote.hasPassword && (
                      <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        <Lock className="w-3 h-3" />
                        <span>Protected</span>
                      </span>
                    )}

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-600 text-xs font-mono">
                      <Users className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{peerCount} connected</span>
                    </div>

                    {isSyncing && (
                      <span className="text-[11px] font-mono text-emerald-600 animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>Syncing</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Rich Live Collaborative Editor */}
                <div className="flex-1">
                  <RichEditor
                    content={activeNote.content}
                    onChange={handleEditorChange}
                    className="min-h-[480px] shadow-sm"
                  />
                </div>

                {/* Footer bar with quick copy & device sync reminder */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 font-mono pt-2">
                  <div className="flex items-center gap-2">
                    <span>Path:</span>
                    <button
                      type="button"
                      id="footer-copy-url-btn"
                      onClick={handleCopyCurrentUrl}
                      className="hover:text-neutral-900 underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{getDynamicNoteUrl(currentPath)}</span>
                      {copiedNotification ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    id="footer-open-qr-btn"
                    onClick={() => setShowShareModal(true)}
                    className="text-neutral-700 hover:text-neutral-900 font-semibold underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open on phone (Scan QR)</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>

      {/* Share Modal with QR code and URL copying */}
      {showShareModal && (
        <ShareModal
          noteId={currentPath || customSlug}
          hasPassword={activeNote?.hasPassword || (enablePassword && Boolean(draftPassword))}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
