#!/usr/bin/env python3
"""Bake Alliance /pub media into public/pub CRT channel pages. /pub only."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

IMAGE_EXT = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp'}
AUDIO_EXT = {'.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.opus'}
VIDEO_EXT = {'.mp4', '.webm', '.mov', '.mkv', '.m4v'}

CHANNEL_TMPL = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#050805">
  <title>{title} / pub / Error Diffusion</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../styles/pub.css?v=20261014-pub3">
</head>
<body>
  <main class="pub-shell pub-channel">
    <nav class="pub-rail" aria-label="pub navigation">
      <a class="pub-brand" href="/">error diffusion</a>
      <a href="/pub/">public signal / pub</a>
      <span>CH {channel:02d} / ON AIR</span>
    </nav>
    <header class="pub-hero">
      <span class="pub-badge"><i aria-hidden="true"></i> {kind}</span>
      <h1>{title}</h1>
      <p>Baked from Alliance <code>/pub/{path}</code>.</p>
      <div class="pub-runes" aria-hidden="true">
        <span class="pub-rune r1"></span><span class="pub-rune r3"></span><span class="pub-rune r5"></span>
      </div>
    </header>
    <section class="pub-stage">
      <div class="pub-crt-head">
        <span>MATRIX-ERROR-DIFFUSION</span>
        <span>{kind} frame</span>
      </div>
      <div class="pub-stage-glass">
        {player}
        <div class="pub-scan" aria-hidden="true"></div>
      </div>
    </section>
    <p class="pub-foot"><a href="{media}">raw signal</a> · <a href="/pub/">back to grid</a></p>
  </main>
  <script src="../../scripts/pub-channel.js?v=20261014-pub3"></script>
  <script>EdiffPub.mountChannel({{ root: document.querySelector('.pub-channel') }});</script>
</body>
</html>
"""


def kind_of(name: str) -> str:
    ext = Path(name).suffix.lower()
    if ext in IMAGE_EXT:
        return 'image'
    if ext in AUDIO_EXT:
        return 'audio'
    if ext in VIDEO_EXT:
        return 'video'
    return 'file'


def slugify(rel: str) -> str:
    stem = re.sub(r'[^a-zA-Z0-9._-]+', '-', rel).strip('-').lower()
    digest = hashlib.sha1(rel.encode()).hexdigest()[:8]
    base = stem[:80] or 'signal'
    return f'{base}-{digest}'


def player_html(kind: str, media: str, title: str) -> str:
    if kind == 'image':
        return f'<img src="{media}" alt="{title}">'
    if kind == 'video':
        return f'<video src="{media}" controls playsinline preload="metadata"></video>'
    if kind == 'audio':
        return (
            f'<audio src="{media}" controls preload="metadata"></audio>'
            '<canvas class="pub-wave" aria-hidden="true"></canvas>'
        )
    return f'<div class="pub-soon"><strong>file</strong><span><a href="{media}">download raw</a></span></div>'


def bake(src: Path, dest: Path) -> dict:
    media_dir = dest / 'media'
    channel_dir = dest / 'channel'
    if media_dir.exists():
        shutil.rmtree(media_dir)
    if channel_dir.exists():
        shutil.rmtree(channel_dir)
    media_dir.mkdir(parents=True, exist_ok=True)
    channel_dir.mkdir(parents=True, exist_ok=True)

    items = []
    files = sorted(p for p in src.rglob('*') if p.is_file() and not p.name.startswith('.'))
    for index, path in enumerate(files, start=1):
        rel = path.relative_to(src).as_posix()
        kind = kind_of(path.name)
        slug = slugify(rel)
        target = media_dir / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        media_url = f'../media/{rel}'
        channel_url = f'./channel/{slug}.html'
        title = path.stem.replace('_', ' ').replace('-', ' ')
        if kind in {'image', 'audio', 'video'}:
            html = CHANNEL_TMPL.format(
                title=title,
                kind=kind,
                path=rel,
                channel=index,
                player=player_html(kind, media_url, title),
                media=media_url,
            )
            (channel_dir / f'{slug}.html').write_text(html, encoding='utf-8')
        else:
            channel_url = media_url
        items.append({
            'name': path.name,
            'path': rel,
            'slug': slug,
            'kind': kind,
            'title': title,
            'media': f'./media/{rel}',
            'channel': channel_url if kind in {'image', 'audio', 'video'} else f'./media/{rel}',
            'bytes': path.stat().st_size,
        })

    manifest = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'source': 'alliance:/pub/',
        'items': items,
    }
    (dest / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--src', type=Path, required=True, help='Alliance /pub source directory')
    parser.add_argument('--dest', type=Path, required=True, help='Repo public/pub destination')
    args = parser.parse_args()
    src = args.src.resolve()
    dest = args.dest.resolve()
    if not src.is_dir():
        raise SystemExit(f'source missing: {src}')
    # Refuse escaping /pub — src must be the pub folder itself.
    if src.name != 'pub':
        raise SystemExit(f'refusing non-pub source name: {src}')
    dest.mkdir(parents=True, exist_ok=True)
    manifest = bake(src, dest)
    print(f'baked {len(manifest["items"])} item(s) -> {dest}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
