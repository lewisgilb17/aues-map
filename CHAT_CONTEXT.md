# AUES Pub Crawl Map - Chat Context

Date: 4 May 2026  
Project path: `/Users/lewisgilbert/Programs/aues-map`

## Goal

Build a mobile-first interactive website for the AUES pub crawl, themed around **Scooby Brew: Mystery Intoxicated**. The site should show a map with venue pins, let users tap a venue to see details/deals, and allow users to locate themselves during the crawl.

The interface should feel closer to Google Maps than a generic OpenStreetMap prototype, while using Scooby-inspired colours rather than official copyrighted Scooby-Doo artwork.

## Source Material

The venue/deal details came from registration forms and images in:

`/Users/lewisgilbert/Downloads/drive-download-20260503T071628Z-3-001/`

The original forms included DOCX, PDF, and JPG files for venues such as Atlantis, Ballers Clubhouse, Bambini Cucina, Bank St Social, Betty's Burgers, Black Bull, Fumo Blu, Holey Moley, Secret Chamber, Schnithouse on Rundle, Union Hotel, West Oak, and others.

The extracted venue summary is in:

`venue-deals-summary.md`

No contact/mobile/email details were needed for the website UI.

## Current Website Files

- `index.html` - page shell and Vite entry mount
- `styles.css` - global mobile-first layout and map UI styling
- `src/main.ts` - TypeScript app entry, venue data, MapLibre setup, markers, search, details panel, geolocation
- `src/vite-env.d.ts` - Vite TypeScript typings
- `package.json` - Vite scripts and dependencies
- `tsconfig.json` - TypeScript compiler settings
- `venue-deals-summary.md` - source summary of venues/deals
- `CHAT_CONTEXT.md` - this handoff/context file

`app.js` remains in the root as the pre-migration JavaScript version and is no longer used by the site.

## Current Map Stack

The site currently uses:

- **Vite** for local development and production builds
- **TypeScript** for the application entrypoint
- **MapLibre GL JS** for the interactive map rendering
- **OpenFreeMap** vector tiles using the `bright` style
- Browser **Geolocation API** for live user location
- Google Maps directions links for the `Open directions` button

Current map style URL:

```js
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";
```

This avoids needing a Google Maps API key or billing account.

## Map Provider Investigation

Options considered:

- **Google Maps**: possible, familiar look, custom styling available, but requires Google Maps Platform billing and API key.
- **Mapbox**: polished look, free tier listed as up to 50,000 Mapbox GL JS map loads/month, but requires account/token and usage monitoring.
- **MapTiler**: good styles, free tier listed as 5,000 sessions/month and 100,000 requests/month, but requires key/account.
- **OpenFreeMap + MapLibre**: chosen for now because it is free, keyless, customisable, and simple to deploy.

## Current UI/UX State

The site is designed primarily for phone portrait use.

Current behavior:

- Full-screen map
- Floating event header
- Floating search bar
- `Locate me` button
- Location status showing nearest venue and distance
- Horizontal venue chip list
- Bottom venue details sheet
- Tap a pin or chip to open venue details
- `Open directions` links to Google Maps directions
- Live user location marker and accuracy circle

Visual direction:

- Google Maps-like floating white controls
- Clean rounded cards and shadows
- Scooby/Mystery Machine palette: teal, lime, orange, cream
- Numbered orange/teal venue pins
- No official Scooby-Doo images or character assets

## Run Locally

From Terminal:

```bash
cd /Users/lewisgilbert/Programs/aues-map
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

Stop server:

```bash
Ctrl+C
```

For phone testing on the same network:

```bash
npm run dev -- --host
```

For a production build:

```bash
npm run build
```

## Validation Run

The Vite production build has passed:

```bash
npm run build
```

The folder is not currently a git repository, so normal `git diff`/`git status` checks are not available unless a repo is initialised.

## Important Caveats

- Venue coordinates are approximate and should be checked before publishing.
- Some venue addresses were inferred where original forms were missing or unclear.
- No route order has been provided, so the map shows pins only, not a crawl route.
- Live location works on `localhost`, but on a real phone deployment it generally needs HTTPS.
- Opening from `http://your-mac-ip:8000` on another phone may not allow location permissions.
- For public use, deploy to GitHub Pages, Netlify, Vercel, or another HTTPS host.

## Likely Next Steps

1. Confirm exact venue coordinates.
2. Add official crawl order and draw a route line.
3. Add category/filter controls, for example bars, food, clubs.
4. Deploy over HTTPS.
5. Test on iPhone and Android in portrait mode.
6. Consider Mapbox or MapTiler later if reliability or a more premium hosted map style becomes important.
