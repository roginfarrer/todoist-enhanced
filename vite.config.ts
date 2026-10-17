import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * The security headers the host sends, from public/.htaccess.
 *
 * Apache applies them in production. `npm run preview` applies the same ones
 * here so a build can be checked against the policy before it is uploaded.
 * Keep the two in step. Cloudflare Pages gets them from `_headers`, which the
 * build writes from this list, and the built page carries the policy itself
 * as well (contentSecurityMeta).
 */
const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://api.todoist.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "base-uri 'self'",
    "frame-src https://tally.so",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

/**
 * The same Content-Security-Policy as a `<meta>` tag in the built page, so a
 * copy served by a host that reads neither .htaccess nor _headers (Netlify,
 * GitHub Pages, a plain static server) is still covered. `frame-ancestors` is
 * dropped: browsers ignore it in a meta tag, and the headers keep it where
 * the host sends them.
 * Build only: the dev server injects an inline script for React's hot reload,
 * which this policy would refuse.
 */
function contentSecurityMeta(policy: string): Plugin {
  const content = policy.split('; ').filter((part) => !part.startsWith('frame-ancestors')).join('; ');
  return {
    name: 'content-security-meta',
    apply: 'build',
    /* Right after the charset, which comes first, and ahead of every script
       the policy has to cover. */
    transformIndexHtml(html) {
      const charset = '<meta charset="utf-8" />';
      if (!html.includes(charset)) throw new Error('index.html: no charset meta to put the Content-Security-Policy after');
      return html.replace(charset, `${charset}\n    <meta http-equiv="Content-Security-Policy" content="${content}" />`);
    },
  };
}

/**
 * `_headers`, the same policy for Cloudflare Pages, which ignores `.htaccess`.
 *
 * Written from SECURITY_HEADERS rather than by hand, so the two cannot drift.
 * The files without a hash in their name are revalidated on every load, as
 * `.htaccess` does, or a new build sits behind the old one. Apache serves it
 * as an ordinary file; there is nothing secret in it.
 */
function cloudflareHeaders(): Plugin {
  const all = Object.entries(SECURITY_HEADERS).map(([name, value]) => `  ${name}: ${value}`);
  const fresh = ['/sw.js', '/registerSW.js', '/theme-boot.js', '/manifest.webmanifest']
    .map((path) => `${path}\n  Cache-Control: no-cache, must-revalidate`);
  const body = [`/*\n${all.join('\n')}`, ...fresh].join('\n\n') + '\n';
  return {
    name: 'cloudflare-headers',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: body });
    },
  };
}

/**
 * Where this copy of the app is served from, ending with `/`.
 *
 * "Continue with Todoist" identifies the app by the URL of a small JSON file
 * it hosts (`oauth/client.json`), and Todoist only sends people back to the
 * addresses that file lists. Written by hand for the official site, it made
 * every other copy fail with "Invalid redirect URI": a fork on its own domain
 * asked Todoist to check its address against this site's list. A copy built
 * with `PUBLIC_URL=https://example.com/ npm run build` describes itself
 * instead. Left unset, the file is exactly the official site's, as before.
 */
const OFFICIAL_URL = 'https://todoistenhanced.julesbertolino.fr/';
const PUBLIC_URL = (() => {
  const url = (process.env.PUBLIC_URL ?? '').trim() || OFFICIAL_URL;
  return url.endsWith('/') ? url : `${url}/`;
})();
/** The dev server Todoist also accepts, so signing in works in development. */
const DEV_REDIRECT = 'http://localhost:5192/';

/** The build-time constants the app reads (declared in src/vite-env.d.ts); the unit tests use them too. */
export const APP_DEFINE = {
  __PUBLIC_URL__: JSON.stringify(PUBLIC_URL),
  __OAUTH_DEV_REDIRECT__: JSON.stringify(DEV_REDIRECT),
};

/**
 * `oauth/client.json`, built for `PUBLIC_URL`: emitted with the build, and
 * served by the dev server. `vite preview` serves the built one from `dist/`,
 * which is the file that will be uploaded.
 */
function oauthClientDocument(publicUrl: string): Plugin {
  const body = `{
  "client_id": "${publicUrl}oauth/client.json",
  "client_name": "Enhanced for Todoist",
  "client_uri": "${publicUrl}",
  "logo_uri": "${publicUrl}icon-192.png",
  "redirect_uris": [
    "${publicUrl}",
    "${DEV_REDIRECT}"
  ],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
`;
  return {
    name: 'oauth-client-document',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/oauth/client.json') return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(body);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'oauth/client.json', source: body });
    },
  };
}

export default defineConfig({
  // Relative base so the build can be dropped into any subfolder on Infomaniak.
  base: './',
  preview: { headers: SECURITY_HEADERS },
  define: APP_DEFINE,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    contentSecurityMeta(SECURITY_HEADERS['Content-Security-Policy']),
    oauthClientDocument(PUBLIC_URL),
    cloudflareHeaders(),
    VitePWA({
      registerType: 'autoUpdate',
      /* The manifest is fetched with cookies. Behind a login such as
         Cloudflare Access (docs/deploying.md) a request without them gets the
         login page instead, and the app silently stops offering to install. */
      useCredentials: true,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      /* The service worker is a build artefact only. The plugin can serve a
         development one, but under this app's relative `base` it fails to
         register and fills the console with an error about a script it cannot
         fetch — which is noise standing in for the very thing it was turned on
         to check. Installing is verified against a build. */
      manifest: {
        /* A stable identity for the installed app, independent of the URL it
           was installed from. Chromium browsers — Brave included — will not
           offer to install a manifest they cannot tell apart from another. */
        id: './',
        name: 'Enhanced for Todoist',
        short_name: 'Enhanced',
        description: 'An independent project, not created by, affiliated with, or supported by Todoist. A local-first client built around planning a week.',
        theme_color: '#d1453b',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          /* A maskable icon is cropped to whatever shape the system likes, so
             it needs its own full-bleed square. The rounded one was losing its
             corners to the mask. */
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The share card is fetched by link scrapers, never by the app. There
        // is no reason to spend a fifth of the offline cache on it.
        globIgnores: ['og-image.png'],
        // A new build takes effect on the next reload instead of sitting behind
        // the old one until every tab has been closed.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // The Todoist API is never cached: the app owns its own offline cache in IndexedDB.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [],
      },
    }),
  ],
});
