(() => {
'use strict';

/* ---------- Page identity ---------- */
const APP = document.getElementById('app');
const PAGE = (APP && APP.dataset.page) || 'home';
const IS_INDEX = PAGE === 'home';
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Rozha+One&display=swap';
const RESET = captureReset();
const RM = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) { return { matches: false }; } })();
const LINKS = { luxury: 'luxury-homestay-udaipur.html', home: './', about: 'about.html', stay: 'the-stay.html', experiences: 'experiences.html', udaipur: 'explore-udaipur.html', gallery: 'gallery.html', journal: 'journal.html', contact: 'contact.html' };
const NAV = [['about', 'About'], ['stay', 'The stay'], ['experiences', 'Experiences'], ['udaipur', 'Explore Udaipur'], ['gallery', 'Gallery'], ['journal', 'Blog'], ['contact', 'Contact']];
const postUrl = slug => (typeof STATE !== 'undefined' && STATE && STATE.static ? 'blog-' + slug + '.html' : 'post.html#' + slug);
const postSlug = () => (APP && APP.dataset.slug) || String(location.hash || '').replace(/^#/, '');
const adminUrl = () => IS_INDEX ? '#admin' : './#admin';

function captureReset() {
  try {
    const list = document.head ? Array.from(document.head.querySelectorAll('style')) : [];
    const hit = list.find(s => /safe-area-inset/.test(s.textContent || '')) || list[0];
    if (hit && hit.textContent) return hit.textContent;
  } catch (e) {}
  return ':root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px/1.4 system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}';
}

/* ---------- Data ---------- */
function readEmbedded() { const el = document.getElementById('site-data'); if (!el) return null; try { return JSON.parse(el.textContent); } catch (e) { return null; } }
function withTimeout(p, ms) { return Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]); }
async function fetchJson(url) { try { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return null; return await r.json(); } catch (e) { return null; } }
async function fetchIndexState() {
  const open = '<script id="site-data" type="application/json">';
  const close = '</' + 'script>';
  for (const u of ['./', 'index.html']) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) continue;
      const t = await r.text();
      const a = t.indexOf(open);
      if (a < 0) continue;
      const b = t.indexOf(close, a + open.length);
      return JSON.parse(t.slice(a + open.length, b));
    } catch (e) {}
  }
  return null;
}
function newest(list) { return list.filter(s => s && typeof s === 'object' && s.settings).sort((x, y) => (Number(y.rev) || 0) - (Number(x.rev) || 0))[0] || null; }
function fixShape(s) {
  ['settings', 'pages', 'sections'].forEach(k => { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; });
  ['media', 'posts', 'experiences', 'places', 'reviews', 'stories', 'faqs'].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; });
  const st = s.settings;
  if (!st.socials) st.socials = {};
  ['facts', 'reach', 'phonesOther', 'heroSlides', 'marquee'].forEach(k => { if (!Array.isArray(st[k])) st[k] = []; });
  if (st.heroPhoto && !st.heroSlides.length) st.heroSlides.push({ id: 'hs-legacy', photo: st.heroPhoto, caption: '' });
  delete st.heroPhoto;
  return s;
}

let STATE = null;
let DRAFT = null;
let CUR = null;
const caps = { artifact: null, assets: null, downloads: null, user: null };
let access = 'checking';
let dirty = false;
let publishing = false;
const ui = { galleryCat: 'All', journalCat: 'All', menuOpen: false, previewDraft: false };
const admin = { tab: 'overview', postId: null, preview: false, open: new Set(), uploads: null, usage: null, usageLoading: false, restore: null, uploadFor: null, photoFilter: 'All' };
const LB_SETS = {};
let lb = null, picker = null;

const TABS = [['overview', 'Overview'], ['journal', 'Blog'], ['stories', 'Stories'], ['photos', 'Photos'], ['faqs', 'FAQ'], ['pages', 'Page text'], ['experiences', 'Experiences'], ['places', 'Places'], ['reviews', 'Reviews'], ['settings', 'Site settings']];
const SOCIAL_NAMES = { facebook: 'Facebook', instagram: 'Instagram', tripadvisor: 'TripAdvisor', youtube: 'YouTube' };
const PAGE_GROUPS = [
  ['Home page', null, ['home_about', 'home_f1', 'home_f2', 'home_f3', 'home_f4', 'home_aerial', 'home_room', 'home_stay', 'home_cuisine', 'home_band']],
  ['About', 'about', ['about_devra', 'about_hosts']],
  ['The stay', 'stay', ['stay_leisure', 'stay_rooms', 'stay_band', 'stay_facilities', 'stay_perfect']],
  ['Experiences', 'experiences', ['exp_intro', 'exp_culinary', 'exp_community']],
  ['Explore Udaipur', 'udaipur', ['udaipur_about', 'udaipur_places', 'udaipur_mustdo']],
  ['Gallery', 'gallery', []],
  ['Journal', 'journal', []],
  ['Contact', null, ['contact_intro']],
  ['Luxury homestay page (SEO, linked from the footer)', 'luxury', ['seo_luxury']]
];
const LISTS = {
  faqs: { label: 'Question', fields: [['q', 'Question', 'text'], ['a', 'Answer', 'textarea']] },
  stories: { label: 'Story', fields: [['title', 'Title (shown under the circle)', 'text'], ['cover', 'Cover photo (shown in the circle)', 'photo'], ['category', 'Play photos from this category (as named in the Photos tab, e.g. Rooms, Cuisine, Estate, Pool, Lounges)', 'text'], ['caption', 'Text on the first slide (optional)', 'textarea']] },
  experiences: { label: 'Experience', fields: [['title', 'Title', 'text'], ['text', 'Description', 'textarea'], ['photo', 'Photo', 'photo']] },
  places: { label: 'Place', fields: [['name', 'Name', 'text'], ['distance', 'Distance from Udaipur (optional)', 'text'], ['text', 'Description', 'textarea'], ['photo', 'Photo', 'photo']] },
  reviews: { label: 'Review', fields: [['name', 'Guest name', 'text'], ['from', 'From (city or country)', 'text'], ['quote', 'Review text (typed out; shown in handwriting when there is no photo of the note)', 'textarea'], ['photo', 'Photo of the handwritten note (optional, crop it to the note)', 'photo'], ['source', 'Source, e.g. Guest book or TripAdvisor', 'text'], ['date', 'Month and year', 'text']] },
  'settings/facts': { label: 'Fact', fields: [['value', 'Value', 'text'], ['label', 'Label', 'text']] },
  'settings/reach': { label: 'Distance', fields: [['label', 'Place', 'text'], ['value', 'Distance', 'text']] },
  'settings/heroSlides': { label: 'Slide', fields: [['photo', 'Photo', 'photo'], ['caption', 'Caption (optional)', 'text']] }
};

