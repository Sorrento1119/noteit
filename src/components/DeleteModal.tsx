import React, { useState } from 'react';
import { Trash2, AlertTriangle, Lock, X } from 'lucide-react';

interface DeleteModalProps {
  noteId: string;
  hasPassword?: boolean;
  isDeleting: boolean;
  error?: string | null;
  onConfirm: (password?: string) => void;
  onClose: () => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  noteId,
  hasPassword = false,
  isDeleting,
  error,
  onConfirm,
  onClose,
}) => {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(password.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-red-50/60">
          <div className="flex items-center gap-2 text-red-600">
            <Trash2 className="w-5 h-5" />
            <h3 className="text-sm font-bold text-neutral-900 tracking-tight">Delete Note</h3>
          </div>
          <button
            type="button"
            id="delete-modal-close"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-red-100 text-red-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                Are you sure you want to delete <span className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-800">/{noteId}</span>?
              </p>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                This note will be permanently erased. Other devices and viewers will no longer be able to access it.
              </p>
            </div>
          </div>

          {hasPassword && (
            <div className="pt-2">
              <label className="block text-xs font-semibold text-neutral-600 mb-1 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Enter note password to confirm deletion</span>
              </label>
              <input
                type="password"
                id="delete-note-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Note password"
                className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 font-mono"
                required
                autoFocus
              />
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              id="delete-modal-cancel-btn"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="delete-modal-confirm-btn"
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Deleting...' : 'Permanently Delete'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
