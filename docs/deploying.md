# Uploading a build

The build is a static site: `npm run build` puts it in `dist/`, and any host
that serves files will do. What follows is the part that is easy to get wrong.

Upload the **whole** of `dist/`, `assets/` and the dotfile included. Every
other file sits at the root, which is deliberate: the icons used to live in
`dist/icons/`, that folder was dropped by an upload twice, and the second
failure left a directory on the server that could not be read into or
repaired by re-uploading. A manifest whose icons all 404 fails the browser's
installability check silently — the app looks and works perfectly, it simply
stops offering to install and the installed copy has no icon of its own.

Two things to check after an upload:

```bash
curl -o /dev/null -w '%{http_code}\n' https://<host>/icon-192.png   # 200
curl -o /dev/null -w '%{content_type}\n' https://<host>/manifest.webmanifest
curl -s https://<host>/oauth/client.json | head -c 40                     # {"client_id"…
curl -sI https://<host>/ | grep -i content-security-policy
```

The second should say `application/manifest+json`. It comes from `.htaccess`,
which ships in `dist/` — a dotfile, so a client set to hide them will skip it.

The third is what "Continue with Todoist" depends on: Todoist fetches that
file to identify the app. The build writes it for `PUBLIC_URL`, the official
site by default; a copy hosted anywhere else must be built with
`PUBLIC_URL=https://<host>/ npm run build` (see "Self-hosting" in the README),
and the file's `client_id` should then start with that address. If it answers with the app's own page instead, the
`oauth/` folder was not uploaded and Todoist replies `invalid_client`. The
fourth checks that `.htaccess` is in place; without it the app still works,
without its Content-Security-Policy.

## Cloudflare Pages, for one person

A copy only you can open: Cloudflare Pages hosts it and Cloudflare Access puts
a login in front of it. Both are free. Your tasks were never on the server
anyway — they stay in Todoist and in your browser — so this is about who can
use the app, not who can read your data.

**Hosting.** In the Cloudflare dashboard, Workers & Pages → Create → Pages →
connect this repository, then:

- Build command: `PUBLIC_URL=https://<project>.pages.dev/ npm run build`
  (your own domain instead, if you add one; keep the trailing `/`)
- Build output directory: `dist`

Node comes from `.nvmrc`. Every push to the production branch redeploys.
`.htaccess` does nothing here; the build also writes `_headers`, which gives
Pages the same Content-Security-Policy and caching, and Pages already answers
unknown paths with `index.html`. Leave Cloudflare's script injections off
(Web Analytics' automatic setup, Email Obfuscation, Rocket Loader): the policy
blocks inline scripts, so they would fail, and noisily.

**The login.** Zero Trust → Access → Applications → Add → Self-hosted:

1. One application for the whole domain, with an **Allow** policy whose
   Include rule is *Emails* → your address. Anyone else meets a login page
   they cannot get past.
2. A second one for the same domain with the path `oauth/client.json`, with a
   **Bypass** policy for *Everyone*. "Continue with Todoist" works by Todoist's
   servers fetching that file, and they cannot sign in to Cloudflare. It only
   names the app and the addresses Todoist may return to, so it is harmless to
   leave public. The more specific path wins over the first application.

Skip the second step if you would rather sign in with an API token (Todoist
Settings → Integrations → Developer); then nothing is public at all.

Installing the app still works behind the login: the manifest is requested
with cookies (`useCredentials` in `vite.config.ts`), so it is not turned away.
Preview deployments (`<hash>.<project>.pages.dev`) are a different address, so
protect `*.<project>.pages.dev` too, or turn previews off.

Check it from a private window and from the command line:

```bash
curl -sI https://<host>/ | head -1                                    # 302, to the Access login
curl -s https://<host>/oauth/client.json | head -c 40                 # {"client_id"… (if bypassed)
```