/* ---------- Utilities ---------- */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
const uid = p => p + '-' + Math.random().toString(36).slice(2, 9);
const clone = o => JSON.parse(JSON.stringify(o));
const uniq = a => Array.from(new Set(a));
const sleep = ms => new Promise(r => setTimeout(r, ms));
function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; }
function paras(t) { return String(t || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join(''); }
function firstPara(t) { return String(t || '').split(/\n\s*\n/)[0] || ''; }
function fmtDate(d) { if (!d) return ''; const dt = new Date(String(d).length === 10 ? d + 'T00:00:00' : d); if (isNaN(dt)) return ''; return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtDateTime(d) { const dt = new Date(d); if (!d || isNaN(dt)) return 'not yet'; return dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function slugify(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80); }
function readMins(t) { return Math.max(1, Math.round(String(t || '').split(/\s+/).filter(Boolean).length / 200)); }
function fmtBytes(n) { if (!n) return '0 B'; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(0) + ' KB'; if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB'; return (n / 1073741824).toFixed(2) + ' GB'; }
function idFor(path) { return 'f-' + String(path).replace(/[^a-zA-Z0-9]+/g, '-'); }
function walk(obj, parts) { let cur = obj; for (const p of parts) { if (cur == null) return undefined; cur = (p.charAt(0) === '@' && Array.isArray(cur)) ? cur.find(x => x && x.id === p.slice(1)) : cur[p]; } return cur; }
function getPath(obj, path) { return walk(obj, String(path).split('/')); }
function setPath(obj, path, val) { const parts = String(path).split('/'); const last = parts.pop(); const parent = walk(obj, parts); if (parent && typeof parent === 'object') parent[last] = val; }
function findMedia(id, src) { if (!id) return null; return (((src || CUR) || {}).media || []).find(m => m.id === id) || null; }
function hasPhoto(id, src) { const m = findMedia(id, src); return !!(m && (m.assetId || m.file)); }
function assetSrc(m) { return m.file && STATE && STATE.static ? 'images/' + m.file : '/_blob/' + m.assetId; }
function catClass(c) { c = String(c || '').toLowerCase(); if (/cuisine|food|guest|art|brand/.test(c)) return 'haldi'; if (/estate|pool|udaipur|garden|property/.test(c)) return 'leaf'; return 'indigo'; }
function publishedPosts(src) { return (((src || CUR) || {}).posts || []).filter(p => p.status === 'published').slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))); }
function mediaCats(src) { return uniq((((src || DRAFT || STATE) || {}).media || []).map(m => m.category).filter(Boolean)); }
function normName(s) {
  s = String(s || '').split('?')[0].split('/').pop().toLowerCase();
  try { s = decodeURIComponent(s); } catch (e) {}
  return s.replace(/\.(jpe?g|png|webp|gif)$/, '').replace(/-(scaled|\d+x\d+)$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function at(t) { const ws = String(t || '').trim().split(/\s+/); if (ws.length < 2) return esc(t); const last = ws.pop(); return esc(ws.join(' ')) + ' <em class="ital">' + esc(last) + '</em>'; }
function rise(text, accent) { const ws = String(text || '').split(/\s+/).filter(Boolean); return ws.map((w, i) => '<span class="w' + (accent && i === ws.length - 1 && ws.length > 1 ? ' accent' : '') + '"><span style="--i:' + i + '">' + esc(w) + '</span></span>').join(' '); }

/* ---------- Line icons (24px grid) ---------- */
const ICONS = {
  instagram: 'M7 2.5h10A4.5 4.5 0 0 1 21.5 7v10a4.5 4.5 0 0 1-4.5 4.5H7A4.5 4.5 0 0 1 2.5 17V7A4.5 4.5 0 0 1 7 2.5ZM15.8 12a3.8 3.8 0 1 1-7.6 0 3.8 3.8 0 0 1 7.6 0ZM17.4 6.6h.01',
  pool: 'M9 14V5.5a2 2 0 0 0-2-2M15 14V5.5a2 2 0 0 0-2-2M9 7h6M9 10.5h6M2 17c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 21c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2',
  snow: 'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2 3-2M9 20l3-2 3 2',
  wifi: 'M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19.5h.01',
  laundry: 'M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0Z',
  car: 'M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11M3 17v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4H3ZM6 17v2.5M18 17v2.5M7 14h.01M17 14h.01',
  plane: 'M2.5 13.5 21 7.2a1.6 1.6 0 0 0-1.4-2.9L4.2 9.6l-1.7-2L1 8.2l1.5 5.3ZM8 11.6l2.6 6.9 2.3-1-1-7.6M3 21h18',
  leaf: 'M11 20a7 7 0 0 1-7-7c0-5 4-9 16-10-1 12-5 17-9 17ZM4 21c3-6 7-9 11-11',
  lake: 'M2 17c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 21c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M7 12a5 5 0 0 1 10 0M12 3.5v2M5.2 6.2l1.4 1.4M18.8 6.2l-1.4 1.4',
  palace: 'M3 21h18M4 21v-9h16v9M8 12V9a4 4 0 0 1 8 0v3M12 5V3M10 21v-3a2 2 0 0 1 4 0v3M4 12a2 2 0 0 1 4 0M16 12a2 2 0 0 1 4 0M6.5 15.5h1M16.5 15.5h1',
  temple: 'M12 2v2M8.5 9 12 4l3.5 5M6 13l6-4 6 4M5 21v-8h14v8M3 21h18M10 21v-4h4v4',
  fort: 'M3 21h18M4 21V8h2.5v2.5H9V8h2v2.5h2V8h2v2.5h2.5V8H20v13M10 21v-4a2 2 0 0 1 4 0v4'
};
function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (ICONS[name] || ICONS.leaf) + '"></path></svg>'; }
function amenityIcon(t) { t = String(t).toLowerCase(); return /airport|railway|pickup|station/.test(t) ? 'plane' : /pool|swim/.test(t) ? 'pool' : /air-?condition|\bac\b/.test(t) ? 'snow' : /wi-?fi|internet/.test(t) ? 'wifi' : /laundry|wash/.test(t) ? 'laundry' : /taxi|cab|car/.test(t) ? 'car' : 'leaf'; }
function placeIcon(t) { t = String(t).toLowerCase(); return /fort|kumbhal|sanctuary/.test(t) ? 'fort' : /temple|eklingji|jagdish/.test(t) ? 'temple' : /palace|haveli|museum/.test(t) ? 'palace' : /lake|sagar|pichola/.test(t) ? 'lake' : 'leaf'; }
function ornament(cls) {
  return '<span class="ornament' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><svg viewBox="0 0 132 26"><path class="o-line" d="M0 15H46M86 15H132"></path>' +
    '<path class="o-leaf" d="M47 16c6-2 10 0 13 6-6 1-10-1-13-6ZM85 16c-6-2-10 0-13 6 6 1 10-1 13-6Z"></path>' +
    '<path class="o-petal" d="M66 2c5 5 5 13 0 20-5-7-5-15 0-20Z"></path><path class="o-petal" d="M57 8c6 1 9 7 9 14-6-1-10-6-9-14ZM75 8c-6 1-9 7-9 14 6-1 10-6 9-14Z" opacity=".78"></path></svg></span>';
}
function shead(eyebrow, title, lead) { return '<div class="shead" data-reveal>' + (eyebrow ? '<p class="eyebrow">' + esc(eyebrow) + '</p>' : '') + '<h2>' + at(title) + '</h2>' + ornament() + (lead ? '<p class="lead">' + esc(lead) + '</p>' : '') + '</div>'; }

/* ---------- Photo rendering ---------- */
function pic(ref, o) {
  o = o || {};
  const m = ref && typeof ref === 'object' ? ref : findMedia(ref);
  const wide = !!(m && m.w && m.h && m.w > m.h * 1.12);
  const cls = 'pic' + (o.arch ? (wide ? ' pic--wide' : ' pic--arch') : '') + (o.cls ? ' ' + o.cls : '');
  const nat = o.natural && m && m.w && m.h ? ' style="aspect-ratio:' + m.w + '/' + m.h + '"' : '';
  if (m && (m.assetId || m.file)) return '<span class="' + cls + '"' + nat + '><img src="' + esc(assetSrc(m)) + '" alt="' + esc(m.caption || o.label || 'Photo at Devra Udaipur') + '"' + (o.eager ? '' : ' loading="lazy"') + ' decoding="async"></span>';
  const label = (m && m.caption) || o.label || 'Photo';
  return '<span class="' + cls + ' ph ph--' + catClass(m ? m.category : o.cat) + '" role="img" aria-label="' + esc(label) + '"><span class="ph-label"><span>' + esc(label) + '</span></span></span>';
}

/* ---------- Markdown-lite ---------- */
function inline(t) {
  let s = esc(t);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, a, u) => '<a href="' + u + '" target="_blank" rel="noopener">' + a + '</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s;
}
function md(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  const out = []; let para = [], list = null, quote = [];
  const fP = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const fL = () => { if (list) { out.push('<ul>' + list.map(li => '<li>' + inline(li) + '</li>').join('') + '</ul>'); list = null; } };
  const fQ = () => { if (quote.length) { out.push('<blockquote>' + inline(quote.join(' ')) + '</blockquote>'); quote = []; } };
  const fA = () => { fP(); fL(); fQ(); };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, ''); let m;
    if (!line.trim()) { fA(); continue; }
    if ((m = line.match(/^(#{2,3})\s+(.*)$/))) { fA(); const n = m[1].length; out.push('<h' + n + '>' + inline(m[2]) + '</h' + n + '>'); continue; }
    if ((m = line.match(/^!\[([^\]]*)\]\(media:([A-Za-z0-9_-]+)\)$/))) { fA(); out.push('<figure class="post-fig">' + pic(m[2], { label: m[1] }) + (m[1] ? '<figcaption>' + esc(m[1]) + '</figcaption>' : '') + '</figure>'); continue; }
    if ((m = line.match(/^[-*]\s+(.*)$/))) { fP(); fQ(); if (!list) list = []; list.push(m[1]); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { fP(); fL(); quote.push(m[1]); continue; }
    fL(); fQ(); para.push(line.trim());
  }
  fA();
  return out.join('');
}

/* ---------- Chrome: header, footer ---------- */
let heroTone = null;
function header() {
  const s = CUR.settings;
  const name = String(s.siteName || 'Devra Udaipur').trim();
  const word = name.split(/\s+/)[0], rest = name.slice(word.length).trim();
  const logo = findMedia(s.logo);
  const book = safeUrl(s.bookingUrl);
  const isAdmin = PAGE === 'home' && route.admin;
  const cur = PAGE === 'post' ? 'journal' : PAGE;
  const brand = logo && (logo.assetId || logo.file)
    ? '<span class="logo-plate"><img class="brand-logo" src="' + esc(assetSrc(logo)) + '" alt="' + esc(name) + '"></span>'
    : '<span class="brand-text"><span class="brand-word">' + esc(word) + '</span>' + (rest ? '<span class="brand-place">' + esc(rest) + '</span>' : '') + '</span>';
  return '<header class="site-head' + (heroTone ? ' is-over tone-' + heroTone : '') + '" id="site-head"><div class="wrap head-row">' +
    '<a class="brand" href="' + LINKS.home + '"' + (IS_INDEX && !isAdmin ? ' data-act="to-top"' : '') + ' aria-label="' + esc(name) + ' home">' + brand + '</a>' +
    '<nav id="site-nav" class="site-nav" aria-label="Main">' + NAV.map(([k, l]) => '<a href="' + LINKS[k] + '"' + (cur === k && !isAdmin ? ' aria-current="page"' : '') + '>' + l + '</a>').join('') + '</nav>' +
    '<div class="head-actions">' +
    (isAdmin ? '<button type="button" class="btn btn--ghost btn--sm" data-act="leave-admin">View site</button>'
      : (book ? '<a class="btn btn--primary btn--sm" href="' + esc(book) + '" target="_blank" rel="noopener">Reserve now</a>' : '') +
        (safeUrl((s.socials || {}).instagram) ? '<a class="ig-link" href="' + esc(safeUrl(s.socials.instagram)) + '" target="_blank" rel="noopener" aria-label="' + esc(name) + ' on Instagram">' + icon('instagram') + '</a>' : '')) +
    '<button class="menu-btn" type="button" data-act="menu" aria-expanded="false" aria-controls="site-nav">Menu</button>' +
    '</div></div></header>';
}
function footer() {
  const s = CUR.settings, soc = s.socials || {};
  const logo = findMedia(s.logo);
  const socials = Object.keys(SOCIAL_NAMES).filter(k => safeUrl(soc[k])).map(k => '<li><a href="' + esc(safeUrl(soc[k])) + '" target="_blank" rel="noopener">' + SOCIAL_NAMES[k] + '</a></li>').join('');
  const phones = [s.phonePrimary].concat(s.phonesOther || []).filter(Boolean);
  return '<footer class="site-foot"><div class="wrap foot-grid">' +
    '<div>' + (logo && (logo.assetId || logo.file) ? '<span class="logo-plate logo-plate--foot"><img class="foot-logo" src="' + esc(assetSrc(logo)) + '" alt="' + esc(s.siteName) + '" loading="lazy"></span>' : '<p class="foot-brand">' + esc(s.siteName || 'Devra Udaipur') + '</p>') +
    '<p>' + esc(s.footerAbout) + '</p>' + (socials ? '<ul class="socials">' + socials + '</ul>' : '') + '</div>' +
    '<div><h3>Explore</h3><ul><li><a href="' + LINKS.home + '">Home</a></li>' + NAV.map(([k, l]) => '<li><a href="' + LINKS[k] + '">' + l + '</a></li>').join('') + '<li><a href="' + LINKS.luxury + '">Luxury homestay in Udaipur</a></li></ul></div>' +
    '<div><h3>Contact</h3><address>' + esc(s.address).replace(/\n/g, '<br>') + '</address>' + phones.map(copyRow).join('') + (s.email ? copyRow(s.email) : '') + '</div>' +
    '</div><div class="wrap foot-base"><span>© ' + new Date().getFullYear() + ' ' + esc(s.siteName || 'Devra Udaipur') + '. All rights reserved.</span>' + (STATE.static ? '' : '<a href="' + adminUrl() + '">Admin</a>') + '</div></footer>';
}
function copyRow(v) { return '<p class="copy-row"><span class="copy-val">' + esc(v) + '</span><button type="button" class="copy-btn" data-act="copy" data-copy="' + esc(v) + '">Copy</button></p>'; }
function floatCta() { return PAGE === 'contact' ? '' : '<a class="float-cta" href="' + LINKS.contact + '"><span class="pulse" aria-hidden="true"></span>Enquire</a>'; }
function previewRibbon() {
  return '<div class="ribbon"><div class="wrap"><span><strong>Preview of the home page.</strong> You are seeing unpublished changes. Visitors still see the published site.</span><div class="btn-row">' +
    '<button type="button" class="btn btn--sm btn--ghost" data-act="stop-preview">Back to admin</button><button type="button" class="btn btn--sm btn--primary" data-act="publish">Publish changes</button></div></div></div>';
}

/* ---------- Heroes ---------- */
function homeHero() {
  const s = CUR.settings;
  const book = safeUrl(s.bookingUrl);
  const slides = (s.heroSlides || []).filter(x => hasPhoto(x.photo));
  heroTone = slides.length ? 'photo' : 'art';
  const caption = sl => sl.caption || ((findMedia(sl.photo) || {}).caption) || '';
  const bg = slides.length
    ? '<div class="hero-slides" data-slider>' + slides.map((sl, i) => '<div class="slide' + (i === 0 ? ' is-on' : '') + '" data-cap="' + esc(caption(sl)) + '">' + pic(sl.photo, { eager: i === 0 }) + '</div>').join('') + '</div><div class="hero-shade"></div>'
    : '<canvas class="hero-art" data-birds="7" aria-hidden="true"></canvas>';
  const foot = slides.length > 1 ? '<div class="hero-foot"><p class="slide-cap" id="slide-cap">' + esc(caption(slides[0])) + '</p><div class="dots">' +
    slides.map((sl, i) => '<button type="button" class="dot' + (i === 0 ? ' is-on' : '') + '" data-act="slide" data-i="' + i + '" aria-label="Show photo ' + (i + 1) + '"><span></span></button>').join('') + '</div></div>' : '';
  return '<section class="hero hero--home hero--center hero--' + heroTone + '" aria-labelledby="hero-title">' + bg +
    '<div class="wrap hero-content"><p class="eyebrow fade-in">' + esc(s.tagline) + '</p><h1 id="hero-title" class="rise">' + rise(s.heroTitle, true) + '</h1>' +
    '<p class="hero-sub fade-in">' + esc(s.heroSubtitle) + '</p><div class="btn-row fade-in">' +
    (book ? '<a class="btn btn--primary" href="' + esc(book) + '" target="_blank" rel="noopener">Reserve now <span class="arrow">→</span></a>' : '') +
    '<a class="btn btn--ghost" href="' + LINKS.about + '">Know more</a></div></div>' + foot +
    '<span class="scroll-cue" aria-hidden="true"></span></section>';
}
function pageHero(eyebrow, title, lead, photoId) {
  const photo = hasPhoto(photoId);
  heroTone = photo ? 'photo' : 'art';
  return '<section class="hero hero--page hero--center hero--' + heroTone + '">' +
    (photo ? '<div class="hero-slides"><div class="slide is-on">' + pic(photoId, { eager: true }) + '</div></div><div class="hero-shade"></div>' : '<canvas class="hero-art" data-birds="4" aria-hidden="true"></canvas>') +
    '<div class="wrap hero-content">' + (eyebrow ? '<p class="eyebrow fade-in">' + esc(eyebrow) + '</p>' : '') + '<h1 class="rise">' + rise(title, true) + '</h1>' + (lead ? '<p class="hero-sub fade-in">' + esc(lead) + '</p>' : '') + '</div></section>';
}
function pageHeroFor(key, fallback) {
  const p = (CUR.pages || {})[key] || {};
  return pageHero(CUR.settings.siteName || 'Devra Udaipur', p.title || fallback, p.lead, p.photo);
}

/* ---------- Sections ---------- */
function feature(key, o) {
  o = o || {};
  const x = CUR.sections[key];
  if (!x) return '';
  const items = Array.isArray(x.items) && x.items.length ? (o.chips ? '<ul class="chips stagger">' : '<ul class="ticks stagger">') + x.items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>' : '';
  let media = '';
  if ('photo' in x) {
    media = o.collage && ('photo2' in x)
      ? '<div class="collage"><div class="c1 parallax" data-reveal="scale">' + pic(x.photo, { arch: true, label: x.title }) + '</div><div class="c2" data-reveal="right">' + pic(x.photo2, { label: x.title }) + '</div>' + (o.badge ? spinBadge(o.badge) : '') + '</div>'
      : '<div class="parallax" data-reveal="scale">' + pic(x.photo, { arch: true, label: x.title }) + '</div>';
  }
  return '<section class="band feature clip' + (o.flip ? ' feature--flip' : '') + (o.soft ? ' band--soft' : '') + '" id="' + key + '">' +
    (o.watermark ? '<span class="watermark deva" aria-hidden="true">' + esc(o.watermark) + '</span>' : '') +
    '<div class="wrap feature-grid"><div class="feature-copy" data-reveal="' + (o.flip ? 'right' : 'left') + '">' +
    (x.eyebrow ? '<p class="eyebrow">' + esc(x.eyebrow) + '</p>' : '') + '<h2>' + at(x.title) + '</h2>' +
    '<div class="prose">' + paras(x.body) + '</div>' + items + (o.extra || '') +
    (o.more ? '<a class="text-link" href="' + o.more[0] + '">' + esc(o.more[1]) + ' <span class="arrow">→</span></a>' : '') + '</div>' +
    (media ? '<div class="feature-media">' + media + '</div>' : '') + '</div></section>';
}
function spinBadge(text) {
  const t = esc(text);
  return '<div class="badge-spin" aria-hidden="true"><svg viewBox="0 0 120 120"><defs><path id="badge-circle" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0"></path></defs>' +
    '<text><textPath href="#badge-circle" xlink:href="#badge-circle">' + t + '</textPath></text></svg><span class="core deva" lang="hi">देवरा</span></div>';
}
function marquee() {
  const items = (CUR.settings.marquee || []).filter(Boolean);
  if (!items.length) return '';
  const run = items.map(t => '<span>' + esc(t) + '</span><i></i>').join('');
  return '<div class="marquee" aria-label="' + esc(items.join(', ')) + '"><div class="marquee-track" aria-hidden="true">' + run + run + '</div></div>';
}
function photoBand(key, o) {
  o = o || {};
  const x = CUR.sections[key];
  if (!x) return '';
  const book = safeUrl(CUR.settings.bookingUrl);
  return '<section class="photo-band">' + pic(x.photo, { label: x.title }) + '<div class="wrap"><div class="photo-band-copy" data-reveal="left">' +
    (x.eyebrow ? '<p class="eyebrow">' + esc(x.eyebrow) + '</p>' : '') + '<h2>' + at(x.title) + '</h2><p>' + esc(o.full ? x.body : firstPara(x.body)) + '</p>' +
    '<div class="btn-row">' + (book ? '<a class="btn btn--haldi" href="' + esc(book) + '" target="_blank" rel="noopener">Book your stay <span class="arrow">→</span></a>' : '') +
    (o.more ? '<a class="btn btn--light" href="' + o.more[0] + '">' + esc(o.more[1]) + '</a>' : '') + '</div></div></div></section>';
}
function tallCards() {
  const keys = [['home_stay', LINKS.stay, 'See the stay'], ['home_cuisine', LINKS.experiences, 'Food at Devra'], ['home_room', LINKS.stay + '#stay_rooms', 'See the rooms']];
  const book = safeUrl(CUR.settings.bookingUrl);
  return '<section class="band band--soft"><div class="wrap"><div class="sec-head" data-reveal><div><p class="eyebrow">Stay with us</p><h2>Heritage, nature and home-cooked <em class="ital">food</em></h2></div>' +
    (book ? '<a class="text-link" href="' + esc(book) + '" target="_blank" rel="noopener">Check availability <span class="arrow">→</span></a>' : '') + '</div><div class="cards3 stagger">' +
    keys.filter(k => CUR.sections[k[0]]).map(([k, href, label]) => {
      const x = CUR.sections[k];
      return '<a class="tall" href="' + href + '">' + pic(x.photo, { label: x.title }) + '<div class="tall-body"><p class="eyebrow">' + esc(x.eyebrow) + '</p><h3>' + esc(x.title) + '</h3><p>' + esc(x.body) + '</p><span class="more">' + label + ' <span class="arrow">→</span></span></div></a>';
    }).join('') + '</div></div></section>';
}
function expCard(e) { return '<article class="exp card">' + pic(e.photo, { arch: true, label: e.title }) + '<div class="card-body"><h3>' + esc(e.title) + '</h3><p>' + esc(e.text) + '</p></div></article>'; }
function expRail(title) {
  const exps = CUR.experiences || [];
  if (!exps.length) return '';
  return '<section class="band"><div class="wrap"><div class="sec-head" data-reveal><div><p class="eyebrow">Experiences</p><h2>' + at(title) + '</h2></div>' +
    '<div class="rail-btns"><button type="button" class="round" data-act="rail" data-dir="-1" aria-label="Previous">←</button><button type="button" class="round" data-act="rail" data-dir="1" aria-label="Next">→</button></div></div>' +
    '<div class="rail-wrap"><div class="rail" id="exp-rail" tabindex="0" aria-label="Experiences">' + exps.map(expCard).join('') + '</div></div>' +
    '<p style="margin-top:22px"><a class="text-link" href="' + LINKS.experiences + '">All experiences <span class="arrow">→</span></a></p></div></section>';
}
/* Illustrated scenes for places that have no photo yet (admin can add a photo any time) */
function sceneSvg(kind, uid) {
  const g = 'sg-' + uid;
  const sky = '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F5DCD2"/><stop offset=".62" stop-color="#F8EFE6"/><stop offset="1" stop-color="#F8F5EF"/></linearGradient></defs><rect width="400" height="250" fill="url(#' + g + ')"/>';
  const sun = '<circle class="sc-sun" cx="300" cy="92" r="30" fill="#E9A18C"/>';
  const hills = '<path d="M0 150 C60 112 110 120 160 138 C210 156 250 108 300 112 C340 116 370 132 400 126 V190 H0Z" fill="#C9CFBC"/><path d="M0 168 C70 150 130 160 200 166 C270 172 330 150 400 158 V200 H0Z" fill="#AEB79C"/>';
  const water = '<rect y="176" width="400" height="74" fill="#D9E0D2"/><g class="sc-ripple" stroke="#B4BFA6" stroke-width="2" stroke-linecap="round"><path d="M20 196h50M120 206h70M250 194h60M330 214h40M60 226h80M200 232h60"/></g><g stroke="#E9A18C" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M282 186h36M288 198h24M294 210h12"/></g>';
  const palace = (x, y, w) => '<g fill="#F4EFE4" stroke="#45483F" stroke-width="1.6" stroke-linejoin="round"><rect x="' + x + '" y="' + (y - 34) + '" width="' + w + '" height="34"/><rect x="' + (x + w * .3) + '" y="' + (y - 58) + '" width="' + (w * .4) + '" height="24"/>' +
    '<path d="M' + (x + w * .5 - 14) + ' ' + (y - 58) + ' q14 -26 28 0z"/><path d="M' + (x + 4) + ' ' + (y - 34) + ' q10 -18 20 0z"/><path d="M' + (x + w - 24) + ' ' + (y - 34) + ' q10 -18 20 0z"/></g>' +
    '<g fill="#45483F" opacity=".75">' + [0, 1, 2, 3, 4].map(i => '<rect x="' + (x + 8 + i * (w - 16) / 5) + '" y="' + (y - 24) + '" width="' + ((w - 16) / 5 - 6) + '" height="14" rx="6"/>').join('') + '</g>';
  const reflect = (x, y, w) => '<g opacity=".28" transform="translate(0 ' + (2 * y) + ') scale(1 -1)">' + palace(x, y, w) + '</g>';
  const boat = '<g class="sc-boat"><path d="M150 214 q30 12 60 0 l-6 8 h-48z" fill="#45483F"/><path d="M176 214 v-22 l16 18z" fill="#B94736"/></g>';
  const temple = (x, base, h) => '<g fill="#F4EFE4" stroke="#45483F" stroke-width="1.6" stroke-linejoin="round"><path d="M' + (x - 30) + ' ' + base + ' v-28 h60 v28z"/><path d="M' + (x - 22) + ' ' + (base - 28) + ' C' + (x - 22) + ' ' + (base - h * .55) + ' ' + (x - 8) + ' ' + (base - h) + ' ' + x + ' ' + (base - h - 6) + ' C' + (x + 8) + ' ' + (base - h) + ' ' + (x + 22) + ' ' + (base - h * .55) + ' ' + (x + 22) + ' ' + (base - 28) + 'z"/><path d="M' + (x - 10) + ' ' + base + ' v-16 q10 -12 20 0 v16" fill="#45483F" opacity=".7"/></g>' +
    '<path class="sc-flag" d="M' + x + ' ' + (base - h - 6) + ' v-16 l14 5 -14 5" fill="#B94736" stroke="#45483F" stroke-width="1.2"/>';
  const steps = '<g fill="#E7E1D4" stroke="#45483F" stroke-width="1.2"><rect x="120" y="196" width="160" height="10"/><rect x="104" y="206" width="192" height="10"/><rect x="88" y="216" width="224" height="10"/></g>';
  const trees = '<g fill="#8A9378"><circle cx="40" cy="176" r="22"/><circle cx="66" cy="184" r="16"/><circle cx="352" cy="178" r="20"/><circle cx="378" cy="186" r="15"/></g>';
  let body;
  if (kind === 'lakepalace') body = sun + hills + water + palace(140, 186, 120) + reflect(140, 186, 120) + '<path d="M120 188h160" stroke="#45483F" stroke-width="1.6"/>';
  else if (kind === 'lake') body = sun + hills + water + palace(10, 176, 130) + boat;
  else if (kind === 'temple') body = sun + hills + '<rect y="186" width="400" height="64" fill="#EFE9DD"/>' + trees + temple(200, 196, 120) + steps;
  else if (kind === 'temples') body = sun + hills + '<rect y="186" width="400" height="64" fill="#EFE9DD"/>' + trees + temple(130, 200, 74) + temple(270, 200, 74) + temple(200, 196, 116) + steps;
  else body = sun + hills + water;
  return '<svg class="scene" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + sky + body + '</svg>';
}
function placeArt(p) {
  const n = String(p.name || '').toLowerCase();
  const kind = /lake palace/.test(n) ? 'lakepalace' : /lake|sagar|pichola/.test(n) ? 'lake' : /eklingji/.test(n) ? 'temples' : /temple/.test(n) ? 'temple' : 'land';
  return '<span class="pic place-art" role="img" aria-label="' + esc('Illustration of ' + p.name) + '">' + sceneSvg(kind, p.id || kind) + '</span>';
}
function placeCard(p) { return '<article class="place card">' + (hasPhoto(p.photo) ? pic(p.photo, { label: p.name, cat: 'Udaipur' }) : placeArt(p)) + '<div class="card-body"><div class="place-title"><h3>' + esc(p.name) + '</h3>' + (p.distance ? '<span class="dist">' + esc(p.distance) + '</span>' : '') + '</div><p>' + esc(p.text) + '</p></div></article>'; }
function postCard(p) {
  return '<article class="post-card card"><a class="post-card-link" href="' + postUrl(esc(p.slug)) + '">' + pic(p.cover, { label: p.title }) +
    '<div class="card-body"><p class="meta">' + esc(p.category) + ' · <time datetime="' + esc(p.date) + '">' + fmtDate(p.date) + '</time></p><h3>' + esc(p.title) + '</h3><p>' + esc(p.excerpt) + '</p><span class="text-link">Read the story <span class="arrow">→</span></span></div></a></article>';
}
function galleryItems(src) {
  const all = (src.media || []).filter(m => m.showInGallery !== false);
  const withPhotos = all.filter(m => m.assetId);
  return withPhotos.length ? withPhotos : all.filter(m => m.caption);
}
function galleryButtons(items, set) {
  LB_SETS[set] = items.map(m => m.id);
  return items.map((m, i) => '<button type="button" class="g-item" data-act="lightbox" data-set="' + set + '" data-i="' + i + '" aria-label="Open photo: ' + esc(m.caption || 'Photo') + '">' + pic(m, { natural: set === 'gallery' }) + (m.caption ? '<span class="g-cap">' + esc(m.caption) + '</span>' : '') + '</button>').join('');
}
function mosaicBand() {
  const items = galleryItems(CUR);
  let feat = items.filter(m => m.featured);
  if (feat.length < 5) feat = feat.concat(items.filter(m => !m.featured)).slice(0, 5);
  feat = feat.slice(0, 5).sort((a, b) => (a.rank || 99) - (b.rank || 99));
  if (!feat.length) return '';
  return '<section class="band band--soft"><div class="wrap"><div class="sec-head" data-reveal><div><p class="eyebrow">Gallery</p><h2>A look around <em class="ital">Devra</em></h2></div><a class="text-link" href="' + LINKS.gallery + '">See all photos <span class="arrow">→</span></a></div>' +
    '<div class="mosaic stagger">' + galleryButtons(feat, 'home') + '</div></div></section>';
}
const NOTE_TILT = [-2.2, 1.6, -1.1, 2.3, -1.7, 1.2, -2.6, 0.9];
function noteCard(x, i, scanIndex) {
  const tilt = ' style="--tilt:' + NOTE_TILT[i % NOTE_TILT.length] + 'deg"';
  const meta = [x.source, x.date].filter(Boolean).join(' · ');
  const who = '<figcaption class="note-who"><span class="hand">' + esc(x.name || 'A guest') + '</span>' + (x.from || meta ? '<small>' + esc([x.from, meta].filter(Boolean).join(' · ')) + '</small>' : '') + '</figcaption>';
  if (scanIndex >= 0) {
    return '<figure class="note note--scan"' + tilt + '><span class="tape" aria-hidden="true"></span><button type="button" class="note-open" data-act="lightbox" data-set="notes" data-i="' + scanIndex + '" aria-label="Read the handwritten note from ' + esc(x.name || 'a guest') + '">' +
      pic(x.photo, { natural: true, label: 'Handwritten note from ' + (x.name || 'a guest') }) + '</button>' + (x.quote ? '<blockquote class="sr">' + esc(x.quote) + '</blockquote>' : '') + who + '</figure>';
  }
  return '<figure class="note"' + tilt + '><span class="tape" aria-hidden="true"></span><blockquote class="hand">' + esc(x.quote).replace(/\n/g, '<br>') + '</blockquote>' + who + '</figure>';
}
function reviewsBand() {
  const r = (CUR.reviews || []).filter(x => x && (x.quote || hasPhoto(x.photo)));
  const ta = safeUrl((CUR.settings.socials || {}).tripadvisor);
  if (!r.length) {
    if (!ta) return '';
    return '<section class="band band--tight"><div class="wrap cta-row" data-reveal><div><p class="eyebrow">Guest reviews</p><h2>Read what guests say about <em class="ital">Devra</em></h2><p class="muted">Reviews from travellers who have stayed with us are on TripAdvisor.</p></div>' +
      '<a class="btn btn--ghost" href="' + esc(ta) + '" target="_blank" rel="noopener">Read reviews on TripAdvisor <span class="arrow">→</span></a></div></section>';
  }
  const scans = r.filter(x => hasPhoto(x.photo));
  LB_SETS.notes = scans.map(x => x.photo);
  return '<section class="band guestbook" id="guestbook"><div class="wrap">' + shead('Testimonials', 'Notes from our guest book', 'Written by hand by guests before they left Devra.') +
    '<div class="notes stagger">' + r.map((x, i) => noteCard(x, i, scans.indexOf(x))).join('') + '</div>' +
    (ta ? '<div class="center-row"><a class="btn btn--ghost" href="' + esc(ta) + '" target="_blank" rel="noopener">More reviews on TripAdvisor <span class="arrow">→</span></a></div>' : '') + '</div></section>';
}
function journalBand() {
  const posts = publishedPosts().slice(0, 3);
  if (!posts.length) return '';
  return '<section class="band blog-band"><div class="wrap">' + shead('Blog', 'Stories from the hillock', 'News, recipes and travel notes from Devra, written by the family.') + '<div class="posts stagger">' + posts.map(postCard).join('') + '</div>' +
    '<div class="center-row"><a class="btn btn--ghost" href="' + LINKS.journal + '">Read the blog <span class="arrow">→</span></a></div></div></section>';
}
function instaBand() {
  const ig = safeUrl((CUR.settings.socials || {}).instagram);
  if (!ig) return '';
  const handle = '@' + (ig.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() || 'devraudaipur');
  const items = galleryItems(CUR).filter(m => m.assetId || m.file).slice(6, 12);
  if (!items.length) return '';
  return '<section class="insta-band"><div class="wrap"><div class="insta-head" data-reveal><div><p class="eyebrow">Follow along</p><h2>' + at('Devra on Instagram') + '</h2></div><a class="btn btn--primary" href="' + esc(ig) + '" target="_blank" rel="noopener">' + icon('instagram') + ' ' + esc(handle) + '</a></div>' +
    '<div class="insta-grid stagger">' + items.map(m => '<a class="insta-item" href="' + esc(ig) + '" target="_blank" rel="noopener" aria-label="' + esc((m.caption || 'Photo') + ', more on Instagram') + '">' + pic(m, {}) + '<span class="insta-over" aria-hidden="true">' + icon('instagram') + '</span></a>').join('') + '</div></div></section>';
}
function roomsGallery() {
  const rooms = (CUR.media || []).filter(m => (m.assetId || m.file) && String(m.category || '').toLowerCase() === 'rooms' && m.showInGallery !== false).slice(0, 9);
  if (rooms.length < 3) return '';
  return '<section class="band band--soft" id="inside-rooms"><div class="wrap">' + shead('Inside the rooms', 'Eight rooms, each with its own character', 'King-size or twin beds, block-printed linen, handpicked art and big windows onto the green.') +
    '<div class="room-mosaic stagger">' + galleryButtons(rooms, 'rooms') + '</div><div class="center-row"><a class="btn btn--ghost" href="' + LINKS.gallery + '">See all photos <span class="arrow">→</span></a></div></div></section>';
}
function routeSvg(stops, vertical) {
  const n = stops.length;
  let pts, vb;
  if (!vertical) {
    vb = '0 0 780 300';
    pts = [[60, 196]].concat(stops.map((s, i) => [200 + i * (500 / Math.max(1, n - 1)), i % 2 ? 196 : 120]));
  } else {
    vb = '0 0 340 ' + (110 + n * 112);
    pts = [[60, 60]].concat(stops.map((s, i) => [i % 2 ? 60 : 110, 172 + i * 112]));
  }
  let d = 'M' + pts[0][0] + ',' + pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if (!vertical) { const mx = (x0 + x1) / 2; d += ' C' + mx + ',' + y0 + ' ' + mx + ',' + y1 + ' ' + x1 + ',' + y1; }
    else { const my = (y0 + y1) / 2; d += ' C' + x0 + ',' + my + ' ' + x1 + ',' + my + ' ' + x1 + ',' + y1; }
  }
  const pid = vertical ? 'route-v-path' : 'route-h-path';
  const hill = !vertical ? '<path class="r-hill" d="M0,260 C40,190 90,170 130,215 C150,236 170,250 200,260 Z"></path>' : '<path class="r-hill" d="M0,120 C30,40 90,30 130,95 C140,110 150,120 160,120 Z"></path>';
  const label = (x, y, a, b, anchor, dy) => '<g class="r-stop"><circle class="r-node" cx="' + x + '" cy="' + y + '" r="8"></circle>' +
    '<text class="r-dist" x="' + (anchor === 'start' ? x + 22 : x) + '" y="' + (y + dy) + '" text-anchor="' + anchor + '">' + esc(b) + '</text>' +
    '<text class="r-label" x="' + (anchor === 'start' ? x + 22 : x) + '" y="' + (y + dy + (dy < 0 ? -26 : 22)) + '" text-anchor="' + anchor + '">' + esc(a) + '</text></g>';
  let marks = '<g class="r-stop"><circle class="r-home" cx="' + pts[0][0] + '" cy="' + pts[0][1] + '" r="13"></circle>' +
    '<text class="r-label" x="' + (vertical ? pts[0][0] + 26 : pts[0][0]) + '" y="' + (vertical ? pts[0][1] + 5 : pts[0][1] + 36) + '" text-anchor="' + (vertical ? 'start' : 'middle') + '">Devra</text></g>';
  stops.forEach((s, i) => {
    const [x, y] = pts[i + 1];
    marks += vertical ? label(x, y, s.label, s.value, 'start', 8) : label(x, y, s.label, s.value, 'middle', i % 2 ? 46 : -26);
  });
  return '<svg class="route-svg ' + (vertical ? 'route-v' : 'route-h') + '" viewBox="' + vb + '" role="img" aria-label="Distances from Devra: ' + esc(stops.map(s => s.label + ' ' + s.value).join(', ')) + '">' + hill +
    '<path class="r-base" d="' + d + '"></path><path class="r-path" id="' + pid + '" d="' + d + '" pathLength="1"></path>' + marks +
    (RM.matches ? '' : '<circle class="r-car" r="7"><animateMotion dur="7s" repeatCount="indefinite" rotate="auto"><mpath href="#' + pid + '"></mpath></animateMotion></circle>') + '</svg>';
}
function routeBand() {
  const s = CUR.settings;
  const maps = safeUrl(s.mapsUrl);
  const stops = (s.reach || []).filter(r => r.label || r.value);
  return '<section class="band" id="reach"><div class="wrap route-grid"><div data-reveal="left"><p class="eyebrow">How to reach</p><h2>Close to the city, away from the <em class="ital">noise</em></h2>' +
    '<address>' + esc(s.address).replace(/\n/g, '<br>') + '</address><div class="btn-row">' + (maps ? '<a class="btn btn--ghost" href="' + esc(maps) + '" target="_blank" rel="noopener">Open in Google Maps <span class="arrow">↗</span></a>' : '') +
    '<a class="btn btn--quiet" href="' + LINKS.contact + '">Contact us</a></div></div>' +
    '<div class="route-card">' + (stops.length ? routeSvg(stops, false) + routeSvg(stops, true) : '') + '</div></div></section>';
}
function bookBand() {
  const s = CUR.settings;
  const book = safeUrl(s.bookingUrl);
  return '<section class="band band--ink book-band"><span class="sun-glow" aria-hidden="true"></span><div class="wrap" data-reveal><p class="eyebrow">Book your stay</p><h2>' + at(s.ctaTitle || 'Your room on the hillock is waiting') + '</h2>' +
    (s.ctaText ? '<p>' + esc(s.ctaText) + '</p>' : '') + '<div class="btn-row">' + (book ? '<a class="btn btn--haldi" href="' + esc(book) + '" target="_blank" rel="noopener">Make a reservation <span class="arrow">→</span></a>' : '') +
    '<a class="btn btn--light" href="' + LINKS.contact + '">Send an enquiry</a></div></div></section>';
}
function quoteBand() {
  return '<section class="band band--ink quote-band"><div class="wrap" data-reveal><blockquote><span class="deva" lang="hi">अतिथि देवो भव</span>Guests are gods.</blockquote><cite>Atithi Devo Bhava, the core value of Indian hospitality that Devra lives by</cite></div></section>';
}
function emptyState(title, text, action) { return '<div class="empty"><h3>' + esc(title) + '</h3><p class="muted">' + esc(text) + '</p>' + (action || '') + '</div>'; }

/* ---------- Pages ---------- */
function factHtml(f) {
  const m = String(f.value || '').trim().match(/^([0-9][0-9.,–\-]*°?\+?)\s*(.*)$/);
  const num = m ? m[1] : String(f.value || ''), unit = m ? m[2] : '';
  const countable = /^\d+°?$/.test(num);
  return '<li><span class="fact-v"><span class="fact-num"' + (countable ? ' data-count="' + esc(num) + '"' : '') + '>' + esc(num) + '</span>' + (unit ? '<span class="fact-unit">' + esc(unit) + '</span>' : '') + '</span><span class="fact-l">' + esc(f.label) + '</span></li>';
}
function firstSentence(t, max) {
  max = max || 170;
  const p = firstPara(t).trim();
  const m = p.match(/^.{40,}?[.!?](?=\s|$)/);
  let out = m ? m[0].trim() : p;
  if (out.length > max) out = out.slice(0, max - 3).replace(/[\s,;:]+\S*$/, '') + '…';
  return out;
}
function sec(k) { return (CUR.sections || {})[k] || null; }
/* Home, structured like the reference: welcome → numbered features → rooms & spaces → dining → amenities → nearby gems */
function welcomeBand() {
  const s = CUR.settings, x = sec('home_about');
  if (!x) return '';
  const tour = safeUrl(s.tourUrl);
  const stats = (s.facts || []).length ? '<ul class="stats stagger" id="facts">' + s.facts.map(factHtml).join('') + '</ul>' : '';
  return '<section class="band welcome" id="home_about"><div class="wrap"><div class="welcome-in" data-reveal>' + (x.eyebrow ? '<p class="eyebrow">' + esc(x.eyebrow) + '</p>' : '') + '<h2>' + at(x.title) + '</h2>' + ornament() +
    '<div class="prose">' + paras(x.body) + '</div><div class="btn-row"><a class="btn btn--primary" href="' + LINKS.about + '">Know more <span class="arrow">→</span></a>' +
    (tour ? '<a class="btn btn--ghost" href="' + esc(tour) + '" target="_blank" rel="noopener">Watch the virtual tour</a>' : '') + '</div></div>' + stats + '</div></section>';
}
const NROW_LINKS = { home_f1: ['stay', 'Explore the stay'], home_f2: ['udaipur', 'Explore Udaipur'], home_f3: ['experiences', 'Food & experiences'], home_f4: ['about', 'About Devra'] };
function numberedRows() {
  const keys = ['home_f1', 'home_f2', 'home_f3', 'home_f4'].filter(k => sec(k));
  if (!keys.length) return '';
  return '<section class="band band--soft"><div class="wrap">' + shead('Devra Udaipur', 'Heritage, nature and home', '') + '<div class="nrows">' + keys.map((k, i) => {
    const x = sec(k), l = NROW_LINKS[k], f = i % 2;
    const pm = findMedia(x.photo), wide = !!(pm && pm.w && pm.h && pm.w > pm.h * 1.12);
    return '<article class="nrow' + (f ? ' nrow--flip' : '') + (wide ? ' nrow--wide' : '') + '" id="' + k + '"><div class="nrow-media" data-reveal="' + (f ? 'right' : 'left') + '">' + pic(x.photo, { label: x.title }) + '</div>' +
      '<div class="nrow-copy" data-reveal="' + (f ? 'left' : 'right') + '"><span class="nnum" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span>' + (x.eyebrow ? '<p class="eyebrow">' + esc(x.eyebrow) + '</p>' : '') + '<h3>' + esc(x.title) + '</h3>' + paras(x.body) +
      (l ? '<a class="btn btn--ghost" href="' + LINKS[l[0]] + '">' + esc(l[1]) + ' <span class="arrow">→</span></a>' : '') + '</div></article>';
  }).join('') + '</div></div></section>';
}
function spacesGrid() {
  const items = [['home_room', LINKS.stay + '#stay_rooms', 'See the rooms'], ['stay_leisure', LINKS.stay + '#stay_leisure', 'See the lounges'], ['home_stay', LINKS.stay, 'Explore the estate'], ['stay_perfect', LINKS.stay + '#stay_perfect', 'Plan your stay']].filter(k => sec(k[0]));
  if (!items.length) return '';
  const pg = (CUR.pages || {}).stay || {};
  return '<section class="band"><div class="wrap">' + shead('The stay', 'Rooms and spaces', pg.lead) + '<div class="suites stagger">' + items.map(([k, href, label]) => {
    const x = sec(k);
    return '<a class="suite" href="' + href + '">' + pic(x.photo, { label: x.title }) + '<div class="suite-body">' + (x.eyebrow ? '<p class="eyebrow">' + esc(x.eyebrow) + '</p>' : '') + '<h3>' + esc(x.title) + '</h3><p>' + esc(firstSentence(x.body, 120)) + '</p><span class="more">' + label + ' <span class="arrow">→</span></span></div></a>';
  }).join('') + '</div></div></section>';
}
function diningSplit() {
  const x = sec('home_cuisine');
  if (!x) return '';
  const sub = (sec('exp_culinary') || {}).title || '';
  return '<section class="band band--soft"><div class="wrap split"><div class="split-media" data-reveal="left">' + pic(x.photo, { arch: true, label: x.title }) +
    (x.photo2 && hasPhoto(x.photo2) ? '<div class="inset">' + pic(x.photo2, { label: x.title }) + '</div>' : '') + '</div>' +
    '<div class="split-copy" data-reveal="right">' + (x.eyebrow ? '<p class="eyebrow">' + esc(x.eyebrow) + '</p>' : '') + '<h2>' + at(x.title) + '</h2>' + (sub ? '<p class="sub">' + esc(sub) + '</p>' : '') + ornament('ornament--left') +
    '<div class="prose">' + paras(x.body) + '</div><a class="btn btn--primary" href="' + LINKS.experiences + '">Discover more <span class="arrow">→</span></a></div></div></section>';
}
function amenitiesBand() {
  const x = sec('stay_facilities');
  if (!x) return '';
  const items = (x.items || []).filter(Boolean);
  const feat = galleryItems(CUR).filter(m => m.featured).sort((a, b) => (a.rank || 99) - (b.rank || 99)).slice(0, 4);
  return '<section class="band"><div class="wrap">' + shead(x.eyebrow || 'Amenities', x.title, firstSentence(x.body)) +
    (items.length ? '<ul class="amen stagger">' + items.map(t => '<li><span class="ico">' + icon(amenityIcon(t)) + '</span><span>' + esc(t) + '</span></li>').join('') + '</ul>' : '') +
    '<div class="amen-foot"><a class="text-link" href="' + LINKS.stay + '#stay_facilities">Learn more <span class="arrow">→</span></a></div>' +
    (feat.length ? '<div class="strip stagger">' + galleryButtons(feat, 'home') + '</div>' : '') + '</div></section>';
}
function gemsBand() {
  const all = CUR.places || [];
  if (!all.length) return '';
  const seen = {}, pick = [];
  all.forEach(p => { const k = placeIcon(p.name); if (!seen[k] && pick.length < 4) { seen[k] = 1; pick.push(p); } });
  all.forEach(p => { if (pick.length < 4 && pick.indexOf(p) < 0) pick.push(p); });
  return '<section class="band band--soft"><div class="wrap">' + shead('Local attractions', 'Historic gems around Devra', '') + '<div class="gems stagger">' +
    pick.map(p => '<a class="gem" href="' + LINKS.udaipur + '"><span class="ico">' + icon(placeIcon(p.name)) + '</span><h3>' + esc(p.name) + '</h3>' + (p.distance ? '<span class="dist">' + esc(p.distance) + '</span>' : '') + '<p>' + esc(p.text) + '</p></a>').join('') +
    '</div><div class="center-row"><a class="btn btn--ghost" href="' + LINKS.udaipur + '">Explore Udaipur <span class="arrow">→</span></a></div></div></section>';
}
function viewHome() {
  return homeHero() + storiesStrip() + welcomeBand() + numberedRows() + photoBand('home_aerial', { full: true, more: [LINKS.gallery, 'See the gallery'] }) + spacesGrid() + diningSplit() + amenitiesBand() + marquee() + gemsBand() + reviewsBand() + journalBand() + instaBand() + bookBand();
}
function viewAbout() { return pageHeroFor('about', 'About Devra') + feature('about_devra', { collage: true, badge: 'Atithi Devo Bhava · Guests are gods · ', watermark: 'देवरा' }) + quoteBand() + feature('about_hosts', { flip: true, soft: true }) + routeBand() + bookBand(); }
function viewStay() {
  const book = safeUrl(CUR.settings.bookingUrl);
  const cta = book ? '<div class="btn-row"><a class="btn btn--primary" href="' + esc(book) + '" target="_blank" rel="noopener">Book a room <span class="arrow">→</span></a></div>' : '';
  return pageHeroFor('stay', 'The stay') + feature('stay_leisure', { collage: true }) + feature('stay_rooms', { flip: true, soft: true, extra: cta }) + roomsGallery() + photoBand('stay_band', { full: true }) +
    feature('stay_facilities') + feature('stay_perfect', { flip: true, soft: true, chips: true }) + feature('home_cuisine', { more: [LINKS.experiences, 'More about our food'] }) + bookBand();
}
/* Experiences, structured like padmaajaipur.com/experiences: title + tagline + intro + photos → personalised list → tailor-made → location → outings → editorial rows */
function viewExperiences() {
  heroTone = null;
  const s = CUR.settings, pg = (CUR.pages || {}).experiences || {};
  const x = sec('exp_intro') || {};
  const third = (sec('exp_culinary') || {}).photo;
  const ehero = '<section class="ehero"><div class="wrap"><p class="eyebrow fade-in">' + esc(s.siteName || 'Devra Udaipur') + '</p><h1 class="rise">' + rise(pg.title || 'Experiences') + '</h1>' +
    (pg.lead ? '<p class="tagline fade-in">' + esc(pg.lead) + '</p>' : '') + ornament() + '<div class="prose fade-in">' + paras(firstPara(x.body)) + '</div>' +
    '<div class="ehero-media"><div class="m-side" data-reveal="left">' + pic(x.photo2, { label: 'Life at Devra' }) + '</div><div class="m-main fade-in">' + pic(x.photo, { eager: true, label: x.title || 'Experiences' }) + '</div><div class="m-side" data-reveal="right">' + pic(third, { label: 'Food at Devra' }) + '</div></div></div></section>';
  const exps = CUR.experiences || [];
  const cards = exps.length ? '<section class="band band--soft"><div class="wrap">' + shead('Personalised experiences', 'Ways to spend your days', x.title) + '<div class="tcards stagger">' +
    exps.map((e, i) => '<article class="tcard"><span class="tnum">' + String(i + 1).padStart(2, '0') + '</span><h3>' + esc(e.title) + '</h3><p>' + esc(e.text) + '</p></article>').join('') + '</div></div></section>' : '';
  const t = sec('stay_perfect');
  const tailor = t ? '<section class="band tailor"><div class="wrap" data-reveal><p class="eyebrow">Tailor-made stays</p><h2>' + at(t.title) + '</h2>' + ornament() + '<div class="prose">' + paras(t.body) + '</div>' +
    (t.items && t.items.length ? '<ul class="chips">' + t.items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>' : '') + '<div class="btn-row"><a class="btn btn--primary" href="' + LINKS.contact + '">Plan your stay <span class="arrow">→</span></a></div></div></section>' : '';
  const l = sec('home_f2'), reach = (s.reach || []).filter(r => r.label || r.value), maps = safeUrl(s.mapsUrl);
  const loc = l ? '<section class="band band--soft"><div class="wrap loc"><div class="loc-head" data-reveal="left"><p class="eyebrow">Devra location</p><h2>' + at(l.title) + '</h2>' + ornament('ornament--left') + '</div>' +
    '<div class="loc-body" data-reveal="right"><div class="prose">' + paras(l.body) + '</div>' + (reach.length ? '<ul class="reach-list">' + reach.map(r => '<li><span>' + esc(r.label) + '</span><strong>' + esc(r.value) + '</strong></li>').join('') + '</ul>' : '') +
    '<div class="btn-row">' + (maps ? '<a class="btn btn--ghost" href="' + esc(maps) + '" target="_blank" rel="noopener">Open in Google Maps <span class="arrow">↗</span></a>' : '') + '</div></div></div></section>' : '';
  const pl = (CUR.places || []).filter(p => hasPhoto(p.photo)).slice(0, 4);
  const up = sec('udaipur_places');
  const rows = pl.length ? '<section class="band"><div class="wrap">' + shead('Around Devra', 'Outings into the City of Lakes', up ? firstSentence(up.body) : '') + '<div class="srows">' +
    pl.map((p, i) => '<article class="srow' + (i % 2 ? ' srow--flip' : '') + '"><div class="srow-media" data-reveal="' + (i % 2 ? 'right' : 'left') + '">' + pic(p.photo, { label: p.name }) + '</div><div class="srow-copy" data-reveal="' + (i % 2 ? 'left' : 'right') + '"><p class="eyebrow">' + esc(p.distance || 'Udaipur') + '</p><h3>' + esc(p.name) + '</h3><p>' + esc(p.text) + '</p></div></article>').join('') +
    '</div><div class="center-row"><a class="btn btn--ghost" href="' + LINKS.udaipur + '">All places to visit <span class="arrow">→</span></a></div></div></section>' : '';
  const ed = ['exp_culinary', 'exp_community'].filter(k => sec(k));
  const edit = ed.length ? '<section class="band band--soft"><div class="wrap erows">' + ed.map((k, i) => {
    const e = sec(k);
    return '<article class="erow' + (i % 2 ? ' erow--flip' : '') + '" id="' + k + '"><div class="erow-media" data-reveal="' + (i % 2 ? 'right' : 'left') + '">' + pic(e.photo, { label: e.title }) + '</div><div class="erow-copy" data-reveal="' + (i % 2 ? 'left' : 'right') + '">' +
      (e.eyebrow ? '<p class="eyebrow">' + esc(e.eyebrow) + '</p>' : '') + '<p class="quote">' + esc(e.title) + '</p>' + paras(e.body) + '</div></article>';
  }).join('') + '</div></section>' : '';
  return ehero + cards + tailor + loc + rows + marquee() + edit + bookBand();
}
function viewUdaipur() {
  const p = CUR.sections.udaipur_places;
  const places = CUR.places || [];
  const band = '<section class="band band--soft"><div class="wrap"><div class="sec-head" data-reveal><div>' +
    (p ? '<p class="eyebrow">' + esc(p.eyebrow) + '</p><h2>' + at(p.title) + '</h2><div class="prose">' + paras(p.body) + '</div>' : '<h2>Places to <em class="ital">visit</em></h2>') + '</div></div>' +
    (places.length ? '<div class="places stagger">' + places.map(placeCard).join('') + '</div>' : '') + '</div></section>';
  return pageHeroFor('udaipur', 'Explore Udaipur') + feature('udaipur_about') + band + feature('udaipur_mustdo', { flip: true }) + routeBand() + bookBand();
}
function viewGallery() {
  const items = galleryItems(CUR);
  const cats = ['All'].concat(uniq(items.map(m => m.category).filter(Boolean)));
  if (cats.indexOf(ui.galleryCat) < 0) ui.galleryCat = 'All';
  const shown = ui.galleryCat === 'All' ? items : items.filter(m => m.category === ui.galleryCat);
  return pageHeroFor('gallery', 'Gallery') + '<section class="band band--tight"><div class="wrap">' +
    (items.length ? '<div class="filter-row" role="group" aria-label="Filter photos">' + cats.map(c => '<button type="button" class="chip-btn' + (ui.galleryCat === c ? ' is-on' : '') + '" data-act="gal-cat" data-cat="' + esc(c) + '" aria-pressed="' + (ui.galleryCat === c) + '">' + esc(c) + '</button>').join('') + '</div>' +
      '<div class="masonry" id="gallery-grid">' + galleryButtons(shown, 'gallery') + '</div>' : emptyState('Photos coming soon', 'New photos of Devra will appear here.')) + '</div></section>' + bookBand();
}
function viewJournal() {
  const all = publishedPosts();
  const cats = ['All'].concat(uniq(all.map(p => p.category).filter(Boolean)));
  if (cats.indexOf(ui.journalCat) < 0) ui.journalCat = 'All';
  const list = ui.journalCat === 'All' ? all : all.filter(p => p.category === ui.journalCat);
  let body;
  if (!all.length) body = emptyState('New stories are on their way', 'Check back soon for news, recipes and travel notes from Devra.');
  else {
    const lead = list[0];
    body = (cats.length > 2 ? '<div class="filter-row" role="group" aria-label="Filter posts">' + cats.map(c => '<button type="button" class="chip-btn' + (ui.journalCat === c ? ' is-on' : '') + '" data-act="journal-cat" data-cat="' + esc(c) + '" aria-pressed="' + (ui.journalCat === c) + '">' + esc(c) + '</button>').join('') + '</div>' : '') +
      (lead ? '<a class="post-lead" href="' + postUrl(esc(lead.slug)) + '" data-reveal>' + pic(lead.cover, { label: lead.title }) + '<div><p class="meta">' + esc(lead.category) + ' · ' + fmtDate(lead.date) + ' · ' + readMins(lead.body) + ' min read</p><h2>' + esc(lead.title) + '</h2><p class="lead muted">' + esc(lead.excerpt) + '</p><span class="text-link">Read the story <span class="arrow">→</span></span></div></a>' : '') +
      (list.length > 1 ? '<div class="posts stagger">' + list.slice(1).map(postCard).join('') + '</div>' : '');
  }
  return pageHeroFor('journal', 'Journal') + '<section class="band band--tight"><div class="wrap">' + body + '</div></section>';
}
function postArticle(p) {
  return '<header class="post-head"><p class="meta">' + esc(p.category) + ' · <time datetime="' + esc(p.date) + '">' + fmtDate(p.date) + '</time> · ' + readMins(p.body) + ' min read</p><h1>' + esc(p.title || 'Untitled') + '</h1>' +
    (p.excerpt ? '<p class="lead muted">' + esc(p.excerpt) + '</p>' : '') + '<p class="byline">By ' + esc(p.author || 'Team Devra') + '</p></header>' +
    (p.cover ? '<div class="post-cover">' + pic(p.cover, { label: p.title, eager: true }) + '</div>' : '') + '<div class="post-body prose">' + md(p.body) + '</div>';
}
function viewPost() {
  heroTone = null;
  const slug = postSlug();
  const p = (CUR.posts || []).find(x => x.slug === slug && x.status === 'published');
  if (!p) return '<section class="band post-top"><div class="wrap">' + emptyState('This story is not available', 'It may have been moved or unpublished.', '<a class="btn btn--ghost" href="' + LINKS.journal + '">Go to the blog</a>') + '</div></section>';
  const more = publishedPosts().filter(x => x.id !== p.id).slice(0, 3);
  return '<section class="band band--tight post-top"><div class="wrap"><article class="post"><a class="text-link back" href="' + LINKS.journal + '">← All stories</a>' + postArticle(p) + '</article></div></section>' +
    (more.length ? '<section class="band band--soft"><div class="wrap"><div class="sec-head" data-reveal><div><p class="eyebrow">Blog</p><h2>More <em class="ital">stories</em></h2></div></div><div class="posts stagger">' + more.map(postCard).join('') + '</div></div></section>' : '') + bookBand();
}
function viewLuxury() {
  const x = sec('seo_luxury') || {};
  const s = CUR.settings, book = safeUrl(s.bookingUrl), pg = (CUR.pages || {}).luxury || {};
  const faqs = (CUR.faqs || []).filter(f => f && f.q && f.a);
  const strip = galleryItems(CUR).filter(m => m.assetId || m.file).slice(0, 4);
  const aside = '<aside class="lux-aside"><div class="lux-card" data-reveal="right"><p class="eyebrow">At a glance</p><ul class="lux-facts">' + (s.facts || []).map(factHtml).join('') + '</ul>' +
    '<div class="btn-col">' + (book ? '<a class="btn btn--primary" href="' + esc(book) + '" target="_blank" rel="noopener">Check availability <span class="arrow">→</span></a>' : '') + '<a class="btn btn--ghost" href="' + LINKS.contact + '">Send an enquiry</a></div>' +
    '<p class="lux-addr">' + esc(s.address).replace(/\n/g, '<br>') + '</p></div></aside>';
  return pageHero(pg.eyebrow || 'Udaipur, Rajasthan', pg.title || 'Luxury homestay in Udaipur', pg.lead, pg.photo) +
    '<section class="band band--tight"><div class="wrap lux-grid"><article class="lux-article post-body prose" data-reveal>' + (x.eyebrow ? '<p class="eyebrow">' + esc(x.eyebrow) + '</p>' : '') + (x.title ? '<h2>' + at(x.title) + '</h2>' : '') + md(x.body) + '</article>' + aside + '</div></section>' +
    (strip.length ? '<section class="band band--soft band--tight"><div class="wrap"><div class="strip stagger" style="margin-top:0">' + galleryButtons(strip, 'lux') + '</div></div></section>' : '') +
    (faqs.length ? '<section class="band" id="faq"><div class="wrap">' + shead('FAQ', 'Questions about staying at Devra', '') + '<div class="faq stagger">' + faqs.map((f, i) => '<details class="faq-item"' + (i === 0 ? ' open' : '') + '><summary><span>' + esc(f.q) + '</span><i aria-hidden="true"></i></summary><div class="faq-a">' + paras(f.a) + '</div></details>').join('') + '</div></div></section>' : '') +
    bookBand();
}
function viewContact() {
  const s = CUR.settings;
  const x = CUR.sections.contact_intro || { title: 'Plan your stay at Devra', body: '' };
  const phones = [s.phonePrimary].concat(s.phonesOther || []).filter(Boolean);
  const book = safeUrl(s.bookingUrl);
  return pageHero(x.eyebrow, x.title, x.body, x.photo) +
    '<section class="band band--tight"><div class="wrap contact-grid"><form id="enq-form" class="panel form" novalidate data-reveal="left">' +
    '<div class="form-2"><div class="field"><label for="enq-name">Your name</label><input class="input" id="enq-name" name="name" autocomplete="name" required></div><div class="field"><label for="enq-phone">Phone</label><input class="input" id="enq-phone" name="phone" type="tel" autocomplete="tel"></div></div>' +
    '<div class="field"><label for="enq-email">Email</label><input class="input" id="enq-email" name="email" type="email" autocomplete="email"></div>' +
    '<div class="form-2"><div class="field"><label for="enq-in">Check-in</label><input class="input" id="enq-in" name="checkin" type="date"></div><div class="field"><label for="enq-out">Check-out</label><input class="input" id="enq-out" name="checkout" type="date"></div></div>' +
    '<div class="field"><label for="enq-guests">Guests</label><input class="input" id="enq-guests" name="guests" placeholder="e.g. 2 adults, 1 child, 1 dog"></div>' +
    '<div class="field"><label for="enq-msg">Message</label><textarea class="input" id="enq-msg" name="message" rows="4" placeholder="Celebrations, food preferences, pickups"></textarea></div>' +
    '<p class="err" id="enq-err" hidden></p><div class="btn-row"><a class="btn btn--primary" id="enq-send" data-act="enq-send" href="' + esc(waLink('')) + '" target="_blank" rel="noopener">Send on WhatsApp <span class="arrow">→</span></a><button type="button" class="btn btn--ghost" data-act="enq-copy">Copy message</button></div>' +
    '<p class="hint">WhatsApp opens in a new tab with your message filled in. To email instead, copy the message and send it to ' + esc(s.email) + '.</p></form>' +
    '<aside class="panel contact-list" data-reveal="right"><div><h3>Call or WhatsApp</h3>' + phones.map(copyRow).join('') + '</div>' + (s.email ? '<div><h3>Email</h3>' + copyRow(s.email) + '</div>' : '') +
    '<div><h3>Address</h3><address>' + esc(s.address).replace(/\n/g, '<br>') + '</address></div>' + (book ? '<div><h3>Book online</h3><a class="btn btn--ghost btn--sm" href="' + esc(book) + '" target="_blank" rel="noopener">Check availability</a></div>' : '') +
    '</aside></div></section>' + routeBand();
}
function waNumber() { return String(CUR.settings.whatsapp || '').replace(/\D/g, ''); }
function waLink(text) { const n = waNumber(); return n ? 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '') : '#'; }
function enqText() {
  const f = document.getElementById('enq-form'); if (!f) return '';
  const g = n => ((f.elements[n] && f.elements[n].value) || '').trim();
  return ['Hello ' + (CUR.settings.siteName || 'Devra') + ", I'd like to enquire about a stay.", g('name') && 'Name: ' + g('name'), (g('checkin') || g('checkout')) && 'Dates: ' + (g('checkin') || '?') + ' to ' + (g('checkout') || '?'), g('guests') && 'Guests: ' + g('guests'), g('phone') && 'Phone: ' + g('phone'), g('email') && 'Email: ' + g('email'), g('message') && 'Message: ' + g('message')].filter(Boolean).join('\n');
}

/* ---------- Render ---------- */
const route = { admin: false };
function pageHtml() {
  switch (PAGE) {
    case 'about': return viewAbout();
    case 'stay': return viewStay();
    case 'experiences': return viewExperiences();
    case 'udaipur': return viewUdaipur();
    case 'gallery': return viewGallery();
    case 'journal': return viewJournal();
    case 'post': return viewPost();
    case 'contact': return viewContact();
    case 'luxury': return viewLuxury();
    default: return viewHome();
  }
}
function render() {
  route.admin = IS_INDEX && location.hash === '#admin';
  if (route.admin) {
    ui.previewDraft = false;
    if (access === 'editor' && !DRAFT) initDraft();
    CUR = DRAFT || STATE;
    heroTone = null;
    const body = viewAdmin();
    APP.innerHTML = header() + '<main id="main">' + body + '</main>';
    renderPicker();
    if (admin.tab === 'overview') ensureUsage();
    stopMotion();
    onScroll();
    return;
  }
  CUR = (IS_INDEX && ui.previewDraft && DRAFT) ? DRAFT : STATE;
  heroTone = null;
  const main = pageHtml();
  APP.innerHTML = header() + (ui.previewDraft && IS_INDEX ? previewRibbon() : '') + '<main id="main">' + main + '</main>' + footer() + floatCta();
  if (heroTone) { const h = document.getElementById('site-head'); if (h) h.classList.add('is-over', 'tone-' + heroTone); }
  startMotion();
  onScroll();
  if (PAGE === 'post') { const p = (CUR.posts || []).find(x => x.slug === postSlug()); try { document.title = (p ? p.title + ' · ' : '') + (CUR.settings.siteName || 'Devra Udaipur'); } catch (e) {} }
}

/* ---------- Motion engine ---------- */
let rafId = 0, scenes = [], sliderTimer = null, sceneIO = null, countIO = null;
let pointer = { x: 0, y: 0 };
let revealIO = null;
function initReveal() {
  const root = document.documentElement;
  if (revealIO) { revealIO.disconnect(); revealIO = null; }
  if (RM.matches || typeof IntersectionObserver !== 'function') { root.classList.remove('js-motion'); return; }
  root.classList.add('js-motion');
  revealIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
  APP.querySelectorAll('[data-reveal], .stagger > *').forEach(el => {
    const par = el.parentElement;
    if (par && par.classList.contains('stagger')) el.style.setProperty('--d', (Array.prototype.indexOf.call(par.children, el) % 6) * 90 + 'ms');
    revealIO.observe(el);
  });
}
function stopMotion() {
  if (revealIO) { revealIO.disconnect(); revealIO = null; }
  document.documentElement.classList.remove('js-motion');
  cancelAnimationFrame(rafId); rafId = 0; scenes = [];
  clearInterval(sliderTimer); sliderTimer = null;
  if (sceneIO) { sceneIO.disconnect(); sceneIO = null; }
  if (countIO) { countIO.disconnect(); countIO = null; }
}
function startMotion() {
  stopMotion();
  initScenes();
  initSlider();
  initCounts();
  initReveal();
}
function makeBirds(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: Math.random(), y: 0.1 + Math.random() * 0.32, s: 0.01 + Math.random() * 0.014, sz: 4 + Math.random() * 5, ph: Math.random() * 6.28, f: 6 + Math.random() * 4 });
  return out;
}
function initScenes() {
  document.querySelectorAll('canvas.hero-art').forEach(c => {
    const sc = { c, hero: c.closest('.hero'), content: c.closest('.hero').querySelector('.hero-content'), birds: makeBirds(Number(c.dataset.birds) || 5), visible: true, stars: null, colors: null, w: 0, h: 0 };
    scenes.push(sc);
  });
  if (!scenes.length) return;
  try {
    sceneIO = new IntersectionObserver(es => es.forEach(e => { const sc = scenes.find(s => s.c === e.target); if (sc) sc.visible = e.isIntersecting; }));
    scenes.forEach(s => sceneIO.observe(s.c));
  } catch (e) {}
  if (RM.matches) { scenes.forEach(s => drawScene(s, 0)); return; }
  const loop = t => { scenes.forEach(s => { if (s.visible && s.c.isConnected) drawScene(s, t); }); rafId = requestAnimationFrame(loop); };
  rafId = requestAnimationFrame(loop);
}
function sceneColors() {
  const cs = getComputedStyle(document.documentElement);
  const col = n => (cs.getPropertyValue(n) || '').trim() || '#8892c0';
  return { skyTop: col('--sky-top'), skyBot: col('--sky-bot'), sun: col('--sun'), r: [col('--ridge-1'), col('--ridge-2'), col('--ridge-3'), col('--ridge-4')], bird: col('--bird'), mist: col('--mist'), stars: (cs.getPropertyValue('--stars') || '0').trim() === '1' };
}
let colorEpoch = 0;
function ridge(t, s) { return 0.55 * Math.sin(t * 3.1 + s) + 0.3 * Math.sin(t * 7.3 + s * 1.9) + 0.15 * Math.sin(t * 15.7 + s * 2.7); }
function peak(fn, x0, span) { let bx = x0, by = fn(x0); for (let x = x0 - span; x <= x0 + span; x += 2) { const y = fn(x); if (y < by) { by = y; bx = x; } } return [bx, by]; }
function drawScene(sc, t) {
  const c = sc.c;
  const W = c.clientWidth, H = c.clientHeight;
  if (!W || !H) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (sc.w !== W || sc.h !== H) { sc.w = W; sc.h = H; c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); sc.ridgeTop = null; }
  if (!sc.colors || sc.epoch !== colorEpoch) { sc.colors = sceneColors(); sc.epoch = colorEpoch; }
  const C = sc.colors;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (sc.ridgeTop == null) {
    const cb = sc.content ? sc.content.offsetTop + sc.content.offsetHeight - (parseFloat(getComputedStyle(sc.content).paddingBottom) || 0) : H * 0.5;
    sc.ridgeTop = Math.max(cb + 14, H * 0.42);
  }
  const top = Math.min(sc.ridgeTop, H - 120);
  const band = H - top;
  const scrolled = Math.max(0, -sc.hero.getBoundingClientRect().top);
  const sec = t / 1000;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, C.skyTop); sky.addColorStop(1, C.skyBot);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  if (C.stars) {
    if (!sc.stars) { sc.stars = []; for (let i = 0; i < 90; i++) sc.stars.push([Math.random(), Math.random() * 0.6, Math.random() * 1.3 + 0.3, Math.random() * 6.28]); }
    sc.stars.forEach(s => { ctx.globalAlpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(sec * 1.6 + s[3])); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(s[0] * W, s[1] * top, s[2], 0, 6.283); ctx.fill(); });
    ctx.globalAlpha = 1;
  }
  const sr = Math.max(22, band * 0.13);
  const sx = W * 0.79 + pointer.x * 6, sy = top + band * 0.22 + Math.sin(sec / 3) * 4 + scrolled * 0.45;
  const glow = ctx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 4.2);
  glow.addColorStop(0, C.sun); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.28 + 0.06 * Math.sin(sec * 0.9); ctx.fillStyle = glow; ctx.fillRect(sx - sr * 4.2, sy - sr * 4.2, sr * 8.4, sr * 8.4); ctx.globalAlpha = 1;
  ctx.fillStyle = C.sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 6.283); ctx.fill();
  ctx.strokeStyle = C.bird; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  sc.birds.forEach(b => {
    const x = (((b.x + sec * b.s) % 1.2) - 0.1) * W;
    const y = b.y * top + Math.sin(sec * 0.8 + b.ph) * 6;
    const w = Math.sin(sec * b.f + b.ph);
    ctx.beginPath(); ctx.moveTo(x - b.sz, y - w * b.sz * 0.7); ctx.quadraticCurveTo(x - b.sz * 0.4, y - b.sz * 0.2, x, y); ctx.quadraticCurveTo(x + b.sz * 0.4, y - b.sz * 0.2, x + b.sz, y - w * b.sz * 0.7); ctx.stroke();
  });
  const layers = [{ base: 0.30, amp: 0.20, seed: 1.7, d: 0.42, px: 4 }, { base: 0.47, amp: 0.17, seed: 4.1, fort: 0.27, d: 0.3, px: 8 }, { base: 0.65, amp: 0.13, seed: 7.3, temple: 0.6, d: 0.18, px: 13 }, { base: 0.84, amp: 0.09, seed: 2.9, house: 0.14, d: 0.06, px: 20 }];
  const s = band * 0.045;
  layers.forEach((L, i) => {
    const ox = pointer.x * L.px, oy = scrolled * L.d;
    const y = x => top + oy + band * (L.base - L.amp * ridge((x - ox) / W, L.seed));
    ctx.fillStyle = C.r[i];
    ctx.beginPath(); ctx.moveTo(0, H);
    const step = Math.max(3, W / 240);
    for (let x = 0; x <= W + step; x += step) ctx.lineTo(x, y(x));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    if (i === 1) {
      const my = top + oy + band * 0.56;
      const mist = ctx.createLinearGradient(0, my - band * 0.08, 0, my + band * 0.1);
      mist.addColorStop(0, 'rgba(0,0,0,0)'); mist.addColorStop(0.5, C.mist); mist.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mist; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(sec * 0.4); ctx.fillRect(0, my - band * 0.08, W, band * 0.18); ctx.globalAlpha = 1;
      ctx.fillStyle = C.r[i];
    }
    if (L.fort) { const [fx, fy] = peak(y, W * L.fort + ox, W * 0.06); ctx.beginPath(); ctx.rect(fx - s * 1.8, fy - s * 1.2, s * 3.6, s * 1.5); ctx.rect(fx - s * 0.55, fy - s * 2.1, s * 1.1, s); ctx.fill(); ctx.beginPath(); ctx.arc(fx, fy - s * 2.1, s * 0.55, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(fx - s * 1.4, fy - s * 1.2, s * 0.35, Math.PI, 0); ctx.arc(fx + s * 1.4, fy - s * 1.2, s * 0.35, Math.PI, 0); ctx.fill(); }
    if (L.temple) { const [tx, ty] = peak(y, W * L.temple + ox, W * 0.05); const k = s * 1.1; ctx.beginPath(); ctx.moveTo(tx - k, ty + 2); ctx.lineTo(tx - k, ty - k * 0.8); ctx.quadraticCurveTo(tx - k * 0.75, ty - k * 2.4, tx, ty - k * 3); ctx.quadraticCurveTo(tx + k * 0.75, ty - k * 2.4, tx + k, ty - k * 0.8); ctx.lineTo(tx + k, ty + 2); ctx.closePath(); ctx.fill(); ctx.fillRect(tx - 0.75, ty - k * 3.7, 1.5, k * 0.8); }
    if (L.house) { const [hx, hy] = peak(y, W * L.house + ox, W * 0.07); const k = s * 1.3; ctx.beginPath(); ctx.rect(hx - k * 2.2, hy - k * 1.3, k * 4.4, k * 1.5); ctx.rect(hx - k * 0.9, hy - k * 2.1, k * 1.8, k * 0.9); ctx.fill(); ctx.beginPath(); ctx.arc(hx, hy - k * 2.1, k * 0.6, Math.PI, 0); ctx.fill(); ctx.fillRect(hx - 0.7, hy - k * 3.1, 1.4, k * 0.5); }
  });
}
function initSlider() {
  const root = document.querySelector('[data-slider]');
  if (!root) return;
  const slides = Array.from(root.querySelectorAll('.slide'));
  const dots = Array.from(document.querySelectorAll('.dot'));
  const cap = document.getElementById('slide-cap');
  if (slides.length < 2) return;
  const ms = 6500;
  document.documentElement.style.setProperty('--slide-ms', ms + 'ms');
  let i = 0;
  const show = n => {
    i = (n + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle('is-on', k === i));
    dots.forEach((d, k) => { d.classList.remove('is-on'); d.classList.toggle('is-done', k < i); });
    if (dots[i]) { void dots[i].offsetWidth; dots[i].classList.add('is-on'); }
    if (cap) cap.textContent = slides[i].dataset.cap || '';
  };
  sliderShow = n => { show(n); restart(); };
  const restart = () => { clearInterval(sliderTimer); if (!RM.matches) sliderTimer = setInterval(() => { if (!document.hidden) show(i + 1); }, ms); };
  show(0); restart();
}
let sliderShow = null;
function initCounts() {
  const els = Array.from(document.querySelectorAll('[data-count]'));
  if (!els.length || RM.matches || typeof IntersectionObserver !== 'function') return;
  countIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    countIO.unobserve(e.target);
    const el = e.target, full = el.dataset.count, m = full.match(/^(\d+)(.*)$/);
    if (!m) return;
    const target = Number(m[1]), rest = m[2], t0 = performance.now(), dur = 1500;
    const step = now => { const p = Math.min(1, (now - t0) / dur), v = Math.round(target * (1 - Math.pow(1 - p, 3))); el.textContent = v + rest; if (p < 1) requestAnimationFrame(step); else el.textContent = full; };
    requestAnimationFrame(step);
  }), { threshold: 0.4 });
  els.forEach(el => countIO.observe(el));
}
let scrollRaf = 0;
function onScroll() {
  const h = document.getElementById('site-head');
  if (!h) return;
  const over = !!heroTone && window.scrollY < 40 && !ui.menuOpen;
  h.classList.toggle('is-over', over);
  if (heroTone) h.classList.toggle('tone-' + heroTone, over);
  h.classList.toggle('is-scrolled', window.scrollY > 60);
  if (!RM.matches && !route.admin) {
    const y = window.scrollY, vh = window.innerHeight || 800;
    const hs = APP.querySelector('.hero .hero-slides'), hc = APP.querySelector('.hero .hero-content');
    if (hs && y < vh * 1.2) hs.style.transform = 'translate3d(0,' + (y * 0.32).toFixed(1) + 'px,0)';
    if (hc && y < vh * 1.2) { hc.style.opacity = Math.max(0, 1 - y / (vh * 0.75)).toFixed(3); hc.style.transform = 'translate3d(0,' + (y * 0.12).toFixed(1) + 'px,0)'; }
  }
}

