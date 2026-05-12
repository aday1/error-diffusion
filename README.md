# error-diffusion

This repository is both:

- the live website source for the Error Diffusion domains
- the public archive for older performance materials, Max patches, poster assets, and sample fragments

## Website source of truth

- Web source: `public/index.html`
- Public archive assets: `public/library/`
- Worker router: `src/index.js`
- Cloudflare config: `wrangler.toml`

The site keeps the original glitch/shader landing-page aesthetic and expands it into an archive homepage with sections for:

- news
- max packs
- samples
- gig posters
- gig scrap

The visual/theme is based on:
https://codepen.io/aday_net_au/pen/zYqdeEG

## Repository layout

Top level is intentionally minimal now:

- `public/` - site HTML plus all publicly served archive assets
- `src/` - Worker router code
- `.github/workflows/` - deploy and backup automation

Archive assets are grouped under `public/library/`:

- `public/library/max-packs/error-diff-tcp/` - Max/MSP TCP audio patches and notes
- `public/library/performance/touchosc/` - TouchOSC controller layouts
- `public/library/performance/toe/` - TouchDesigner/TOE project fragments
- `public/library/performance/tools/` - helper utilities
- `public/library/samples/beats/` - beat sketches and mixes
- `public/library/samples/sfx/` - sound-effect assets
- `public/library/gig-posters/` - poster and banner art
- `public/library/gig-scrap/` - GIFs and other visual leftovers
- `public/library/docs/` - notes, OSC maps, shader references, and misc documentation

## Deployment model

Push to `master` triggers:

- Cloudflare deploy via `.github/workflows/deploy.yml`
- GitHub Pages backup via `.github/workflows/pages-backup.yml`

GitHub Pages backup URL:
https://aday1.github.io/error-diffusion/

## Cloudflare requirements

Repository secret required:

- `CLOUDFLARE_API_TOKEN`

Cloudflare custom domains expected on the Worker service:

- `errordiffusion.cc`
- `www.errordiffusion.cc`
- `errordiffusion.net`
- `www.errordiffusion.net`

Note: route/domain attachment is managed in Cloudflare service settings.
The GitHub Actions deploy updates Worker code/assets from this repository.

Requested registrar nameservers:

- `darl.ns.cloudflare.com`
- `elisabeth.ns.cloudflare.com`
