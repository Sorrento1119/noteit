/**
 * Dynamic domain and URL utilities.
 *
 * Ensures all paths, URLs, QR codes, and WebSocket endpoints dynamically
 * resolve to whichever domain the user is currently connected to (including
 * custom domains, subdomains, localhost, or reverse proxies), without hardcoding.
 */

export function getDynamicHost(): string {
  // 1. Check if an explicit custom domain override is configured in environment variables
  const envDomain = ((import.meta as any).env?.VITE_CUSTOM_DOMAIN as string | undefined)?.trim();
  if (envDomain) {
    return envDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  }

  // 2. Dynamically resolve from active browser window
  if (typeof window !== 'undefined' && window.location && window.location.host) {
    return window.location.host;
  }

  return '';
}

export function getDynamicOrigin(): string {
  const envDomain = ((import.meta as any).env?.VITE_CUSTOM_DOMAIN as string | undefined)?.trim();
  if (envDomain) {
    const cleanHost = envDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    const protocol =
      typeof window !== 'undefined' && window.location?.protocol ? window.location.protocol : 'https:';
    return `${protocol}//${cleanHost}`;
  }

  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
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
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${host}`;
}