/* ---------- Lightbox, toast, copy ---------- */
function ensureRoot(id) { let r = document.getElementById(id); if (!r) { r = document.createElement('div'); r.id = id; document.body.appendChild(r); } return r; }
/* ---------- Stories (Instagram-style, managed in Admin → Stories) ---------- */
let sv = null, svTimer = null, svReturn = null;
const STORY_MS = 5200;
function storyPhotos(st) {
  const cat = String(st.category || '').toLowerCase().trim();
  const items = (CUR.media || []).filter(m => (m.assetId || m.file) && m.id !== (CUR.settings || {}).logo);
  let list = cat ? items.filter(m => String(m.category || '').toLowerCase() === cat && m.showInGallery !== false) : [];
  const cover = st.cover && findMedia(st.cover);
  if (cover && (cover.assetId || cover.file)) list = [cover].concat(list.filter(m => m !== cover));
  return list.slice(0, 12);
}
function storyList() { return (CUR.stories || []).filter(x => x && x.title && storyPhotos(x).length); }
function storiesStrip() {
  const ss = storyList();
  if (!ss.length) return '';
  return '<section class="stories-band" aria-label="Stories"><div class="wrap"><div class="stories-head"><p class="eyebrow">Stories</p><p class="stories-hint">Tap a circle to watch</p></div><div class="stories">' +
    ss.map((x, i) => '<button type="button" class="story" data-act="story" data-i="' + i + '" aria-label="Watch the story: ' + esc(x.title) + '"><span class="story-ring"><span class="story-img">' + pic(storyPhotos(x)[0], { label: x.title }) + '</span></span><span class="story-name">' + esc(x.title) + '</span></button>').join('') +
    '</div></div></section>';
}
function closeStory() { sv = null; renderStory(); if (svReturn && document.body.contains(svReturn)) svReturn.focus(); }
function renderStory() {
  const root = ensureRoot('story-root');
  clearTimeout(svTimer);
  if (!sv) { root.innerHTML = ''; document.documentElement.classList.remove('no-scroll'); return; }
  const ss = storyList();
  if (!ss[sv.i]) { sv = null; return renderStory(); }
  let ph = storyPhotos(ss[sv.i]);
  if (sv.j >= ph.length) { if (sv.i + 1 < ss.length) { sv = { i: sv.i + 1, j: 0 }; return renderStory(); } return closeStory(); }
  if (sv.j < 0) { if (sv.i > 0) { sv.i--; ph = storyPhotos(ss[sv.i]); sv.j = ph.length - 1; } else sv.j = 0; }
  const st = ss[sv.i], m = ph[sv.j], src = esc(assetSrc(m));
  root.innerHTML = '<div class="sv" role="dialog" aria-modal="true" aria-label="Story: ' + esc(st.title) + '"><div class="sv-frame" style="--story-ms:' + STORY_MS + 'ms">' +
    '<div class="sv-media"><img class="sv-bg" src="' + src + '" alt="" aria-hidden="true"><img class="sv-fg" src="' + src + '" alt="' + esc(m.caption || st.title) + '"></div>' +
    '<div class="sv-bars" aria-hidden="true">' + ph.map((_, k) => '<span class="sv-bar' + (k < sv.j ? ' done' : k === sv.j ? ' on' : '') + '"><i></i></span>').join('') + '</div>' +
    '<div class="sv-top"><span class="sv-avatar">' + pic(ph[0], {}) + '</span><span class="sv-who"><strong>' + esc(st.title) + '</strong><small>' + esc((CUR.settings || {}).siteName || 'Devra Udaipur') + '</small></span><button type="button" class="sv-close" data-act="story-close" aria-label="Close story">✕</button></div>' +
    '<button type="button" class="sv-tap sv-prev" data-act="story-prev" aria-label="Previous photo"></button><button type="button" class="sv-tap sv-next" data-act="story-next" aria-label="Next photo"></button>' +
    '<div class="sv-cap">' + (st.caption && sv.j === 0 ? '<p class="sv-lead">' + esc(st.caption) + '</p>' : '') + (m.caption ? '<p>' + esc(m.caption) + '</p>' : '') + '</div>' +
    '<p class="sv-count">' + (sv.i + 1) + ' / ' + ss.length + '</p></div></div>';
  document.documentElement.classList.add('no-scroll');
  const nx = ph[sv.j + 1]; if (nx) { const im = new Image(); im.src = assetSrc(nx); }
  const close = root.querySelector('.sv-close'); if (close) close.focus({ preventScroll: true });
  if (!RM.matches) svTimer = setTimeout(() => { if (sv) { sv.j++; renderStory(); } }, STORY_MS);
}
function renderLightbox() {
  const root = ensureRoot('lb-root');
  if (!lb) { root.innerHTML = ''; return; }
  const ids = LB_SETS[lb.set] || [];
  if (!ids.length) { lb = null; root.innerHTML = ''; return; }
  lb.i = (lb.i + ids.length) % ids.length;
  const m = findMedia(ids[lb.i]);
  root.innerHTML = '<div class="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer"><button type="button" class="lb-btn lb-close" data-act="lb-close">Close</button><button type="button" class="lb-btn" data-act="lb-prev" aria-label="Previous photo">‹</button>' +
    '<figure class="lb-fig">' + pic(m, { cls: 'lb-pic', eager: true }) + '<figcaption>' + esc(m ? m.caption : '') + ' <span class="num">· ' + (lb.i + 1) + ' / ' + ids.length + '</span></figcaption></figure><button type="button" class="lb-btn" data-act="lb-next" aria-label="Next photo">›</button></div>';
  const close = root.querySelector('.lb-close'); if (close) close.focus();
}
function toast(msg, kind) {
  const root = ensureRoot('toast-root'); root.setAttribute('role', 'status'); root.setAttribute('aria-live', 'polite');
  const t = document.createElement('div'); t.className = 'toast toast--' + (kind || 'ok'); t.textContent = msg; root.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, kind === 'error' ? 6500 : 4200);
}
function copyText(text, btn) {
  const done = label => { if (!btn) return; const old = btn.dataset.orig || btn.textContent; btn.dataset.orig = old; btn.textContent = label; setTimeout(() => { if (btn.isConnected) btn.textContent = old; }, 1600); };
  const fallback = () => { const row = btn && btn.closest('.copy-row'); const val = row && row.querySelector('.copy-val'); if (val) { const r = document.createRange(); r.selectNodeContents(val); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); done('Selected'); } else toast('Copy is not available here. Select the text and copy it.', 'warn'); };
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done('Copied'), fallback); else fallback(); } catch (e) { fallback(); }
}

