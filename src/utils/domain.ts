/**
 * Dynamic domain and URL utilities.
 *
 * Automatically detects the live connected domain directly from the browser
 * (window.location.host and window.location.origin) so that whenever you
 * visit on any domain (custom domain, Cloud Run, localhost, or future domain changes),
 * all generated paths, copy buttons, QR codes, and WebSockets automatically use THAT domain.
 */

export function getDynamicHost(): string {
  // Always prioritize the live active browser domain
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.host) {
      return window.location.host;
    }
    if (window.location.hostname) {
      return window.location.hostname;
    }
  }

  // Fallback to optional environment variable if SSR or window not ready
  const envDomain = ((import.meta as any).env?.VITE_CUSTOM_DOMAIN as string | undefined)?.trim();
  if (envDomain) {
    return envDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  }

  return '';
}

export function getDynamicOrigin(): string {
  // Live active origin in browser (e.g. "https://notes.mydomain.com" or "http://localhost:3000")
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }

  const host = getDynamicHost();
  if (host) {
    const protocol =
      typeof window !== 'undefined' && window.location?.protocol
        ? window.location.protocol
        : 'https:';
    return `${protocol}//${host}`;
  }

  return '';
}

export function getDynamicNoteUrl(slug: string): string {
  const cleanSlug = slug.replace(/^\/+/, '');
  const origin = getDynamicOrigin();
  if (origin) {
    return `${origin}/${cleanSlug}`;
  }
  return `/${cleanSlug}`;
}

export function getDynamicWebSocketUrl(): string {
  const host = getDynamicHost();
  const protocol =
    typeof window !== 'undefined' && window.location?.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${host}`;
}
