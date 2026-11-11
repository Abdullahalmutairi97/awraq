# أوراق — أدوات PDF بسيطة

Arabic (RTL) PDF toolbox that runs 100% in the browser. No upload, no server-side processing, no account.

## Tools
- **ترتيب الصفحات** — thumbnails grid: reorder (drag or arrows), rotate, delete with undo, save as a new PDF.
- **دمج PDF** — combine several PDFs in any order, drag to sort rows.
- **تقسيم PDF** — one file per page (zipped) or custom ranges like `1-3, 5, 7-9`.
- **صور إلى PDF** — JPG/PNG to PDF, A4 fit or auto page size.

## Stack
- `pdf-lib` 1.17.1 (read/write), `pdf.js` 3.11.174 legacy (thumbnails), `JSZip` 3.10.1 (split output) — all vendored under `vendor/`, no CDN.
- IBM Plex Sans Arabic 400/500/600/700, self-hosted in `assets/fonts/`.
- Plain HTML/CSS/JS, no build step. Mobile-first CSS, light theme only.
- `manifest.webmanifest` + icons → installable as a home-screen app.

## Serve
Runs as a systemd unit (`awraq.service`) so it comes back after a reboot:
```bash
sudo systemctl status awraq      # active (running)
sudo systemctl restart awraq     # after editing files
```
Local: `http://127.0.0.1:8090/` · Tailnet: `http://vps.tail9b4114.ts.net:8090/`

Public: `https://pdf.abdullahalmutairi.dev` — nginx vhost `/etc/nginx/sites-available/awraq` serves this folder directly (gzip + 30-day cache on `vendor/`, `assets/`). Needs the DNS A record `pdf` → `84.8.98.65`; `awraq-tls.timer` checks DNS every 3 minutes and issues the Let's Encrypt cert (with `--redirect`) the moment it resolves, then disables itself. nginx runs as `www-data`, so `/home/pinpin` must stay `o+x` (traverse only, no listing).

## Files
- `index.html` — shell, header, tool cards, workspace, result, toast
- `styles.css` — design tokens + mobile-first layout
- `app.js` — PDF engine and UI state (single IIFE)
- `manifest.webmanifest`, `assets/icon-*.png` — installable app metadata
- `preview/` — screenshots (mobile 390×844, desktop 1280×860)

## What is preserved (and proven)
Content is copied page-for-page, never re-rendered: every page was compared with `pdftoppm` pixel diffs against the source on real documents (two Linux Mint guides, an Arabic invoice, a CV, the IRS W-9 form).
- Merge 11/11 pages pixel-identical; split-every 4/4; ranges 2/2; organize move+rotate+delete 4/4 (rotation is a `/Rotate` flag, content untouched).
- Fillable forms keep their fields — `rebuildAcroForm()` rebuilds `/AcroForm` from the copied widgets (W-9: 23/23 fields).
- Bookmarks/outline tree is rebuilt and every destination remapped to the new page number (mint + cyber + CV merge → 20 items, correct pages); bookmarks pointing at deleted pages are dropped.
- Title, author, subject, keywords carry over (`copyMeta`).

## Known limits
- XFA form data (legacy Adobe forms) is dropped by pdf-lib.
- Producer/ModDate change on every save; `/Rotate` is added for rotation.
- Thumbnails need `http(s)` — opening `index.html` from `file://` merges fine but shows no previews.
- Encrypted PDFs are skipped with an Arabic toast.