/* ---------- Admin: draft & publishing ---------- */
const LS_KEY = 'devra-admin-draft-v2', SS_KEY = 'devra-after-publish';
function lsGet() { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; } }
function lsSet() { try { localStorage.setItem(LS_KEY, JSON.stringify({ baseRev: STATE.rev, savedAt: Date.now(), draft: DRAFT })); } catch (e) {} }
function lsClear() { try { localStorage.removeItem(LS_KEY); } catch (e) {} }
function stash(v) { try { sessionStorage.setItem(SS_KEY, JSON.stringify(v)); } catch (e) {} }
function unstash() { try { const v = JSON.parse(sessionStorage.getItem(SS_KEY) || 'null'); sessionStorage.removeItem(SS_KEY); return v; } catch (e) { return null; } }
function initDraft() {
  DRAFT = clone(STATE);
  const saved = lsGet();
  if (saved && saved.draft && JSON.stringify(saved.draft) !== JSON.stringify(STATE)) admin.restore = saved;
  else if (saved) lsClear();
}
let lsTimer = null;
function markDirty() { dirty = true; updateBar(); clearTimeout(lsTimer); lsTimer = setTimeout(lsSet, 600); }
function updateBar() { const bar = document.getElementById('admin-bar'); if (bar) bar.hidden = !dirty; }
function normalize(s) {
  const seen = new Set();
  s.posts.forEach(p => { if (!String(p.title || '').trim()) p.title = 'Untitled'; const base = slugify(p.slug) || slugify(p.title) || 'post'; let slug = base, n = 2; while (seen.has(slug)) slug = base + '-' + (n++); seen.add(slug); p.slug = slug; });
  return s;
}
function indexBody(state) {
  const close = '</' + 'script>';
  return [
    '<title>Devra Udaipur</title>',
    '<meta name="claude:viewport-fit-sides" content="cover">',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link rel="stylesheet" href="' + FONT_URL + '">',
    '<link rel="stylesheet" href="site.css">',
    '<div id="app" data-page="home"></div>',
    '<script id="site-data" type="application/json">' + JSON.stringify(state).replace(/</g, '\\u003c') + close,
    '<script src="site.js">' + close
  ].join('\n');
}
function buildIndexDoc(state) {
  return '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>' + RESET + '</style></head><body>' + indexBody(state) + '\n</body></html>';
}
async function publishNow(retried) {
  if (publishing && !retried) return;
  if (!caps.artifact) { toast('Publishing is not available in this view. Open the site in claude.ai with Editor access.', 'error'); return; }
  const next = normalize(clone(DRAFT));
  next.rev = Math.max(Number(STATE.rev) || 1, Number(DRAFT.rev) || 1) + 1;
  next.updatedAt = new Date().toISOString();
  publishing = true; setPublishingUi(true);
  lsClear();
  try {
    await caps.artifact.publish({
      'content.json': { content: JSON.stringify(next), contentType: 'application/json' },
      'index.html': { content: buildIndexDoc(next), contentType: 'text/html' }
    });
    STATE = next; DRAFT = clone(next); dirty = false; publishing = false;
    setPublishingUi(false);
    toast('Changes published. Every page of the site is up to date.');
    { const y = window.scrollY; render(); window.scrollTo(0, y); }
    return;
  } catch (e) {
    const c = e && e.code;
    if (c === 'upstream_error' && !retried) { await sleep(900 + Math.random() * 900); return publishNow(true); }
    if (c === 'capability_disabled' || c === 'capability_removed' || c === 'invalid_content' || c === 'transform_error') {
      try {
        stash({ admin: route.admin, tab: admin.tab, postId: admin.postId, flash: 'Changes published. Every page of the site is up to date.' });
        await caps.artifact.publish(buildIndexDoc(next));
        toast('Published. Reloading the latest version…');
        return;
      } catch (e2) { unstash(); return publishFailed(e2); }
    }
    return publishFailed(e);
  }
}
function publishFailed(e) {
  const c = e && e.code;
  publishing = false; setPublishingUi(false); lsSet();
  if (c === 'conflict') toast('Someone published a newer version first. It is loading now. Your changes are saved on this device, and you can restore them in Overview.', 'warn');
  else if (['not_writer', 'not_granted', 'consent_required', 'capability_disabled', 'capability_removed', 'not_declared'].indexOf(c) >= 0) toast('This view is read-only, so changes cannot be published here.', 'error');
  else if (c === 'rate_limited') toast('Publishing too often. Wait a minute, then publish again.', 'error');
  else if (c === 'too_large') toast('The site is too large to publish. Shorten long posts or remove unused content, then try again.', 'error');
  else toast('Publishing did not go through. Check your connection and try again.', 'error');
}
function setPublishingUi(on) { document.querySelectorAll('[data-act="publish"]').forEach(b => { b.disabled = on; b.textContent = on ? 'Publishing…' : 'Publish changes'; }); }

