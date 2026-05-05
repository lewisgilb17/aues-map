# AUES Scooby Brew Map

MapLibre-based venue map for the AUES pub crawl.

## Development

Install dependencies:

```sh
npm ci
```

Start the local dev server:

```sh
npm run dev
```

Build the GitHub Pages version:

```sh
npm run build
```

Build the Fly.io version:

```sh
npm run build:fly
```

## Deployment

### GitHub Pages

GitHub Pages deploys from `.github/workflows/deploy.yml` on every push to `main`.

- Output base path: `/aues-map/`
- Public URL: `https://lewisgilb17.github.io/aues-map/`

### Fly.io

Fly.io deploys from `.github/workflows/deploy-fly.yml` on every push to `main`.

- Fly app: `aues-map`
- Fly config: `fly.toml`
- Public URLs:
  - `https://aues-map.fly.dev`
  - `https://pubcrawl.aues.com.au`

The Fly workflow expects a repository Actions secret named `FLY_API_TOKEN`.

To add it in GitHub:

1. Open the repository on GitHub.
2. Go to `Settings` -> `Secrets and variables` -> `Actions`.
3. Create a new repository secret named `FLY_API_TOKEN`.
4. Paste a Fly deploy token that can deploy the `aues-map` app.

GitHub Actions does not read your local `.env`, so keeping `FLY_DEPLOY_TOKEN` locally is not enough for the workflow.

### Manual Fly deploy

If you want to deploy manually from your machine instead of waiting for Actions:

```sh
flyctl deploy --remote-only --config fly.toml
```

If you are not logged in with `flyctl`, set `FLY_API_TOKEN` in the shell before running that command.