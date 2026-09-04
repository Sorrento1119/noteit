import React, { useState } from 'react';
import { Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

interface PasswordPromptProps {
  noteId: string;
  onUnlock: (password: string) => Promise<boolean>;
  onCancel?: () => void;
}

export const PasswordPrompt: React.FC<PasswordPromptProps> = ({ noteId, onUnlock, onCancel }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the password');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const success = await onUnlock(password.trim());
      if (!success) {
        setError('Incorrect password. Please try again.');
      }
    } catch {
      setError('Failed to verify password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-neutral-200 shadow-xl p-6 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-800 border border-neutral-200">
          <Lock className="w-5 h-5" />
        </div>

        <div>
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-neutral-900 text-white tracking-wide">
            /{noteId}
          </span>
          <h2 className="text-xl font-bold text-neutral-900 mt-2">Password Protected</h2>
          <p className="text-xs text-neutral-500 mt-1">
            This note requires a password to view and collaborate.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-left">
            <input
              type="password"
              id="protected-note-password-input"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              autoFocus
              placeholder="Enter note password..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all font-mono"
            />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 justify-center">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            id="protected-note-unlock-btn"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold tracking-wide shadow-xs active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Unlock Note</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {onCancel && (
            <button
              type="button"
              id="protected-note-cancel-btn"
              onClick={onCancel}
              className="text-xs text-neutral-400 hover:text-neutral-700 underline transition-colors"
            >
              Back to landing page
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