/* ---------- Admin: uploads ---------- */
const OK_TYPES = /^image\/(jpeg|png|webp|gif)$/;
async function prepareImage(file) {
  if (file.type === 'image/gif' || typeof createImageBitmap !== 'function') return file;
  let bmp; try { bmp = await createImageBitmap(file); } catch (e) { return file; }
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 1800000) { if (bmp.close) bmp.close(); return file; }
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(bmp, 0, 0, w, h); if (bmp.close) bmp.close();
  const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
  const blob = await new Promise(res => { try { cv.toBlob(res, type, 0.86); } catch (e) { res(null); } });
  return blob && blob.size < file.size ? blob : file;
}
async function uploadOne(blob) {
  const type = OK_TYPES.test(blob.type) ? blob.type : 'image/jpeg';
  try { return await caps.assets.upload(blob, { type }); }
  catch (e) { if (e && e.code === 'store_unavailable') { await sleep(800 + Math.random() * 700); return caps.assets.upload(blob, { type }); } throw e; }
}
function captionFrom(name) { const base = String(name || '').replace(/\.[^.]+$/, ''); if (/^(whatsapp|img|dsc|pxl|image|photo|screenshot|wa\d)/i.test(base) || /^\d/.test(base)) return ''; return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase()); }
async function uploadFiles(files, onEach) {
  if (!caps.assets) { toast('Uploading photos needs Editor access to this site.', 'error'); return 0; }
  const list = Array.from(files || []);
  const good = list.filter(f => OK_TYPES.test(f.type));
  const bad = list.length - good.length;
  if (bad) toast(bad + (bad > 1 ? ' files were' : ' file was') + ' skipped. Use JPG, PNG, WebP or GIF photos.', 'warn');
  if (!good.length) return 0;
  admin.uploads = { total: good.length, done: 0 }; updateTray();
  let ok = 0;
  for (const f of good) {
    try { const blob = await prepareImage(f); const r = await uploadOne(blob); onEach(f, r.id); ok++; }
    catch (e) {
      const c = e && e.code;
      if (c === 'too_large') toast(f.name + ' is larger than 20 MB. Choose a smaller photo.', 'error');
      else if (c === 'unsupported_type') toast(f.name + ' is not a supported photo type.', 'error');
      else if (c === 'quota_or_state') { toast('Photo storage is full. Delete unused photos in Overview, then upload again.', 'error'); break; }
      else if (c === 'rate_limited') { toast('Uploading too fast. Wait a moment, then upload the remaining photos.', 'error'); break; }
      else if (['not_granted', 'capability_disabled', 'capability_removed', 'upstream_auth'].indexOf(c) >= 0) { toast('Uploading is not available in this view. Reload the page and try again.', 'error'); break; }
      else toast(f.name + ' could not be uploaded. Try again.', 'error');
    }
    admin.uploads.done++; updateTray();
  }
  admin.uploads = null; admin.usage = null;
  if (ok) markDirty();
  return ok;
}
function updateTray() {
  const t = document.getElementById('upload-tray'); if (!t) return;
  const u = admin.uploads;
  if (!u) { t.hidden = true; t.innerHTML = ''; return; }
  t.hidden = false;
  t.innerHTML = '<span>Uploading ' + Math.min(u.done + 1, u.total) + ' of ' + u.total + '</span><span class="meter"><span style="width:' + Math.round(u.done / u.total * 100) + '%"></span></span>';
}
function newMedia(assetId, file, cat) { return { id: uid('m'), assetId: assetId, caption: captionFrom(file && file.name), category: cat || 'Property', sourceUrl: '', featured: false, showInGallery: true }; }
async function handleUploadMany(files) {
  let matched = 0, added = 0;
  const n = await uploadFiles(files, (f, id) => {
    const key = normName(f.name);
    const named = key ? DRAFT.media.filter(m => m.sourceUrl && normName(m.sourceUrl) === key) : [];
    const slot = named.find(m => !m.assetId) || named[0];
    if (slot) { slot.assetId = id; matched++; }
    else { DRAFT.media.unshift(newMedia(id, f)); added++; }
  });
  if (n) toast((matched ? matched + ' matched to photos from the old website' + (added ? ', ' : '. ') : '') + (added ? added + ' added as new photos. ' : '') + 'Publish to make them live.');
  admin.photoFilter = 'All';
  renderAdmin();
}
async function handleUploadFor(id, files) {
  const m = DRAFT.media.find(x => x.id === id); if (!m) return;
  const n = await uploadFiles(Array.from(files).slice(0, 1), (f, aid) => { m.assetId = aid; });
  if (n) toast('Photo uploaded for "' + (m.caption || 'Untitled') + '". Publish to make it live.');
  renderAdmin();
}
async function handleUploadPick(files) {
  let created = null;
  const n = await uploadFiles(Array.from(files).slice(0, 1), (f, aid) => { created = newMedia(aid, f); DRAFT.media.unshift(created); });
  if (n && created) choosePicked(created.id); else renderPicker();
}
function ensureUsage() {
  if (!caps.assets || admin.usage || admin.usageLoading) return;
  admin.usageLoading = true;
  caps.assets.list().then(r => { admin.usage = r; }, () => { admin.usage = { error: true }; }).then(() => { admin.usageLoading = false; if (route.admin && admin.tab === 'overview') renderAdmin(); });
}
function referencedAssets() {
  const set = new Set();
  const add = s => ((s && s.media) || []).forEach(m => { if (m.assetId) set.add(m.assetId); });
  add(STATE); add(DRAFT); const saved = lsGet(); if (saved) add(saved.draft);
  return set;
}

