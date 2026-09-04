import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Image as ImageIcon,
  Minus,
  RemoveFormatting,
  UploadCloud,
  Loader2,
} from 'lucide-react';

interface RichEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
}

export const RichEditor: React.FC<RichEditorProps> = ({
  content,
  onChange,
  readOnly = false,
  placeholder = 'Type anything here... Bold, headings, lists, or paste and drag images directly.',
  className = '',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const isInternalUpdateRef = useRef(false);

  // Sync incoming content from props into editor only if changed externally
  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    if (editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content || '';
      updateMetrics();
    }
  }, [content]);

  const updateMetrics = useCallback(() => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    setCharCount(text.trim().length);
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setWordCount(words);
  }, []);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    isInternalUpdateRef.current = true;
    const html = editorRef.current.innerHTML;
    onChange(html);
    updateMetrics();
  }, [onChange, updateMetrics]);

  // Execute standard formatting commands
  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (readOnly) return;
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      handleInput();
    }
  };

  // Upload or insert image
  const insertImage = (imageUrl: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const imgHtml = `<p><img src="${imageUrl}" alt="Uploaded image" class="rounded-lg max-w-full my-3 border border-neutral-200 shadow-xs max-h-[500px] object-contain" /></p><p><br></p>`;
    document.execCommand('insertHTML', false, imgHtml);
    handleInput();
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        try {
          // Attempt backend upload endpoint for persistent storage
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64, filename: file.name }),
          });
          const data = await res.json();
          if (data.success && data.url) {
            insertImage(data.url);
          } else {
            // Fallback to inline base64
            insertImage(base64);
          }
        } catch {
          // Fallback to inline base64 if network offline
          insertImage(base64);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag & drop handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (readOnly) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        processFile(file);
      }
    }
  };

  // Paste image directly from clipboard
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processFile(file);
          return;
        }
      }
    }
  };

  // Toggle interactive task checkboxes inside note
  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
      const cb = target as HTMLInputElement;
      if (cb.checked) {
        cb.setAttribute('checked', 'true');
      } else {
        cb.removeAttribute('checked');
      }
      handleInput();
    }
  };

  const insertChecklist = () => {
    const checklistHtml = `<p class="flex items-center gap-2 my-1"><input type="checkbox" class="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-0 cursor-pointer" /> <span>Task item</span></p>`;
    document.execCommand('insertHTML', false, checklistHtml);
    handleInput();
  };

  return (
    <div className={`flex flex-col bg-white border border-neutral-200/90 rounded-xl shadow-xs overflow-hidden ${className}`}>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        className="hidden"
      />

      {/* Modern Compact Formatting Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 bg-neutral-50/80 border-b border-neutral-200 text-neutral-700 text-sm select-none">
          {/* Headings */}
          <button
            type="button"
            id="editor-btn-h1"
            onClick={() => executeCommand('formatBlock', '<h1>')}
            title="Heading 1"
            className="p-1.5 rounded hover:bg-neutral-200/80 hover:text-neutral-900 active:bg-neutral-300 transition-colors font-bold text-xs"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            type="button"
            id="editor-btn-h2"
            onClick={() => executeCommand('formatBlock', '<h2>')}
            title="Heading 2"
            className="p-1.5 rounded hover:bg-neutral-200/80 hover:text-neutral-900 active:bg-neutral-300 transition-colors font-bold text-xs"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            id="editor-btn-h3"
            onClick={() => executeCommand('formatBlock', '<h3>')}
            title="Heading 3"
            className="p-1.5 rounded hover:bg-neutral-200/80 hover:text-neutral-900 active:bg-neutral-300 transition-colors text-xs"
          >
            <Heading3 className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-neutral-300 mx-1" />

          {/* Basic Inline Styles */}
          <button
            type="button"
            id="editor-btn-bold"
            onClick={() => executeCommand('bold')}
            title="Bold (Ctrl+B)"
            className="p-1.5 rounded hover:bg-neutral-200/80 hover:text-neutral-900 active:bg-neutral-300 transition-colors"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            id="editor-btn-italic"
            onClick={() => executeCommand('italic')}
            title="Italic (Ctrl+I)"
            className="p-1.5 rounded hover:bg-neutral-200/80 hover:text-neutral-900 active:bg-neutral-300 transition-colors"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            id="editor-btn-underline"
            onClick={() => executeCommand('underline')}
            title="Underline (Ctrl+U)"
            className="p-1.5 rounded hover:bg-neutral-200/80 hover:text-neutral-900 active:bg-neutral-300 transition-colors"
          >
            <Underline className="w-4 h-4" />
          </button>
          <button
            type="button"
            id="editor-btn-strike"
            onClick={() => executeCommand('strikeThrough')}
            title="Strikethrough"
            className="p-1.5 rounded hover:bg-neutral-200/80 hover:text-neutral-900 active:bg-neutral-300 transition-colors"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-neutral-300 mx-1" />

          {/* Lists & Blocks */}
          <button
            type="button"
            id="editor-btn-bullet"
            onClick={() => executeCommand('insertUnorderedList')}
            title="Bullet List"
            className="p-1.5 rounded hover:bg-neutral-200/80 hover:text-neutral-900 active:bg-neutral-300 transition-colors"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            id="editor-btn-ordered"
            onClick={() => executeCommand('insertOrderedList')}
            title="Numbered List"
            className="p-1.5 rounded hover:bg-neutral-200/80 hover:text-neutral-900 active:bg-neutral-300 transition-colors"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            id="editor-btn-checklist"
            onClick={insertChecklist}
            title="Task Checklist"
            className="p-1.5 rounded hover:bg-neutral-200/80 hover:text-neutral-900 active:bg-neutral-300 transition-colors"
          >
            <CheckSquare className="w-4 h-4" />
          </button>
          <button
            type="button"
            id="editor-btn-quote"
            onClick={() => executeCommand('formatBlock', '<blockquote>')}
            title="Quote"
            className="p-1.5 rounded hover:bg-neutral-200/80 hover:text-neutral-900 active:bg-neutral-300 transition-colors"
          >
            <Quote className="w-4 h-4" />
          </button>
          <button
            type="button"
            id="editor-btn-code"
            onClick={() => executeCommand('formatBlock', '<pre>')}
            title="Code Block"
            className="p-1.5 rounded hover:bg-neutral-200/80 hover:text-neutral-900 active:bg-neutral-300 transition-colors"
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            type="button"
            id="editor-btn-hr"
            onClick={() => executeCommand('insertHorizontalRule')}
            title="Horizontal Divider"
            className="p-1.5 rounded hover:bg-neutral-200/80 hover:text-neutral-900 active:bg-neutral-300 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-neutral-300 mx-1" />

          {/* Image Upload Button */}
          <button
            type="button"
            id="editor-btn-image"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Upload Image (or drag & drop)"
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-200/60 hover:bg-neutral-200 text-neutral-800 text-xs font-medium transition-colors"
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
            <span>Image</span>
          </button>

          <button
            type="button"
            id="editor-btn-clear"
            onClick={() => executeCommand('removeFormat')}
            title="Clear Formatting"
            className="p-1.5 ml-auto rounded hover:bg-neutral-200/80 text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            <RemoveFormatting className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editor Content Area */}
      <div
        className="relative flex-1 p-5 min-h-[300px] cursor-text focus-within:ring-0"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (editorRef.current && document.activeElement !== editorRef.current) {
            editorRef.current.focus();
          }
        }}
      >
        {/* Drag Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-neutral-900/10 backdrop-blur-xs border-2 border-dashed border-neutral-900 rounded-lg flex flex-col items-center justify-center text-neutral-900 z-20 pointer-events-none">
            <UploadCloud className="w-10 h-10 mb-2 animate-bounce" />
            <p className="font-semibold text-sm">Drop image here to embed</p>
          </div>
        )}

        <div
          ref={editorRef}
          id="rich-notepad-content"
          contentEditable={!readOnly}
          onInput={handleInput}
          onPaste={handlePaste}
          onClick={handleEditorClick}
          data-placeholder={placeholder}
          className="outline-none text-neutral-800 text-base leading-relaxed tracking-normal focus:ring-0 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mt-4 [&>h1]:mb-2 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mt-3 [&>h2]:mb-2 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:mt-2 [&>h3]:mb-1 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:my-2 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:my-2 [&>blockquote]:border-l-4 [&>blockquote]:border-neutral-300 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:my-3 [&>blockquote]:text-neutral-600 [&>pre]:bg-neutral-100 [&>pre]:p-3 [&>pre]:rounded-md [&>pre]:font-mono [&>pre]:text-sm [&>pre]:my-3 [&>hr]:my-4 [&>hr]:border-neutral-200"
        />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-neutral-50 border-t border-neutral-100 text-neutral-400 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span>{wordsCountText(wordCount)}</span>
          <span>•</span>
          <span>{charCount} chars</span>
        </div>
      </div>
    </div>
  );
};

function wordsCountText(count: number): string {
  return count === 1 ? '1 word' : `${count} words`;
}
