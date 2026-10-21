# Devra Udaipur website

Website for **Devra Udaipur**, a luxury boutique homestay in Udaipur, Rajasthan (devraudaipur.in).
Redesigned by Pytech Digital.

## What's inside

| Path | What it is |
|---|---|
| `index.html` | Home page |
| `about.html`, `the-stay.html`, `experiences.html`, `explore-udaipur.html`, `gallery.html`, `journal.html`, `post.html`, `contact.html` | Inner pages |
| `content.json` | All text, photos, blog posts, contact details, booking link and slider |
| `site.css`, `site.js` | Design and behaviour (animations, slider, gallery, blog) |
| `images/` | All photos (AI-sharpened), named by their id in `content.json` |

It is a fully static site: no database, PHP or build step.

## Deploy

- **Netlify**: New site → Import from GitHub → pick this repo. Leave build command empty, publish directory `/`.
- **GitHub Pages**: Settings → Pages → Deploy from branch → `main` / root.
- **cPanel / any host**: upload all files to `public_html`.

Open the site through a web address (http/https). Opening `index.html` by double-click shows only the home page, because the other pages load `content.json`.

## Editing content

Edit `content.json` (text, posts, photo captions, contact details) and push; the host redeploys automatically.
To replace a photo, overwrite the file in `images/` with the same name.