/* ---------- Admin: form helpers ---------- */
function fld(label, path, value, o) {
  o = o || {};
  const id = idFor(path), type = o.type || 'text';
  if (type === 'checkbox') return '<label class="check"><input type="checkbox" id="' + id + '" data-bind="' + esc(path) + '"' + (value ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
  let ctrl;
  if (type === 'textarea' || type === 'lines') {
    const v = type === 'lines' ? (Array.isArray(value) ? value.join('\n') : '') : value;
    ctrl = '<textarea id="' + id + '" class="input" rows="' + (o.rows || 4) + '" data-bind="' + esc(path) + '"' + (type === 'lines' ? ' data-type="lines"' : '') + '>' + esc(v) + '</textarea>';
  } else ctrl = '<input id="' + id + '" class="input' + (o.lg ? ' input--lg' : '') + '" type="' + type + '" value="' + esc(value) + '" data-bind="' + esc(path) + '"' + (o.list ? ' list="' + o.list + '"' : '') + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + '>';
  return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>' + ctrl + (o.hint ? '<p class="hint">' + esc(o.hint) + '</p>' : '') + '</div>';
}
function photoField(label, path, value) {
  const m = value ? findMedia(value, DRAFT) : null;
  return '<div class="field"><span class="label">' + esc(label) + '</span><div class="photo-field"><div class="photo-thumb">' + (m ? pic(m) : '<div class="thumb-none">No photo</div>') + '</div>' +
    '<div class="photo-meta"><p>' + (m ? esc(m.caption || 'Untitled photo') : 'None selected') + '</p>' + (m && !m.assetId ? '<p class="hint warn">Placeholder. Upload this photo in Photos.</p>' : '') +
    '<div class="btn-row"><button type="button" class="btn btn--sm btn--ghost" data-act="pick" data-path="' + esc(path) + '">' + (m ? 'Change' : 'Choose photo') + '</button>' + (m ? '<button type="button" class="btn btn--sm btn--quiet" data-act="pick-clear" data-path="' + esc(path) + '">Remove</button>' : '') + '</div></div></div></div>';
}
function statusPill(st) { return st === 'published' ? '<span class="pill pill--pub">Published</span>' : '<span class="pill pill--draft">Draft</span>'; }
function photoRefs(d) {
  const refs = [];
  Object.keys(d.sections).forEach(k => { const x = d.sections[k]; if (!x) return; if (x.photo) refs.push(['sections/' + k + '/photo', x.photo]); if (x.photo2) refs.push(['sections/' + k + '/photo2', x.photo2]); });
  Object.keys(d.pages).forEach(k => { if (d.pages[k] && d.pages[k].photo) refs.push(['pages/' + k + '/photo', d.pages[k].photo]); });
  d.posts.forEach(p => { if (p.cover) refs.push(['posts/@' + p.id + '/cover', p.cover]); });
  d.experiences.forEach(e => { if (e.photo) refs.push(['experiences/@' + e.id + '/photo', e.photo]); });
  d.places.forEach(p => { if (p.photo) refs.push(['places/@' + p.id + '/photo', p.photo]); });
  (d.settings.heroSlides || []).forEach(s => { if (s.photo) refs.push(['settings/heroSlides/@' + s.id + '/photo', s.photo]); });
  (d.stories || []).forEach(x => { if (x.cover) refs.push(['stories/@' + x.id + '/cover', x.cover]); });
  (d.reviews || []).forEach(x => { if (x.photo) refs.push(['reviews/@' + x.id + '/photo', x.photo]); });
  if (d.settings.logo) refs.push(['settings/logo', d.settings.logo]);
  return refs;
}
function usedIn(id) { return photoRefs(DRAFT).filter(r => r[1] === id).length + DRAFT.posts.filter(p => String(p.body || '').indexOf('(media:' + id + ')') >= 0).length; }
function clearRefs(id) { photoRefs(DRAFT).forEach(([path, v]) => { if (v === id) setPath(DRAFT, path, null); }); }

/* ---------- Admin views ---------- */
function viewAdmin() {
  if (STATE.static) return '<div class="wrap admin-gate"><p class="eyebrow">Admin panel</p><h1>Admin is not part of this copy</h1><p class="lead muted">This is the hosted copy of the site. Content is managed in the claude.ai version, or by your developer in content.json.</p><div class="btn-row"><a class="btn btn--primary" href="' + LINKS.home + '">Back to the site</a></div></div>';
  if (access === 'checking') return '<div class="wrap admin-gate"><h1>Admin</h1><p class="muted">Checking your access…</p></div>';
  if (access !== 'editor') return '<div class="wrap admin-gate"><p class="eyebrow">Admin panel</p><h1>Only site editors can make changes</h1><p class="lead muted">To manage the journal, photos and page text, ask the site owner to share this site with you as an Editor, then open it again.</p><div class="btn-row"><a class="btn btn--primary" href="' + LINKS.home + '">Back to the site</a></div></div>';
  return '<div class="admin"><nav class="admin-side" aria-label="Admin sections"><span class="side-label">Admin</span>' + TABS.map(([k, l]) => '<button type="button" data-act="tab" data-tab="' + k + '"' + (admin.tab === k ? ' aria-current="page"' : '') + '>' + l + '</button>').join('') +
    (caps.artifact ? '' : '<p class="side-note">Publishing is not available in this view.</p>') + '</nav><section id="admin-main" class="admin-main">' + adminMain() + '</section></div>' +
    '<div id="admin-bar" class="admin-bar"' + (dirty ? '' : ' hidden') + '><span><strong>Unpublished changes.</strong> <span class="bar-sub">Kept on this device until you publish.</span></span><div class="btn-row">' +
    '<button type="button" class="btn btn--sm btn--ghost" data-act="discard" data-confirm>Discard</button><button type="button" class="btn btn--sm btn--ghost" data-act="preview-site">Preview home page</button><button type="button" class="btn btn--sm btn--primary" data-act="publish">Publish changes</button></div></div>' +
    '<div id="modal-root"></div><input type="file" id="up-one" class="sr" accept="image/jpeg,image/png,image/webp,image/gif" data-upload="one" tabindex="-1" aria-hidden="true">';
}
function adminMain() {
  switch (admin.tab) {
    case 'journal': return tabJournal();
    case 'photos': return tabPhotos();
    case 'pages': return tabPages();
    case 'experiences': return tabList('experiences', 'Experiences', 'Activities on the Experiences page and in the home page carousel.');
    case 'places': return tabList('places', 'Places', 'Attractions shown on the Explore Udaipur page.');
    case 'faqs': return tabList('faqs', 'FAQ', 'Questions and answers shown on the Luxury homestay page. Google can show them in search results as FAQs. Keep answers short and factual.');
    case 'stories': return tabList('stories', 'Stories', 'Instagram-style stories on the home page. Each story plays the photos of one category from the Photos tab, full screen, one after another. Order them with the arrows; the first ones show first.');
    case 'reviews': return tabList('reviews', 'Reviews', 'Guest reviews shown on the home page. Add real reviews only, with the guest’s permission. While this list is empty, the home page links to TripAdvisor instead.');
    case 'settings': return tabSettings();
    default: return tabOverview();
  }
}
function renderAdmin(keepScroll) {
  const main = document.getElementById('admin-main');
  if (!main) { render(); return; }
  CUR = DRAFT;
  const y = window.scrollY;
  main.innerHTML = adminMain();
  document.querySelectorAll('.admin-side [data-tab]').forEach(b => { if (b.dataset.tab === admin.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  updateBar(); updateTray(); renderPicker();
  if (keepScroll !== false) window.scrollTo(0, y);
  if (admin.tab === 'overview') ensureUsage();
}
function setTab(t) { admin.tab = t; admin.postId = null; admin.preview = false; renderAdmin(false); window.scrollTo(0, 0); }
function restoreBanner() {
  const r = admin.restore; if (!r) return '';
  const stale = r.baseRev !== STATE.rev;
  return '<div class="notice"><span><strong>Unpublished changes from ' + esc(fmtDateTime(r.savedAt)) + '</strong> were saved on this device.' + (stale ? ' The site has been published since, so restoring will replace those newer changes.' : '') + '</span><div class="btn-row"><button type="button" class="btn btn--sm btn--primary" data-act="restore-draft">Restore</button><button type="button" class="btn btn--sm btn--ghost" data-act="drop-draft">Discard</button></div></div>';
}
function stat(label, value, sub, tab, warn) { return '<button type="button" class="stat" data-act="tab" data-tab="' + tab + '"><span class="stat-label">' + esc(label) + '</span><span class="stat-value">' + esc(value) + '</span><span class="stat-sub' + (warn ? ' warn' : '') + '">' + esc(sub) + '</span></button>'; }
function tabOverview() {
  const d = DRAFT;
  const pub = d.posts.filter(p => p.status === 'published').length, drafts = d.posts.length - pub;
  const withPhoto = d.media.filter(m => m.assetId).length, need = d.media.length - withPhoto;
  return '<header class="admin-head"><div><h1>Overview</h1><p class="muted">Last published ' + esc(fmtDateTime(STATE.updatedAt)) + '.</p></div><button type="button" class="btn btn--ghost btn--sm" data-act="leave-admin">View live site</button></header>' + restoreBanner() +
    '<div class="stat-row">' + stat('Journal posts', String(pub), drafts ? drafts + (drafts > 1 ? ' drafts' : ' draft') : 'All published', 'journal') +
    stat('Photos uploaded', withPhoto + ' / ' + d.media.length, need ? need + ' waiting for a photo' : 'Every slot has a photo', 'photos', need > 0) +
    stat('Experiences', String(d.experiences.length), 'On the site', 'experiences') + stat('Reviews', String(d.reviews.length), d.reviews.length ? 'On the home page' : 'None added yet', 'reviews') + '</div>' +
    '<div class="admin-grid"><section class="panel"><h2 class="panel-title">Quick actions</h2><div class="btn-col"><button type="button" class="btn btn--primary" data-act="new-post">Write a journal post</button><button type="button" class="btn btn--ghost" data-act="tab" data-tab="photos">Upload photos</button><button type="button" class="btn btn--ghost" data-act="tab" data-tab="pages">Edit page text</button><button type="button" class="btn btn--ghost" data-act="tab" data-tab="settings">Logo, hero slider & contact details</button></div></section>' +
    '<section class="panel"><h2 class="panel-title">Photo storage</h2>' + usageHtml() + '</section>' +
    '<section class="panel"><h2 class="panel-title">Export for developers</h2><p class="muted">Download all published content (page text, posts, photo list and settings) as a JSON file, for moving the site to your own server.</p><div class="btn-row"><button type="button" class="btn btn--ghost" data-act="export">Export content</button></div></section></div>';
}
function usageHtml() {
  if (!caps.assets) return '<p class="muted">Storage details are not available in this view.</p>';
  const u = admin.usage;
  if (!u) return '<p class="muted">Loading…</p>';
  if (u.error) return '<p class="muted">Storage details could not be loaded.</p><div class="btn-row"><button type="button" class="btn btn--sm btn--ghost" data-act="usage-reload">Try again</button></div>';
  const us = u.usage || {}, pct = us.maxBytes ? Math.min(100, Math.round(us.bytes / us.maxBytes * 100)) : 0;
  const refs = referencedAssets(), unused = (u.assets || []).filter(a => !refs.has(a.id)), ub = unused.reduce((t, a) => t + (a.sizeBytes || 0), 0);
  return '<p><strong class="num">' + fmtBytes(us.bytes || 0) + '</strong> used' + (us.maxBytes ? ' of ' + fmtBytes(us.maxBytes) : '') + ' · <span class="num">' + (us.files || 0) + '</span> files</p><div class="meter" role="img" aria-label="' + pct + ' percent of storage used"><span style="width:' + pct + '%"></span></div>' +
    (unused.length ? '<p class="hint">' + unused.length + (unused.length > 1 ? ' files are' : ' file is') + ' not used anywhere (' + fmtBytes(ub) + ').</p><div class="btn-row"><button type="button" class="btn btn--sm btn--ghost danger" data-act="cleanup" data-confirm>Delete unused files</button></div>' : '<p class="hint">Every stored file is in use.</p>');
}
function tabJournal() {
  if (admin.postId) { const p = DRAFT.posts.find(x => x.id === admin.postId); if (p) return postEditor(p); admin.postId = null; }
  const posts = DRAFT.posts.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return '<header class="admin-head"><div><h1>Journal</h1><p class="muted">Blog posts for the Journal page. Drafts stay hidden until you mark them published.</p></div><button type="button" class="btn btn--primary" data-act="new-post">New post</button></header>' +
    (posts.length ? '<div class="table-wrap"><table class="list-table"><thead><tr><th>Title</th><th>Status</th><th>Category</th><th>Date</th><th><span class="sr">Actions</span></th></tr></thead><tbody>' +
      posts.map(p => '<tr><td><button type="button" class="link-btn" data-act="edit-post" data-id="' + esc(p.id) + '">' + esc(p.title || 'Untitled') + '</button>' + (p.starter ? '<span class="chip">Starter post</span>' : '') + '</td><td>' + statusPill(p.status) + '</td><td>' + esc(p.category) + '</td><td class="num">' + fmtDate(p.date) + '</td><td class="row-actions"><button type="button" class="btn btn--sm btn--ghost" data-act="edit-post" data-id="' + esc(p.id) + '">Edit</button></td></tr>').join('') +
      '</tbody></table></div><p class="hint">Starter posts were written from the existing website text. Edit them into your own voice or delete them.</p>'
      : emptyState('No posts yet', 'Write your first journal post: news, recipes or a guide to Udaipur.', '<button type="button" class="btn btn--primary" data-act="new-post">New post</button>'));
}
function postEditor(p) {
  const b = 'posts/@' + p.id, cats = uniq(DRAFT.posts.map(x => x.category).filter(Boolean));
  const head = '<header class="admin-head"><div><button type="button" class="link-btn" data-act="back-posts">← All posts</button><h1>' + esc(p.title || 'New post') + '</h1></div><div class="btn-row"><button type="button" class="btn btn--sm btn--ghost" data-act="toggle-preview">' + (admin.preview ? 'Back to editing' : 'Preview') + '</button><button type="button" class="btn btn--sm btn--danger" data-act="del-post" data-id="' + esc(p.id) + '" data-confirm>Delete post</button></div></header>';
  if (admin.preview) return head + '<article class="panel post-preview"><div class="post">' + postArticle(p) + '</div></article>';
  return head + '<div class="editor-grid"><div class="panel form">' + fld('Title', b + '/title', p.title, { lg: true, placeholder: 'Post title' }) +
    fld('Summary', b + '/excerpt', p.excerpt, { type: 'textarea', rows: 2, hint: 'One or two sentences. Shown on the Journal page and in search results.' }) +
    '<div class="field"><label for="' + idFor(b + '/body') + '">Story</label><div class="toolbar" role="toolbar" aria-label="Formatting">' + [['h2', 'Heading'], ['bold', 'Bold'], ['italic', 'Italic'], ['list', 'List'], ['quote', 'Quote'], ['link', 'Link'], ['photo', 'Insert photo']].map(([k, l]) => '<button type="button" class="tool" data-act="fmt" data-fmt="' + k + '">' + l + '</button>').join('') + '</div>' +
    '<textarea id="' + idFor(b + '/body') + '" class="input" rows="20" data-bind="' + esc(b + '/body') + '">' + esc(p.body) + '</textarea><p class="hint">## Heading · **bold** · *italic* · - list item · &gt; quote · [link text](https://…). Leave an empty line between paragraphs.</p></div></div>' +
    '<aside class="panel form"><div class="field"><span class="label">Status</span><div class="seg" role="radiogroup" aria-label="Status">' + ['draft', 'published'].map(st => '<label class="seg-opt"><input type="radio" name="st-' + esc(p.id) + '" value="' + st + '" data-bind="' + esc(b + '/status') + '"' + (p.status === st ? ' checked' : '') + '><span>' + (st === 'draft' ? 'Draft' : 'Published') + '</span></label>').join('') + '</div></div>' +
    fld('Date', b + '/date', p.date, { type: 'date' }) + fld('Category', b + '/category', p.category, { list: 'cat-list', hint: 'Pick an existing one or type a new category.' }) + '<datalist id="cat-list">' + cats.map(c => '<option value="' + esc(c) + '">').join('') + '</datalist>' +
    fld('Author', b + '/author', p.author) + photoField('Cover photo', b + '/cover', p.cover) + fld('Link name', b + '/slug', p.slug, { hint: 'Fills in from the title. Letters, numbers and dashes.' }) +
    '<details class="sub"><summary>Search engines (optional)</summary>' + fld('SEO title', b + '/seoTitle', p.seoTitle || '') + fld('SEO description', b + '/seoDescription', p.seoDescription || '', { type: 'textarea', rows: 3 }) + '</details></aside></div>';
}
function tabPhotos() {
  const items = DRAFT.media, cats = mediaCats(DRAFT), need = items.filter(m => !m.assetId).length;
  const filters = ['All'].concat(need ? ['Needs photo'] : [], cats);
  if (filters.indexOf(admin.photoFilter) < 0) admin.photoFilter = 'All';
  const shown = admin.photoFilter === 'All' ? items : admin.photoFilter === 'Needs photo' ? items.filter(m => !m.assetId) : items.filter(m => m.category === admin.photoFilter);
  return '<header class="admin-head"><div><h1>Photos</h1><p class="muted">Every photo on the site lives here. Upload, add captions and choose where each one shows.</p></div></header>' +
    (need ? '<div class="notice"><span><strong>' + need + (need > 1 ? ' photo slots are' : ' photo slot is') + ' waiting for a photo.</strong> These are the logo and photos from the old website. Drop the files from the old site’s media library below: each one goes to its slot automatically by file name.</span></div>' : '') +
    '<label class="dropzone" id="dropzone" for="up-many"><input id="up-many" type="file" class="sr" accept="image/jpeg,image/png,image/webp,image/gif" multiple data-upload="many"><strong>Drop photos here, or click to choose</strong><span class="muted sm">JPG, PNG, WebP or GIF. Files from the old website fill their slots automatically. Big photos are resized to 2400 px.</span></label>' +
    '<div id="upload-tray" class="tray" hidden></div>' +
    '<div class="filter-row" role="group" aria-label="Filter photos">' + filters.map(c => '<button type="button" class="chip-btn' + (admin.photoFilter === c ? ' is-on' : '') + '" data-act="photo-filter" data-cat="' + esc(c) + '">' + esc(c) + (c === 'Needs photo' ? ' (' + need + ')' : '') + '</button>').join('') + '</div>' +
    '<datalist id="media-cats">' + uniq(cats.concat(['Estate', 'Rooms', 'Lounges', 'Pool', 'Cuisine', 'Guests', 'Art', 'Hosts', 'Property', 'Udaipur'])).map(c => '<option value="' + esc(c) + '">').join('') + '</datalist>' +
    (shown.length ? '<div class="media-grid">' + shown.map(mediaCard).join('') + '</div>' : emptyState('No photos here', 'Upload photos above to get started.'));
}
function mediaCard(m) {
  const b = 'media/@' + m.id, n = usedIn(m.id);
  return '<article class="media-card' + (m.assetId ? '' : ' is-empty') + '"><div class="media-thumb">' + pic(m) + (m.assetId ? '' : '<span class="badge">Needs photo</span>') + '</div><div class="media-body">' +
    fld('Caption', b + '/caption', m.caption, { placeholder: 'Describe the photo' }) + fld('Category', b + '/category', m.category, { list: 'media-cats' }) +
    '<div class="checks">' + fld('Show in gallery', b + '/showInGallery', m.showInGallery !== false, { type: 'checkbox' }) + fld('Feature on home page', b + '/featured', !!m.featured, { type: 'checkbox' }) + '</div>' +
    (m.sourceUrl ? '<p class="hint">Old website file: <span class="src">' + esc(m.sourceUrl.replace(/^https?:\/\/[^/]+\/wp-content\/uploads\//, '')) + '</span></p>' : '') +
    '<p class="hint">' + (n ? 'Used in ' + n + (n > 1 ? ' places' : ' place') + ' on the site.' : 'Not used on any page yet.') + '</p>' +
    '<div class="btn-row"><button type="button" class="btn btn--sm btn--ghost" data-act="upload-for" data-id="' + esc(m.id) + '">' + (m.assetId ? 'Replace photo' : 'Upload photo') + '</button><button type="button" class="btn btn--sm btn--quiet danger" data-act="media-del" data-id="' + esc(m.id) + '" data-confirm>Remove</button></div></div></article>';
}
function sectionEditor(k) {
  const x = DRAFT.sections[k], b = 'sections/' + k;
  return '<details class="panel sec" data-key="' + k + '"' + (admin.open.has(k) ? ' open' : '') + '><summary><span class="sum-t">' + esc(x.title || k) + '<small>' + esc(x.eyebrow || '') + '</small></span></summary><div class="form sec-body">' +
    fld('Small heading', b + '/eyebrow', x.eyebrow) + fld('Title', b + '/title', x.title) + fld('Text', b + '/body', x.body, { type: 'textarea', rows: 8, hint: 'Leave an empty line between paragraphs.' }) +
    ('items' in x ? fld('List', b + '/items', x.items, { type: 'lines', rows: 7, hint: 'One item per line.' }) : '') +
    ('photo' in x ? photoField('Photo', b + '/photo', x.photo) : '') + ('photo2' in x ? photoField('Second photo', b + '/photo2', x.photo2) : '') + '</div></details>';
}
function tabPages() {
  return '<header class="admin-head"><div><h1>Page text</h1><p class="muted">Edit the headings, text, lists and photos on every page. Logo, hero slider and contact details are in Site settings.</p></div></header>' +
    PAGE_GROUPS.map(([g, pageKey, keys]) => {
      const pg = pageKey ? (DRAFT.pages[pageKey] || (DRAFT.pages[pageKey] = { title: g, lead: '', photo: null })) : null;
      const head = pg ? '<div class="panel form"><h3 class="panel-title">Page banner</h3><div class="form-2">' + fld('Page title', 'pages/' + pageKey + '/title', pg.title) + fld('Intro line', 'pages/' + pageKey + '/lead', pg.lead) + '</div>' + photoField('Banner photo', 'pages/' + pageKey + '/photo', pg.photo) + '</div>' : '';
      return '<section class="page-group"><h2>' + esc(g) + '</h2>' + head + keys.filter(k => DRAFT.sections[k]).map(sectionEditor).join('') + '</section>';
    }).join('');
}
function listItem(lp, cfg, it, i, n) {
  const b = lp + '/@' + it.id;
  return '<article class="panel list-item"><div class="list-item-head"><span class="num muted">' + (i + 1) + '</span><strong>' + esc(it[cfg.fields[0][0]] || 'Untitled') + '</strong><div class="btn-row">' +
    '<button type="button" class="btn btn--sm btn--quiet" data-act="list-up" data-list="' + lp + '" data-id="' + esc(it.id) + '" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '>↑</button><button type="button" class="btn btn--sm btn--quiet" data-act="list-down" data-list="' + lp + '" data-id="' + esc(it.id) + '" aria-label="Move down"' + (i === n - 1 ? ' disabled' : '') + '>↓</button>' +
    '<button type="button" class="btn btn--sm btn--quiet danger" data-act="list-del" data-list="' + lp + '" data-id="' + esc(it.id) + '" data-confirm>Remove</button></div></div><div class="form">' +
    cfg.fields.map(([k, l, t]) => t === 'photo' ? photoField(l, b + '/' + k, it[k]) : fld(l, b + '/' + k, it[k], { type: t === 'textarea' ? 'textarea' : 'text', rows: 3 })).join('') + '</div></article>';
}
function tabList(lp, title, desc) {
  const cfg = LISTS[lp], arr = getPath(DRAFT, lp) || [];
  return '<header class="admin-head"><div><h1>' + esc(title) + '</h1><p class="muted">' + esc(desc) + '</p></div><button type="button" class="btn btn--primary" data-act="list-add" data-list="' + lp + '">Add ' + cfg.label.toLowerCase() + '</button></header>' +
    (arr.length ? '<div class="stack">' + arr.map((it, i) => listItem(lp, cfg, it, i, arr.length)).join('') + '</div>' : emptyState('Nothing here yet', 'Use “Add ' + cfg.label.toLowerCase() + '” to create the first one.'));
}
function inlineList(lp) {
  const cfg = LISTS[lp], arr = getPath(DRAFT, lp) || [];
  const hasPhoto = cfg.fields.some(f => f[2] === 'photo');
  return '<div class="inline-list">' + arr.map((it, i) => '<div class="inline-row' + (hasPhoto ? ' inline-row--photo' : '') + '">' + cfg.fields.map(([k, l, t]) => t === 'photo' ? photoField(l, lp + '/@' + it.id + '/' + k, it[k]) : fld(l, lp + '/@' + it.id + '/' + k, it[k])).join('') +
    '<div class="inline-acts"><button type="button" class="btn btn--sm btn--quiet" data-act="list-up" data-list="' + lp + '" data-id="' + esc(it.id) + '" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '>↑</button><button type="button" class="btn btn--sm btn--quiet danger" data-act="list-del" data-list="' + lp + '" data-id="' + esc(it.id) + '" data-confirm>Remove</button></div></div>').join('') +
    '</div><div class="btn-row"><button type="button" class="btn btn--sm btn--ghost" data-act="list-add" data-list="' + lp + '">Add ' + cfg.label.toLowerCase() + '</button></div>';
}
function tabSettings() {
  const s = DRAFT.settings, b = 'settings';
  return '<header class="admin-head"><div><h1>Site settings</h1><p class="muted">Logo, home page hero slider, booking link, contact details and social links.</p></div></header>' +
    '<section class="panel form"><h2 class="panel-title">Logo</h2>' + photoField('Logo', b + '/logo', s.logo) + '<p class="hint">Shown in the header and footer. Until it has a file, the site name is shown in the brand typeface.</p></section>' +
    '<section class="panel form"><h2 class="panel-title">Home page hero</h2>' + fld('Small heading', b + '/tagline', s.tagline) + fld('Headline', b + '/heroTitle', s.heroTitle) + fld('Sub-headline', b + '/heroSubtitle', s.heroSubtitle) +
    '<p class="label">Slider photos</p><p class="hint">Photos rotate every few seconds with a slow zoom. Slides without an uploaded photo are skipped; with none, the animated Aravalli scene is shown.</p>' + inlineList('settings/heroSlides') + '</section>' +
    '<section class="panel form"><h2 class="panel-title">At a glance</h2><p class="hint">The facts on the glass band under the home page hero. Numbers count up when they come into view.</p>' + inlineList('settings/facts') + '</section>' +
    '<section class="panel form"><h2 class="panel-title">Moving ribbon</h2>' + fld('Phrases', b + '/marquee', s.marquee, { type: 'lines', rows: 6, hint: 'One phrase per line. They scroll across the indigo ribbon.' }) + '</section>' +
    '<section class="panel form"><h2 class="panel-title">Booking & contact</h2>' + fld('Booking engine link', b + '/bookingUrl', s.bookingUrl, { type: 'url' }) + '<div class="form-2">' + fld('Main phone', b + '/phonePrimary', s.phonePrimary) + fld('WhatsApp number', b + '/whatsapp', s.whatsapp, { hint: 'Country code and number, digits only. Enquiries go here.' }) + '</div>' +
    fld('Other phone numbers', b + '/phonesOther', s.phonesOther, { type: 'lines', rows: 3, hint: 'One per line.' }) + fld('Email', b + '/email', s.email, { type: 'email' }) + fld('Address', b + '/address', s.address, { type: 'textarea', rows: 3 }) + fld('Google Maps link', b + '/mapsUrl', s.mapsUrl, { type: 'url' }) + fld('Virtual tour link', b + '/tourUrl', s.tourUrl, { type: 'url', hint: 'YouTube video or channel for the “Watch the virtual tour” button.' }) + '</section>' +
    '<section class="panel form"><h2 class="panel-title">How to reach</h2><p class="hint">Drawn as an animated route on the home, About and Contact pages.</p>' + inlineList('settings/reach') + '</section>' +
    '<section class="panel form"><h2 class="panel-title">Booking banner</h2>' + fld('Title', b + '/ctaTitle', s.ctaTitle) + fld('Text', b + '/ctaText', s.ctaText, { type: 'textarea', rows: 2 }) + '</section>' +
    '<section class="panel form"><h2 class="panel-title">Social links</h2><div class="form-2">' + Object.keys(SOCIAL_NAMES).map(k => fld(SOCIAL_NAMES[k], b + '/socials/' + k, (s.socials || {})[k], { type: 'url' })).join('') + '</div></section>' +
    '<section class="panel form"><h2 class="panel-title">Footer & search engines</h2>' + fld('Site name', b + '/siteName', s.siteName) + fld('Footer text', b + '/footerAbout', s.footerAbout, { type: 'textarea', rows: 3 }) + fld('Meta title', b + '/seoTitle', s.seoTitle) + fld('Meta description', b + '/seoDescription', s.seoDescription, { type: 'textarea', rows: 3, hint: 'Used by search engines once the site is live on your domain.' }) + '</section>';
}

/* ---------- Photo picker ---------- */
function openPicker(o) { picker = Object.assign({ cat: 'All' }, o); renderPicker(); const c = document.querySelector('.modal [data-act="pick-close"]'); if (c) c.focus(); }
function renderPicker() {
  const root = document.getElementById('modal-root'); if (!root) return;
  if (!picker) { root.innerHTML = ''; return; }
  const cats = ['All'].concat(mediaCats(DRAFT));
  const items = DRAFT.media.filter(m => picker.cat === 'All' || m.category === picker.cat);
  root.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="pk-title"><div class="modal-panel"><header class="modal-head"><h2 id="pk-title">Choose a photo</h2><button type="button" class="btn btn--sm btn--ghost" data-act="pick-close">Close</button></header>' +
    '<div class="filter-row">' + cats.map(c => '<button type="button" class="chip-btn' + (picker.cat === c ? ' is-on' : '') + '" data-act="pick-cat" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join('') +
    '<label class="btn btn--sm btn--primary" for="up-pick">Upload new<input id="up-pick" type="file" class="sr" accept="image/jpeg,image/png,image/webp,image/gif" data-upload="pick"></label></div><p class="hint">Patterned tiles are placeholders that still need their photo uploaded.</p>' +
    '<div class="pick-grid">' + items.map(m => '<button type="button" class="pick-item" data-act="pick-choose" data-id="' + esc(m.id) + '">' + pic(m) + '<span>' + esc(m.caption || 'Untitled') + '</span></button>').join('') + '</div></div></div>';
}
function choosePicked(id) {
  if (!picker) return;
  if (picker.mode === 'insert') {
    const ta = document.getElementById(picker.target), m = findMedia(id, DRAFT);
    if (ta) { const at = typeof picker.at === 'number' ? picker.at : ta.value.length; ta.setRangeText('\n\n![' + ((m && m.caption) || '').replace(/[\[\]]/g, '') + '](media:' + id + ')\n\n', at, at, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
    picker = null; renderPicker(); if (ta) ta.focus(); return;
  }
  setPath(DRAFT, picker.path, id); picker = null; markDirty(); renderAdmin();
}
function fmt(kind) {
  const ta = document.getElementById(idFor('posts/@' + admin.postId + '/body')); if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e);
  if (kind === 'photo') { openPicker({ mode: 'insert', target: ta.id, at: e }); return; }
  if (kind === 'h2' || kind === 'list' || kind === 'quote') { const pre = kind === 'h2' ? '## ' : kind === 'list' ? '- ' : '> '; const ls = ta.value.lastIndexOf('\n', s - 1) + 1; ta.setRangeText(pre, ls, ls, 'end'); }
  else { const w = kind === 'bold' ? ['**', '**', 'bold text'] : kind === 'italic' ? ['*', '*', 'italic text'] : ['[', '](https://)', 'link text']; ta.setRangeText(w[0] + (sel || w[2]) + w[1], s, e, 'select'); }
  ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true }));
}
function confirmed(btn) {
  if (!btn.hasAttribute('data-confirm') || btn.dataset.armed === '1') return true;
  btn.dataset.armed = '1'; btn.dataset.label = btn.textContent; btn.textContent = btn.dataset.confirmText || 'Click again to confirm'; btn.classList.add('is-armed');
  setTimeout(() => { if (btn.isConnected && btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.textContent = btn.dataset.label; btn.classList.remove('is-armed'); } }, 4000);
  return false;
}

/* ---------- Actions ---------- */
function setMenu(open) {
  ui.menuOpen = open;
  const nav = document.getElementById('site-nav'), btn = document.querySelector('[data-act="menu"]'), head = document.getElementById('site-head');
  if (nav) nav.classList.toggle('open', open);
  if (head) head.classList.toggle('menu-open', open);
  if (btn) { btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'Close' : 'Menu'; }
  onScroll();
}
function onAct(el, e) {
  const act = el.dataset.act;
  switch (act) {
    case 'menu': setMenu(!ui.menuOpen); break;
    case 'to-top': e.preventDefault(); window.scrollTo({ top: 0, behavior: RM.matches ? 'auto' : 'smooth' }); break;
    case 'copy': copyText(el.dataset.copy || '', el); break;
    case 'slide': if (sliderShow) sliderShow(Number(el.dataset.i) || 0); break;
    case 'rail': { const r = document.getElementById('exp-rail'); if (r) { const card = r.firstElementChild; r.scrollBy({ left: (card ? card.getBoundingClientRect().width + 24 : 300) * Number(el.dataset.dir), behavior: RM.matches ? 'auto' : 'smooth' }); } break; }
    case 'lightbox': lb = { set: el.dataset.set, i: Number(el.dataset.i) || 0 }; renderLightbox(); break;
    case 'story': sv = { i: Number(el.dataset.i) || 0, j: 0 }; svReturn = el; renderStory(); break;
    case 'story-close': closeStory(); break;
    case 'story-prev': if (sv) { sv.j--; renderStory(); } break;
    case 'story-next': if (sv) { sv.j++; renderStory(); } break;
    case 'lb-close': lb = null; renderLightbox(); break;
    case 'lb-prev': if (lb) { lb.i--; renderLightbox(); } break;
    case 'lb-next': if (lb) { lb.i++; renderLightbox(); } break;
    case 'gal-cat': ui.galleryCat = el.dataset.cat; { const y = window.scrollY; render(); window.scrollTo(0, y); } break;
    case 'journal-cat': ui.journalCat = el.dataset.cat; { const y = window.scrollY; render(); window.scrollTo(0, y); } break;
    case 'enq-send': {
      const f = document.getElementById('enq-form'), err = document.getElementById('enq-err'), name = f && f.elements.name ? f.elements.name.value.trim() : '';
      if (!waNumber()) { e.preventDefault(); if (err) { err.textContent = 'WhatsApp is not set up yet. Please call or email us instead.'; err.hidden = false; } break; }
      if (!name) { e.preventDefault(); if (err) { err.textContent = 'Add your name so we know who is enquiring.'; err.hidden = false; } if (f) f.elements.name.focus(); break; }
      if (err) err.hidden = true; el.href = waLink(enqText()); break;
    }
    case 'enq-copy': copyText(enqText(), el); break;
    case 'leave-admin': ui.previewDraft = false; try { history.pushState(null, '', location.pathname + location.search); } catch (x) {} render(); window.scrollTo(0, 0); break;
    case 'stop-preview': ui.previewDraft = false; location.hash = 'admin'; break;
    case 'preview-site': ui.previewDraft = true; try { history.pushState(null, '', location.pathname + location.search); } catch (x) {} render(); window.scrollTo(0, 0); break;
    case 'publish': publishNow(false); break;
    case 'discard': if (!confirmed(el)) break; DRAFT = clone(STATE); dirty = false; lsClear(); if (admin.postId && !DRAFT.posts.some(p => p.id === admin.postId)) admin.postId = null; toast('Unpublished changes discarded.'); renderAdmin(); break;
    case 'restore-draft': if (admin.restore) { DRAFT = fixShape(admin.restore.draft); admin.restore = null; markDirty(); toast('Changes restored. Publish when you are ready.'); renderAdmin(); } break;
    case 'drop-draft': admin.restore = null; lsClear(); renderAdmin(); break;
    case 'tab': setTab(el.dataset.tab); break;
    case 'new-post': {
      const p = { id: uid('p'), slug: '', title: '', excerpt: '', body: '', category: 'Life at Devra', author: 'Team Devra', date: today(), status: 'draft', cover: null };
      DRAFT.posts.unshift(p); admin.tab = 'journal'; admin.postId = p.id; admin.preview = false; markDirty(); renderAdmin(false); window.scrollTo(0, 0);
      const t = document.getElementById(idFor('posts/@' + p.id + '/title')); if (t) t.focus(); break;
    }
    case 'edit-post': admin.postId = el.dataset.id; admin.preview = false; renderAdmin(false); window.scrollTo(0, 0); break;
    case 'back-posts': admin.postId = null; admin.preview = false; renderAdmin(false); window.scrollTo(0, 0); break;
    case 'toggle-preview': admin.preview = !admin.preview; renderAdmin(false); window.scrollTo(0, 0); break;
    case 'del-post': if (!confirmed(el)) break; DRAFT.posts = DRAFT.posts.filter(p => p.id !== el.dataset.id); admin.postId = null; markDirty(); toast('Post deleted. Publish to remove it from the site.'); renderAdmin(false); break;
    case 'fmt': fmt(el.dataset.fmt); break;
    case 'pick': openPicker({ mode: 'path', path: el.dataset.path }); break;
    case 'pick-clear': setPath(DRAFT, el.dataset.path, null); markDirty(); renderAdmin(); break;
    case 'pick-close': picker = null; renderPicker(); break;
    case 'pick-cat': if (picker) { picker.cat = el.dataset.cat; renderPicker(); } break;
    case 'pick-choose': choosePicked(el.dataset.id); break;
    case 'photo-filter': admin.photoFilter = el.dataset.cat; renderAdmin(); break;
    case 'upload-for': { admin.uploadFor = el.dataset.id; const inp = document.getElementById('up-one'); if (inp) { inp.value = ''; inp.click(); } break; }
    case 'media-del': {
      const n = usedIn(el.dataset.id);
      if (n && !el.dataset.confirmText) el.dataset.confirmText = 'Used in ' + n + (n > 1 ? ' places' : ' place') + '. Click again';
      if (!confirmed(el)) break;
      clearRefs(el.dataset.id); DRAFT.media = DRAFT.media.filter(m => m.id !== el.dataset.id); markDirty(); toast('Photo removed. Publish to update the site.'); renderAdmin(); break;
    }
    case 'list-add': {
      const lp = el.dataset.list, cfg = LISTS[lp]; let arr = getPath(DRAFT, lp);
      if (!Array.isArray(arr)) { arr = []; setPath(DRAFT, lp, arr); }
      const it = { id: uid('x') }; cfg.fields.forEach(([k, , t]) => { it[k] = t === 'photo' ? null : ''; });
      arr.push(it); markDirty(); renderAdmin();
      const first = document.getElementById(idFor(lp + '/@' + it.id + '/' + cfg.fields[0][0])); if (first) { first.focus(); first.scrollIntoView({ block: 'center' }); }
      break;
    }
    case 'list-del': { if (!confirmed(el)) break; const arr = getPath(DRAFT, el.dataset.list) || []; const i = arr.findIndex(x => x.id === el.dataset.id); if (i >= 0) arr.splice(i, 1); markDirty(); renderAdmin(); break; }
    case 'list-up': case 'list-down': { const arr = getPath(DRAFT, el.dataset.list) || []; const i = arr.findIndex(x => x.id === el.dataset.id), j = act === 'list-up' ? i - 1 : i + 1; if (i >= 0 && j >= 0 && j < arr.length) { const t = arr[i]; arr[i] = arr[j]; arr[j] = t; markDirty(); renderAdmin(); } break; }
    case 'export': exportJson(); break;
    case 'usage-reload': admin.usage = null; ensureUsage(); renderAdmin(); break;
    case 'cleanup': if (!confirmed(el)) break; cleanupUnused(); break;
  }
}
async function exportJson() {
  const data = JSON.stringify(STATE, null, 2);
  if (caps.downloads) { try { await caps.downloads.save({ filename: 'devra-udaipur-content.json', data: data }); return; } catch (e) { if (e && e.code === 'declined') return; } }
  try { await navigator.clipboard.writeText(data); toast('Content copied to the clipboard as JSON.'); } catch (e) { toast('Export is not available in this view.', 'error'); }
}
async function cleanupUnused() {
  const u = admin.usage; if (!caps.assets || !u || !u.assets) return;
  const refs = referencedAssets(), unused = u.assets.filter(a => !refs.has(a.id));
  let n = 0;
  for (const a of unused) { try { await caps.assets.delete(a.id); n++; } catch (e) { if (e && e.code === 'rate_limited') break; } }
  toast(n + (n === 1 ? ' unused file deleted.' : ' unused files deleted.')); admin.usage = null; ensureUsage(); renderAdmin();
}
function applyBind(el) {
  if (!DRAFT) return;
  const path = el.dataset.bind; let v;
  if (el.type === 'checkbox') v = el.checked;
  else if (el.type === 'radio') { if (!el.checked) return; v = el.value; }
  else if (el.dataset.type === 'lines') v = el.value.split('\n').map(x => x.trim()).filter(Boolean);
  else v = el.value;
  setPath(DRAFT, path, v);
  const m = path.match(/^posts\/@([^/]+)\/(title|slug)$/);
  if (m) { const p = DRAFT.posts.find(x => x.id === m[1]); if (p) { if (m[2] === 'slug') p.slugEdited = true; else if (!p.slugEdited) { p.slug = slugify(v); const sl = document.getElementById(idFor('posts/@' + p.id + '/slug')); if (sl) sl.value = p.slug; } } }
  markDirty();
}

/* ---------- Global listeners ---------- */
document.addEventListener('click', e => {
  const act = e.target.closest && e.target.closest('[data-act]');
  if (act && !act.disabled) onAct(act, e);
  if (ui.menuOpen && e.target.closest && e.target.closest('#site-nav a')) setMenu(false);
  if (e.target.classList && e.target.classList.contains('modal')) { picker = null; renderPicker(); }
  if (e.target.classList && e.target.classList.contains('lightbox')) { lb = null; renderLightbox(); }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.matches && el.matches('[data-bind]') && el.type !== 'checkbox' && el.type !== 'radio') applyBind(el);
  if (el.closest && el.closest('#enq-form')) { const a = document.getElementById('enq-send'); if (a) a.href = waLink(enqText()); }
});
document.addEventListener('change', e => {
  const el = e.target; if (!el.matches) return;
  if (el.matches('[data-bind]') && (el.type === 'checkbox' || el.type === 'radio')) applyBind(el);
  if (el.matches('input[type=file][data-upload]')) {
    const files = Array.from(el.files || []), kind = el.dataset.upload; el.value = '';
    if (!files.length) return;
    if (kind === 'many') handleUploadMany(files); else if (kind === 'one' && admin.uploadFor) handleUploadFor(admin.uploadFor, files); else if (kind === 'pick') handleUploadPick(files);
  }
});
document.addEventListener('submit', e => { if (e.target && e.target.id === 'enq-form') { e.preventDefault(); const a = document.getElementById('enq-send'); if (a) a.focus(); } });
document.addEventListener('toggle', e => { const d = e.target; if (d && d.matches && d.matches('details.sec')) { if (d.open) admin.open.add(d.dataset.key); else admin.open.delete(d.dataset.key); } }, true);
document.addEventListener('dragover', e => { const dz = e.target.closest && e.target.closest('.dropzone'); if (dz) { e.preventDefault(); dz.classList.add('is-over'); } });
document.addEventListener('dragleave', e => { const dz = e.target.closest && e.target.closest('.dropzone'); if (dz && !dz.contains(e.relatedTarget)) dz.classList.remove('is-over'); });
document.addEventListener('drop', e => { const dz = e.target.closest && e.target.closest('.dropzone'); if (dz) { e.preventDefault(); dz.classList.remove('is-over'); if (e.dataTransfer && e.dataTransfer.files) handleUploadMany(e.dataTransfer.files); } });
let svTouch = null;
document.addEventListener('touchstart', e => { if (sv && e.target.closest && e.target.closest('.sv')) { const t = e.touches[0]; svTouch = { x: t.clientX, y: t.clientY }; } }, { passive: true });
document.addEventListener('touchend', e => { if (!sv || !svTouch) return; const t = e.changedTouches[0], dx = t.clientX - svTouch.x, dy = t.clientY - svTouch.y; svTouch = null; if (dy > 90 && Math.abs(dy) > Math.abs(dx)) closeStory(); else if (Math.abs(dx) > 50) { sv.j += dx < 0 ? 1 : -1; renderStory(); } }, { passive: true });
document.addEventListener('keydown', e => {
  if (sv) { if (e.key === 'Escape') closeStory(); else if (e.key === 'ArrowLeft') { sv.j--; renderStory(); } else if (e.key === 'ArrowRight') { sv.j++; renderStory(); } return; }
  if (lb) { if (e.key === 'Escape') { lb = null; renderLightbox(); } else if (e.key === 'ArrowLeft') { lb.i--; renderLightbox(); } else if (e.key === 'ArrowRight') { lb.i++; renderLightbox(); } return; }
  if (e.key === 'Escape' && picker) { picker = null; renderPicker(); return; }
  if (e.key === 'Escape' && ui.menuOpen) setMenu(false);
});
window.addEventListener('hashchange', () => { if (IS_INDEX || PAGE === 'post') { render(); window.scrollTo(0, 0); } });
window.addEventListener('popstate', () => { if (IS_INDEX) render(); });
window.addEventListener('scroll', () => { if (scrollRaf) return; scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; onScroll(); }); }, { passive: true });
window.addEventListener('pointermove', e => { pointer.x = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1; pointer.y = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1; }, { passive: true });
window.addEventListener('resize', () => { scenes.forEach(s => { s.ridgeTop = null; }); if (RM.matches) scenes.forEach(s => drawScene(s, 0)); });
const recolor = () => { colorEpoch++; if (RM.matches) scenes.forEach(s => drawScene(s, 0)); };
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor); } catch (e) {}
try { new MutationObserver(recolor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) {}
window.addEventListener('beforeunload', () => { if (dirty && !publishing) lsSet(); });

/* ---------- Capabilities & boot ---------- */
async function initCaps() {
  if (!IS_INDEX) return;
  const C = window.claude;
  const use = n => (C && typeof C.use === 'function') ? Promise.resolve(C.use(n)).catch(() => null) : Promise.resolve(null);
  const res = await Promise.all([use('user'), use('artifact'), use('assets'), use('downloads')]);
  caps.user = res[0]; caps.artifact = res[1]; caps.assets = res[2]; caps.downloads = res[3];
  let edit = false; try { edit = caps.user ? !!(await caps.user.canEdit()) : false; } catch (e) {}
  access = edit ? 'editor' : 'viewer';
  if (location.hash === '#admin') render();
}
function hideCurtain() { const c = document.getElementById('curtain'); if (c) { c.classList.add('gone'); setTimeout(() => c.remove(), 600); } }
async function boot() {
  const st = IS_INDEX ? unstash() : null;
  if (st && st.tab) admin.tab = st.tab;
  if (st && st.postId) admin.postId = st.postId;
  const embedded = readEmbedded();
  if (IS_INDEX && embedded) {
    const freshP = fetchJson('content.json');
    const quick = await withTimeout(freshP, 450);
    STATE = fixShape(newest([embedded, quick]) || embedded);
    render();
    if (st && st.flash) setTimeout(() => toast(st.flash), 300);
    initCaps();
    if (!quick) {
      const late = await withTimeout(freshP, 6000);
      if (late && (Number(late.rev) || 0) > (Number(STATE.rev) || 0) && !dirty) { STATE = fixShape(late); DRAFT = null; render(); }
    }
    return;
  }
  const got = await Promise.all([withTimeout(fetchJson('content.json'), 8000), withTimeout(fetchIndexState(), 8000)]);
  const best = newest(got.concat([embedded]));
  if (!best) { APP.innerHTML = '<div class="wrap admin-gate"><h1>This page could not load</h1><p class="lead muted">Check your connection and reload the page.</p><div class="btn-row"><a class="btn btn--primary" href="' + LINKS.home + '">Go to the home page</a></div></div>'; hideCurtain(); return; }
  STATE = fixShape(best);
  render();
  hideCurtain();
  initCaps();
}
boot();
})();
