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

## Deploying to Vercel

The application is fully configured for seamless Vercel deployment:

1. **Push to GitHub**: Commit and push your code to your GitHub repository.
2. **Import in Vercel**: Connect your GitHub repository to Vercel.
3. **Automatic Routing**: Vercel automatically detects the project using `vercel.json` and routes `/api/*` endpoints to the serverless function handler in `api/index.ts`, while routing frontend single-page application paths (like `/:slug`) to `index.html`.
4. **Instant Cross-Device Hydration**: When sharing via the **Share & QR** button or scanning the QR code, notes load instantly on any mobile or desktop device (0ms delay), automatically saving to the device and keeping the clean `/:slug` URL.
5. **Permanent Note Lifetime**: Notes stay published permanently until you or an authorized user with the note password explicitly clicks **Delete**.
6. **Optional Vercel KV / Upstash Redis**:
   To enable global cloud persistence for users typing URLs directly into fresh browsers without following a share link:
   - In your Vercel project dashboard, go to the **Storage** tab.
   - Click **Create Database** -> select **KV** (or **Upstash Redis**).
   - Click **Connect** to link it to your project.
   - Vercel automatically configures `KV_REST_API_URL` and `KV_REST_API_TOKEN`. The app detects these immediately with zero extra configuration!

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
