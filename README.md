# note it.

A clean, real-time collaborative notepad with instant 4-letter shareable URLs, rich text formatting, inline image uploads, and optional password protection.

## Features

- **Instant 4-Letter URLs**: Quickly spin up a shareable note with a memorable 4-letter path (e.g., `/wopl`) or set your own custom slug.
- **Dynamic Domain Support**: Automatically adapts to whichever domain it is accessed from (custom domains, subdomains, reverse proxies, or localhost). URLs, QR codes, and WebSocket channels update dynamically with your connected domain.
- **Real-Time Collaboration**: Instant bidirectional synchronization across multiple devices, browsers, and screens via WebSockets with live presence indicators.
- **Rich Text Formatting**: Clean writing interface supporting headings, bullet lists, ordered lists, task checkboxes, blockquotes, code blocks, dividers, and undo/redo.
- **Inline Image Support**: Seamless drag-and-drop, paste from clipboard, or file picker upload for images.
- **Password Protection**: Optional SHA-256 password protection for private notes.
- **Mobile QR Sharing**: Built-in QR code generator in the share modal for opening notes on mobile devices instantly.

## Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide icons, Motion animations.
- **Backend**: Node.js, Express, WebSocket server (`ws`).
- **Data Persistence**: File-backed storage with automatic sync to disk in `data/notes.json`.

## Getting Started

### Prerequisites

- Node.js 18+ or Bun

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Production Build

```bash
# Build frontend and server bundles
npm run build

# Start production server
npm start
```

## Connecting a Custom Domain

The application is built to be domain-agnostic:

1. Point your custom domain's DNS records (A or CNAME) to your server or hosting provider.
2. The application will automatically detect your domain via the browser's live host and origin headers.
3. All share URLs, QR codes, input prefixes, and WebSocket connections will immediately use your connected custom domain.

### Optional Domain Override

If you need to force a specific domain across all environments, set the optional environment variable in your `.env`:

```env
VITE_CUSTOM_DOMAIN="notes.yourdomain.com"
```

## Scripts

- `npm run dev`: Start the Express and Vite development server
- `npm run build`: Compile static frontend assets and bundle `server.ts`
- `npm run start`: Launch the production server
- `npm run lint`: Run TypeScript type-checking
