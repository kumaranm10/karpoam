# Going live

## Running cost
| Item | Cost per year |
|---|---|
| Domain (.com) | about SGD 15–20 |
| Cloudflare Workers static hosting | free |
| Fonts, voice, analytics | free (self-hosted fonts, browser voice, Cloudflare Web Analytics) |
| **Total** | **about SGD 15–20** |

## 1. Cloudflare Workers (free, static assets)
1. Cloudflare dashboard → Workers & Pages → Create application → Import a repository → `karpoam`.
2. Project name `karpoam` (must match `name` in `wrangler.jsonc`). Build command `npm run build`. Deploy command `npx wrangler deploy`.
3. Node version comes from `.nvmrc` (Astro 7 needs Node 22.23.4 or newer). If the build uses an older Node, add variable `NODE_VERSION` = `22.23.5` under Settings → Build.
4. Every push to `main` deploys. `wrangler.jsonc` tells Cloudflare to publish `./dist` as plain files.

## 2. Domain
1. Buy the domain (Cloudflare Registrar sells at cost).
2. Worker → Settings → Domains & Routes → add custom domain.
3. Put the full address in `src/site.json` → `url` (e.g. `https://karpoam.com`). It is used for canonical links and the sitemap.

## 3. Google Search Console
Verify the domain (DNS record), then submit `https://<domain>/sitemap.xml`.

## 4. Analytics (optional, cookie-free)
Cloudflare → Web Analytics → add site → copy the token into `src/site.json` → `cloudflareAnalyticsToken`.

## 5. AdSense (only after 12+ ready lessons)
1. Apply at adsense.google.com with the domain. Thin sites get rejected, so wait until the lessons are there.
2. When approved: create **one display ad unit**. Copy the publisher ID (`ca-pub-…`) into `ads.client` and the ad unit's slot number into `ads.slot` in `src/site.json`.
3. `ads.txt` and the verification meta tag are generated automatically from that.
4. In AdSense: turn **Auto ads OFF**. Under Privacy & messaging, turn on the European consent message.
5. The ad code already asks for child-directed treatment (`data-tag-for-age-treatment="1"`), which turns off personalised ads.

To switch ads off again, empty `ads.client` and push.
