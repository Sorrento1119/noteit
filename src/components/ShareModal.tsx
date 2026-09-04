import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, ExternalLink, QrCode as QrIcon, X, Shield, Lock } from 'lucide-react';
import { getDynamicNoteUrl } from '../utils/domain';

interface ShareModalProps {
  noteId: string;
  hasPassword?: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ noteId, hasPassword = false, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const fullUrl = getDynamicNoteUrl(noteId);

  useEffect(() => {
    QRCode.toDataURL(fullUrl, {
      width: 280,
      margin: 1.5,
      color: {
        dark: '#171717',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code generation failed:', err));
  }, [fullUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50/70">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-neutral-900 text-white tracking-wide">
              /{noteId}
            </span>
            <h3 className="text-sm font-bold text-neutral-800 tracking-tight">Share & Connect Devices</h3>
          </div>
          <button
            type="button"
            id="share-modal-close"
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Quick link box */}
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
              Live Note URL
            </label>
            <div className="flex items-center gap-2 p-1.5 bg-neutral-100/90 border border-neutral-200 rounded-lg">
              <input
                type="text"
                readOnly
                value={fullUrl}
                className="flex-1 bg-transparent px-2.5 py-1 text-xs sm:text-sm font-mono text-neutral-800 outline-none select-all"
              />
              <button
                type="button"
                id="share-modal-copy-btn"
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* QR Code section for instant mobile scanning */}
          <div className="flex flex-col items-center justify-center p-4 bg-neutral-50 rounded-xl border border-neutral-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600 mb-3">
              <QrIcon className="w-4 h-4" />
              <span>Scan with phone camera to open instantly</span>
            </div>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for ${fullUrl}`}
                className="w-44 h-44 rounded-lg border border-neutral-200 shadow-xs"
              />
            ) : (
              <div className="w-44 h-44 flex items-center justify-center bg-neutral-200/50 rounded-lg animate-pulse" />
            )}
            <p className="text-[11px] text-neutral-400 mt-2 text-center font-mono">
              Changes sync in real-time between devices via WebSocket
            </p>
          </div>

          {/* Password info notice */}
          {hasPassword && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-900 text-xs">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>This note is password protected. Other devices must enter your password to view.</span>
            </div>
          )}

          {/* Test multi-device action */}
          <div className="flex gap-2">
            <a
              href={`/${noteId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 text-xs font-semibold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Second Tab to Test Live Sync</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
