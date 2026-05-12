# error-diffusion

This repository now contains both:

- legacy performance/project files
- the website source of truth for error-diffusion domains

## Website source of truth

- Web source: `public/index.html`
- Worker router: `src/index.js`
- Cloudflare config: `wrangler.toml`

The visual/theme is based on:
https://codepen.io/aday_net_au/pen/zYqdeEG

## Deployment model

Push to `master` (or `main`) triggers:

- Cloudflare deploy via `.github/workflows/deploy.yml`
- GitHub Pages backup via `.github/workflows/pages-backup.yml`

GitHub Pages backup URL:
https://aday1.github.io/error-diffusion/

## Cloudflare requirements

Repository secret required:

- `CLOUDFLARE_API_TOKEN`

Cloudflare custom domains expected in `wrangler.toml`:

- `errordiffusion.cc`
- `www.errordiffusion.cc`
- `errordiffusion.net`
- `www.errordiffusion.net`

Requested registrar nameservers:

- `darl.ns.cloudflare.com`
- `elisabeth.ns.cloudflare.com`
