# Landing page

The static one-page site at <https://sheethappens.rolloutit.net>, in English (`index.html`) and
Hungarian (`hu/index.html`). Plain HTML and CSS plus a little vanilla JS (`site.js`, only for the
click-to-load YouTube embed). No build step, no CDN, no tracker, no cookies. It is not part of the
Next.js app and nothing in the app imports from here.

## Contents

| File                        | What it is                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `index.html`                | English page (canonical `https://sheethappens.rolloutit.net/`)                                                |
| `hu/index.html`             | Hungarian page, same structure (canonical `.../hu/`), with a language switch in the header                    |
| `style.css`                 | Styles; the colours mirror the app's `app/globals.css` tokens (dark default, light by `prefers-color-scheme`) |
| `site.js`                   | Swaps the video preview for a `youtube-nocookie.com` iframe on click                                          |
| `assets/`                   | Screenshots, `video-poster.jpg` (local copy of the YouTube thumbnail), `favicon.svg`, `fonts/`                |
| `favicon.ico`               | Copy of `app/favicon.ico`                                                                                     |
| `robots.txt`, `sitemap.xml` | Basic SEO, with the domain filled in                                                                          |

Every link is relative except the `canonical`, `og:*` and `hreflang` meta tags, which point at the
production domain. So the folder can be opened from any static server:

```bash
cd website
python3 -m http.server 8765
# http://localhost:8765/ and http://localhost:8765/hu/
```

## Deploy

`.github/workflows/website.yml` uploads this folder over FTPS whenever `main` moves and something
under `website/` changed. It can also be run by hand from the Actions tab. It uploads only the files
that changed since the last run and skips this README.

This folder is the source of truth: change the page here and let the workflow publish it. A file
edited by hand on the server is overwritten by the next upload of that file.

Repository settings it needs (Settings → Secrets and variables → Actions):

| Name             | Kind     | Value                                                                                                            |
| ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `FTP_SERVER`     | secret   | FTP host name                                                                                                    |
| `FTP_USERNAME`   | secret   | FTP user                                                                                                         |
| `FTP_PASSWORD`   | secret   | FTP password                                                                                                     |
| `FTP_SERVER_DIR` | variable | Optional. Document root relative to the FTP login, with a trailing slash (e.g. `public_html/`). Defaults to `./` |

## When editing

- **Both languages**: the two HTML files are separate. A copy change goes into both.
- **Screenshots**: `assets/*.png` are copies of `docs/images/`. When those are retaken, copy them
  here too. The `og:image` is `time-week-dark.png` (1600×800).
- **Video**: to switch videos, replace the `6xhXj7_6j0w` ID in both HTML files and refresh
  `assets/video-poster.jpg` from `https://img.youtube.com/vi/<id>/maxresdefault.jpg`.
- **Repository links** point at `https://github.com/rolloutit/sheet-happens/blob/main/...`.
- **CSP**: if the host sends a strict Content-Security-Policy, it has to allow
  `frame-src https://www.youtube-nocookie.com`, `img-src 'self'` and `script-src 'self'`. There is no
  inline script or style.
