# Footprints (location-only)

This is optional. Your site works without it.

## What it does
- `/hit` increments a KV counter using Cloudflare-provided geo fields (`request.cf.city/region/country`)
- `/stats` returns aggregated counts and a small recent list
- No IP is stored.

## Setup (free)
1. Install wrangler
   npm i -g wrangler

2. Create KV namespace in Cloudflare Dashboard (Workers → KV)

3. Copy config
   cp wrangler.toml.example wrangler.toml
   # fill YOUR_KV_ID and YOUR_GITHUB_IO_DOMAIN

4. Deploy
   wrangler deploy

5. On the website, enable in `data/profile.json`:

```json
"features": {
  "visitorFootprints": {
    "enabled": true,
    "endpoint": "https://YOUR-WORKER.workers.dev"
  }
}
```

Then add code in `misc.js` to fetch `${endpoint}/stats` and display.
