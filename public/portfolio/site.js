/* Portfolio. Everything that is not a drawing.

   The site is one JSON document (DEFAULTS below is what it starts as). Each
   page is drawn from that document, so changing a word in edit mode changes
   it everywhere it appears.

     /portfolio/session   are you signed in, and are you the owner
     /portfolio/data      the document: everyone reads, the owner writes
     /portfolio/upload    the owner sends a picture, gets its address back

   The owner is whoever is an admin on the feed. Sign in on the feed, come
   back here, and the pink edit bar appears in the bottom corner. */

(function () {
  const W = 1200;
  const SIZES = { home: 1024, about: 1100, work: 1100 };
  const PAGE = document.getElementById('stage').dataset.page;
  const online = location.protocol !== 'file:';

  /* ---------------- the starting content ---------------- */
  const DEFAULTS = {
    badge: { top: "that's SO", name: 'me' },
    siteName: 'My Portfolio',
    /* the small words around the edges, so every word on the site can be typed over */
    words: {
      my: 'my', workPlay: 'WORK &\nPLAY', homeButton: 'HOME', finder: 'GIG\nFINDER', homeTab: 'Home',
      allAbout: 'All About', comingSoon: 'Coming Soon', newWork: 'New Work', scroll: 'SCROLL',
      disc: 'LIVE', ratingTop: 'TV', rating: 'A', seal: 'ALL\nAGES'
    },
    home: {
      title: 'Portfolio Madness',
      featured: '',
      coverTitle: 'Portfolio Madness',
      coverStrip: 'FROM THE ONE-AND-ONLY LIVE RESUME',
      spine: 'Portfolio Madness',
      portrait: '',
      available: 'Now Available For Booking',
      phone: 'Book Me',
      flower: "Tell Me What You'd Like To See Next",
      nav: ['Home', 'About Me', 'Portfolio', 'DJ Gigs', 'Parties', 'Book Me']
    },
    about: {
      tag: 'Issue Vol.1',
      banner: 'Design · Modeling · DJ · Painting · 3D · Rooms · Parties',
      cover: '',
      coverTitle: 'All About Me',
      coverStrip: 'FROM THE ONE-AND-ONLY LIVE RESUME',
      tabs: ['My Story', 'Bonus Features'],
      story: "Hi! This is where you say who you are.\n\nI do a little bit of everything: graphic design, modeling, DJ sets, painting, 3D modeling, rooms and renovation, and throwing the kind of party people talk about after.\n\nThis page is the live version of my resume. Turn on edit mode and type right over this.",
      bonus: "THE RESUME\n\n• Graphic design: who you have made things for\n• Modeling: shoots, shows, agencies\n• DJ: clubs, parties, residencies\n• Painting and art: shows, commissions\n• 3D: what you build it in, what you have built\n• Rooms: spaces you decorated or renovated\n• Events: parties hosted and organized\n\nSkills, tools, awards, press. All of it goes here.",
      nav: [
        { big: 'All About Me', small: '', go: 'tab:0' },
        { big: 'Sneak Peek At', small: 'My Latest Work', go: 'work' },
        { big: 'Exclusive!', small: 'The Whole Resume', go: 'tab:1' },
        { big: "What's Hot?", small: 'The Portfolio', go: 'work' },
        { big: 'More Fabulous Stuff', small: '', go: 'work:events' }
      ]
    },
    workTabs: ['The Story', 'The Details'],
    bookMe: 'Book Me',
    contact: { email: '' },
    categories: [
      cat('graphic-design', 'Graphic Design', 'dvd', '#7b3fa0'),
      cat('modeling', 'Modeling', 'cd', '#e0457b'),
      cat('dj', 'DJ Gigs', 'cd', '#2e2a78'),
      cat('painting', 'Painting & Art', 'dvd', '#ef8a24'),
      cat('3d', '3D Modeling', 'dvd', '#1f8a9e'),
      cat('rooms', 'Rooms & Renovation', 'dvd', '#5f9e45'),
      cat('events', 'Parties & Events', 'cd', '#d93f8c')
    ]
  };

  function cat(id, title, kind, color) {
    return {
      id, title, kind, color,
      cover: '',
      caption: title,
      story: `Write about your ${title.toLowerCase()} here: who it was for, what you made, and what you are proud of.\n\nThen add each project with "+ add a project" in the edit bar. Every project gets its own cover and its own story.`,
      details: 'Dates, places, clients, tools, credits.',
      items: []
    };
  }

  /* ---------------- state ---------------- */
  let doc = clone(DEFAULTS);
  let isOwner = false;
  let signedIn = false;
  let editing = false;
  let tab = 0;
  const params = new URLSearchParams(location.search);
  let catId = params.get('c');
  let itemId = params.get('p');

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* Fill in anything the saved document is missing from DEFAULTS, so a new
     field added to the site later shows up on an old saved document. */
  function withDefaults(saved, base) {
    if (Array.isArray(base)) return Array.isArray(saved) ? saved : clone(base);
    if (base && typeof base === 'object') {
      const out = {};
      const src = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
      Object.keys(base).forEach(k => { out[k] = withDefaults(src[k], base[k]); });
      Object.keys(src).forEach(k => { if (!(k in out)) out[k] = src[k]; });
      return out;
    }
    return saved === undefined || saved === null ? base : saved;
  }

  function get(path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), doc);
  }
  function set(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const parent = keys.reduce((o, k) => o[k], doc);
    parent[last] = value;
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* Only real web addresses go into src and href. */
  const safeUrl = u => (/^https:\/\//i.test(u || '') ? u : '');

  /* An editable piece of text. multi lets it take new lines. */
  function t(path, tag, cls, multi) {
    tag = tag || 'span';
    return `<${tag} class="${cls || ''}" data-bind="${path}"${multi ? ' data-multi' : ''}>${esc(get(path))}</${tag}>`;
  }

  function bookHref() {
    const e = (doc.contact.email || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? 'mailto:' + e : 'about.html';
  }

  function category(id) {
    return doc.categories.find(c => c.id === id) || doc.categories[0];
  }

  /* ---------------- shared pieces ---------------- */

  function badge(cls) {
    /* the name fills the circle however long it is */
    const len = Math.max(2, String(doc.badge.name || '').length);
    const size = Math.round(Math.min(112, 232 / (len * 0.52)));
    return `<div class="badge ${cls || ''}" style="--name-size:${size}px"><a href="index.html" class="badge-in" data-nolink-edit>
      ${t('badge.top', 'span', 'badge-top')}
      ${t('badge.name', 'span', 'badge-name')}
    </a></div>`;
  }

  /* A picture, or the stand-in drawn when there is none yet. */
  function pic(path, label, cls) {
    const url = safeUrl(get(path));
    const inner = url
      ? `<img src="${esc(url)}" alt="" loading="lazy">`
      : `<span class="empty"><span class="empty-label">${esc(label || '')}</span></span>`;
    return `<span class="pic ${cls || ''}" data-img="${path}">${inner}<span class="swap">change picture</span></span>`;
  }

  /* The big DVD: spine, cover, a badge and title printed on the cover. */
  function dvd(imgPath, titlePath, stripPath, spinePath, color, cls) {
    return `<div class="dvd ${cls || ''}" style="--case:${esc(color || '#7b3fa0')}">
      <div class="dvd-spine">${t('badge.name', 'span', 'spine-badge')}${t(spinePath || titlePath, 'span', 'spine-text')}</div>
      <div class="dvd-front">
        ${pic(imgPath, 'your cover photo')}
        <div class="cover-badge">${t('badge.top')}${t('badge.name', 'b')}</div>
        ${t(titlePath, 'div', 'cover-title')}
        ${t(stripPath, 'div', 'cover-strip')}
      </div>
      <div class="dvd-sheen"></div>
    </div>`;
  }

  /* The row of little cases along the bottom, one per category. */
  function shelf(cls) {
    return `<div class="shelf ${cls || ''}">` + doc.categories.map((c, i) => {
      const caseCls = c.kind === 'cd' ? 'mini-cd' : 'mini-dvd';
      const url = safeUrl(c.cover);
      return `<a class="shelf-item" href="work.html?c=${encodeURIComponent(c.id)}">
        <span class="${caseCls}" style="--case:${esc(c.color)}">
          ${url ? `<img src="${esc(url)}" alt="">` : t('categories.' + i + '.title', 'span', 'mini-empty')}
        </span>
        ${t('categories.' + i + '.caption', 'span', 'shelf-cap')}
      </a>`;
    }).join('') + `</div>`;
  }

  function rating() {
    return `<div class="rating" title="Rated A for Available"><span class="r-g">${t('words.ratingTop', 'small')}${t('words.rating')}</span>${t('words.seal', 'span', 'r-seal', true)}</div>`;
  }

  function soundButton(cls) {
    return `<button type="button" class="sound ${cls || ''}" data-sound>SOUND <br>${sound ? 'ON' : 'OFF'}</button>`;
  }

  /* ---------------- the homepage ---------------- */
  function homePage() {
    const navHref = ['index.html', 'about.html', 'work.html', 'work.html?c=dj', 'work.html?c=events', bookHref()];
    const offsets = [48, 56, 74, 70, 48, 48];
    const nav = doc.home.nav.map((label, i) =>
      `<a class="home-nav-item" href="${esc(navHref[i] || 'index.html')}" style="margin-left:${offsets[i] || 48}px">${ART.sparkle(54)}${t('home.nav.' + i, 'span', 'home-nav-label')}</a>`
    ).join('');

    return `${ART.homeBackground(W, SIZES.home)}
      ${badge('badge-home')}
      ${t('home.title', 'h1', 'home-title')}
      ${soundButton('sound-home')}
      <nav class="home-nav">${nav}</nav>
      <a class="home-dvd-link" href="work.html">${dvd('home.featured', 'home.coverTitle', 'home.coverStrip', 'home.spine', '#8ac43f', 'dvd-home')}</a>
      <div class="frame" style="--swirls:${ART.frameSwirls()}">
        <div class="frame-photo">${pic('home.portrait', 'your photo')}</div>
        ${t('home.available', 'div', 'frame-caption')}
        <span class="frame-disc">${t('badge.name')}${t('words.disc', 'small')}</span>
      </div>
      <a class="phone" href="${esc(bookHref())}">
        <span class="phone-body"><span class="phone-screen">${t('home.phone', 'span', 'phone-text')}${ART.smallStar(60, '#d35bd1')}</span></span>
        <span class="phone-hinge"></span>
      </a>
      <a class="flower-link" href="${esc(bookHref())}">${t('home.flower', 'span', '', true)}</a>
      ${shelf('shelf-home')}
      ${rating()}
      ${ownerLink()}`;
  }

  /* ---------------- the inside pages (about and work) ---------------- */
  function insideChrome(crumbs, banner) {
    return `${ART.insideBackground(W, SIZES[PAGE])}
      <div class="topbar">
        <a href="index.html" class="site-name">${t('siteName')}</a>
        <span class="crumbs">${crumbs}</span>
        <a href="${esc(bookHref())}" class="topbar-right">✉ ${t('bookMe')}</a>
      </div>
      <div class="band">
        <div class="band-left">
          <span class="band-logo">${t('words.my', 'i')}${t('words.workPlay', 'b', '', true)}</span>
          <a href="index.html" class="band-home">${t('words.homeButton')}</a>
        </div>
        <div class="band-mid">${banner}</div>
        <div class="band-right">
          <a href="work.html?c=dj" class="finder">${t('words.finder', 'span', '', true)}</a>
          ${soundButton('sound-tab')}
        </div>
      </div>
      ${badge('badge-inside')}
      <a href="index.html" class="home-tab">${t('words.homeTab')}</a>`;
  }

  function box(tabPaths, textPaths) {
    return `<div class="box">
      <div class="tabs">${tabPaths.map((p, i) => `<a href="#" class="tab${i === tab ? ' on' : ''}" data-tab="${i}">${t(p, 'span')}</a>`).join('')}</div>
      <div class="box-text" id="box-text">${t(textPaths[tab], 'div', 'box-copy', true)}</div>
      <div class="box-foot">${t('words.scroll')}<button type="button" data-scroll="1" aria-label="scroll down">▼</button><button type="button" data-scroll="-1" aria-label="scroll up">▲</button></div>
      <svg class="box-tail" viewBox="0 0 120 90" aria-hidden="true"><path d="M0 0 L120 82 L58 0Z" fill="#fff" stroke="#f17fbd" stroke-width="5" stroke-linejoin="round"/><rect x="-4" y="-8" width="66" height="10" fill="#fff"/></svg>
      <div class="box-stars">${ART.smallStar(46, '#f27cc0')}${ART.smallStar(34, '#e05aa8')}${ART.smallStar(52, '#f6a3d0')}</div>
    </div>`;
  }

  function sideNav(entries) {
    return `<nav class="side-nav">` + entries.map(e =>
      `<a class="side-item${e.on ? ' on' : ''}" href="${esc(e.href)}"${e.data || ''}>
        <span class="side-words">${e.big}${e.small ? `<br>${e.small}` : ''}</span>${ART.gem(30)}
      </a>`).join('') +
      `<a class="star-btn" href="${esc(bookHref())}"><svg viewBox="0 0 260 130" aria-hidden="true"><polygon points="130,4 160,40 250,22 196,66 254,110 160,94 130,128 100,94 6,110 64,66 10,22 100,40" fill="#fff" stroke="#f6b3d6" stroke-width="3"/></svg>${t('bookMe', 'span', 'star-label')}</a>
    </nav>`;
  }

  function aboutPage() {
    const go = g => (g === 'work' ? 'work.html' : g.startsWith('work:') ? 'work.html?c=' + encodeURIComponent(g.slice(5)) : '#');
    const entries = doc.about.nav.map((n, i) => ({
      big: t(`about.nav.${i}.big`, 'span', 'side-big'),
      small: n.small || editing ? t(`about.nav.${i}.small`, 'span', 'side-small') : '',
      href: go(n.go),
      data: n.go.startsWith('tab:') ? ` data-tab="${n.go.slice(4)}"` : '',
      on: n.go === 'tab:' + tab
    }));
    return `${insideChrome(`&gt; <a href="index.html">Home</a> &gt; <a href="about.html">About Me</a>`, t('about.banner', 'span', 'marquee'))}
      <div class="flag">${t('about.tag', 'span')}</div>
      ${dvd('about.cover', 'about.coverTitle', 'about.coverStrip', null, '#ef8a24', 'dvd-inside')}
      ${box(['about.tabs.0', 'about.tabs.1'], ['about.story', 'about.bonus'])}
      ${sideNav(entries)}
      ${shelf('shelf-inside')}
      ${rating()}
      ${ownerLink()}`;
  }

  function workPage() {
    const c = category(catId);
    const ci = doc.categories.indexOf(c);
    const ii = c.items.findIndex(x => x.id === itemId);
    const base = 'categories.' + ci;
    const itemBase = ii >= 0 ? base + '.items.' + ii : null;

    const entries = [{
      big: t('words.allAbout', 'span', 'side-big'),
      small: t(base + '.title', 'span', 'side-small'),
      href: `work.html?c=${encodeURIComponent(c.id)}`,
      data: ' data-item=""',
      on: ii < 0
    }].concat(c.items.map((it, j) => ({
      big: t(`${base}.items.${j}.title`, 'span', 'side-big'),
      small: it.sub || editing ? t(`${base}.items.${j}.sub`, 'span', 'side-small') : '',
      href: `work.html?c=${encodeURIComponent(c.id)}&p=${encodeURIComponent(it.id)}`,
      data: ` data-item="${esc(it.id)}"`,
      on: j === ii
    })));
    if (!c.items.length) entries.push({ big: t('words.comingSoon', 'span', 'side-big'), small: t('words.newWork', 'span', 'side-small'), href: '#', data: ' data-nolink' });

    const cover = itemBase
      ? dvd(itemBase + '.image', itemBase + '.title', itemBase + '.strip', null, c.color, 'dvd-inside')
      : dvd(base + '.cover', base + '.title', base + '.caption', null, c.color, 'dvd-inside');
    const story = itemBase ? [itemBase + '.story', itemBase + '.details'] : [base + '.story', base + '.details'];
    const crumb = `&gt; <a href="index.html">Home</a> &gt; <a href="work.html">Portfolio</a> &gt; <a href="work.html?c=${encodeURIComponent(c.id)}">${esc(c.title)}</a>`;

    return `${insideChrome(crumb, t(base + '.title', 'span', 'marquee'))}
      <div class="flag">${t(base + '.title', 'span')}</div>
      ${cover}
      ${box(['workTabs.0', 'workTabs.1'], story)}
      ${sideNav(entries)}
      ${shelf('shelf-inside')}
      ${rating()}
      ${ownerLink()}`;
  }

  function ownerLink() {
    if (!online || signedIn) return '';
    return `<a class="owner-link" href="/sign-in?next=${encodeURIComponent('/portfolio/' + location.pathname.split('/').pop() + location.search)}">♥</a>`;
  }

  /* ---------------- drawing and wiring ---------------- */
  const stage = document.getElementById('stage');
  const viewport = document.getElementById('viewport');

  function render() {
    const keepScroll = document.getElementById('box-text')?.scrollTop || 0;
    stage.innerHTML = PAGE === 'home' ? homePage() : PAGE === 'about' ? aboutPage() : workPage();
    stage.classList.toggle('editing', editing);
    const bt = document.getElementById('box-text');
    if (bt) bt.scrollTop = keepScroll;
    if (editing) {
      stage.querySelectorAll('[data-bind]').forEach(el => {
        el.setAttribute('contenteditable', 'plaintext-only');
        el.spellcheck = true;
      });
    }
    fit();
    renderBar();
  }

  /* The stage is a fixed 2006-sized page; on a phone it is scaled to fit. */
  function fit() {
    const h = SIZES[PAGE];
    const s = Math.min(1, window.innerWidth / W);
    stage.style.width = W + 'px';
    stage.style.height = h + 'px';
    stage.style.transform = `scale(${s})`;
    viewport.style.width = W * s + 'px';
    viewport.style.height = h * s + 'px';
  }
  window.addEventListener('resize', fit);

  stage.addEventListener('click', e => {
    const tabBtn = e.target.closest('[data-tab]');
    const scrollBtn = e.target.closest('[data-scroll]');
    const item = e.target.closest('[data-item]');
    const img = e.target.closest('[data-img]');
    const soundBtn = e.target.closest('[data-sound]');
    const link = e.target.closest('a');

    if (editing && img) { e.preventDefault(); pickPicture(img.dataset.img); return; }
    /* While editing, the first click on a tab or project opens it, and a
       click on words that are already showing is for typing, not leaving. */
    const opens = (tabBtn && !tabBtn.classList.contains('on')) || (item && !item.classList.contains('on'));
    if (editing && !opens && e.target.closest('[data-bind]')) { if (link) e.preventDefault(); return; }

    if (soundBtn) { sound = !sound; try { localStorage.setItem('pf-sound', sound ? '1' : '0'); } catch { /* private mode */ } chime(); render(); return; }
    if (tabBtn) {
      e.preventDefault();
      tab = +tabBtn.dataset.tab;
      chime();
      render();
      document.getElementById('box-text').scrollTop = 0;
      return;
    }
    if (scrollBtn) { document.getElementById('box-text').scrollBy({ top: 70 * +scrollBtn.dataset.scroll, behavior: 'smooth' }); return; }
    if (item) {
      e.preventDefault();
      itemId = item.dataset.item || null;
      tab = 0;
      history.replaceState(null, '', item.getAttribute('href'));
      chime();
      render();
      return;
    }
    if (link && link.hasAttribute('data-nolink')) e.preventDefault();
  });

  /* Saving typed text: on leaving the field. Single-line fields refuse Enter. */
  stage.addEventListener('keydown', e => {
    const el = e.target.closest('[data-bind]');
    if (el && e.key === 'Enter' && !el.hasAttribute('data-multi')) { e.preventDefault(); el.blur(); }
  });
  stage.addEventListener('focusout', e => {
    const el = e.target.closest && e.target.closest('[data-bind]');
    if (!el || !editing) return;
    const value = el.innerText.replace(/\n+$/, '');
    if (value === get(el.dataset.bind)) return;
    set(el.dataset.bind, value);
    save();
    /* the same words can appear twice (a title on the cover and the spine) */
    setTimeout(() => { if (!stage.contains(document.activeElement) || !document.activeElement.closest('[data-bind]')) render(); }, 0);
  });

  /* ---------------- sound: a little twinkle, off until you turn it on ---------------- */
  let sound = false;
  try { sound = localStorage.getItem('pf-sound') === '1'; } catch { /* private mode */ }
  let audio = null;
  function chime() {
    if (!sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [1568, 2093, 2637].forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        const t0 = audio.currentTime + i * 0.06;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
        o.connect(g).connect(audio.destination);
        o.start(t0);
        o.stop(t0 + 0.4);
      });
    } catch { /* no audio, no problem */ }
  }
  stage.addEventListener('mouseover', e => {
    const a = e.target.closest('.home-nav-item,.side-item');
    if (a && !a.contains(e.relatedTarget)) chime();
  });

  /* ---------------- the owner's edit bar ---------------- */
  let bar = null;
  let status = '';

  function renderBar() {
    if (!isOwner) { if (bar) bar.remove(); bar = null; return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'pf-bar'; document.body.appendChild(bar); }
    const onWork = PAGE === 'work';
    bar.innerHTML = `
      <button type="button" data-act="edit" class="${editing ? 'on' : ''}">${editing ? '✓ done editing' : '✎ edit this page'}</button>
      ${editing ? `
        <button type="button" data-act="email">booking email</button>
        ${onWork ? `<button type="button" data-act="add-item">+ add a project</button>
          ${itemId ? `<button type="button" data-act="del-item">delete this project</button>` : ''}
          <button type="button" data-act="add-cat">+ add a category</button>
          <button type="button" data-act="cat-style">case: ${category(catId).kind === 'cd' ? 'CD' : 'DVD'}</button>
          <button type="button" data-act="del-cat">delete category</button>` : ''}
        <span class="pf-hint">click any words to type · click any picture to change it</span>` : ''}
      <span class="pf-status">${esc(status)}</span>`;
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('#pf-bar [data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const c = category(catId);

    if (act === 'edit') { editing = !editing; render(); return; }
    if (act === 'email') {
      const v = prompt('The email address that every "Book Me" button sends to:', doc.contact.email || '');
      if (v !== null) { doc.contact.email = v.trim(); save(); render(); }
      return;
    }
    if (act === 'add-item') {
      const id = 'p' + Date.now().toString(36);
      c.items.push({ id, title: 'New Project', sub: '', image: '', strip: c.title.toUpperCase(), story: 'What was it, who was it for, what did you do?', details: 'Date, place, client, tools, credits.' });
      catId = c.id; itemId = id; tab = 0;
      history.replaceState(null, '', `work.html?c=${encodeURIComponent(c.id)}&p=${id}`);
      save(); render(); return;
    }
    if (act === 'del-item') {
      const it = c.items.find(x => x.id === itemId);
      if (!it || !confirm(`Delete "${it.title}"? This cannot be undone.`)) return;
      c.items = c.items.filter(x => x.id !== itemId);
      itemId = null;
      history.replaceState(null, '', `work.html?c=${encodeURIComponent(c.id)}`);
      save(); render(); return;
    }
    if (act === 'add-cat') {
      const name = prompt('What is the new category called? (for example: Photography)');
      if (!name || !name.trim()) return;
      const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-3);
      doc.categories.push(cat(id, name.trim(), 'dvd', '#b0418d'));
      catId = id; itemId = null; tab = 0;
      history.replaceState(null, '', `work.html?c=${encodeURIComponent(id)}`);
      save(); render(); return;
    }
    if (act === 'cat-style') { c.kind = c.kind === 'cd' ? 'dvd' : 'cd'; save(); render(); return; }
    if (act === 'del-cat') {
      if (doc.categories.length < 2) { alert('Keep at least one category.'); return; }
      if (!confirm(`Delete the whole "${c.title}" category and its ${c.items.length} project(s)? This cannot be undone.`)) return;
      doc.categories = doc.categories.filter(x => x !== c);
      catId = doc.categories[0].id; itemId = null;
      history.replaceState(null, '', 'work.html');
      save(); render();
    }
  });

  /* ---------------- pictures ---------------- */
  function pickPicture(path) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      setStatus('uploading…');
      try {
        const small = await shrink(file);
        const fd = new FormData();
        fd.append('file', small, small.name);
        const r = await fetch('/portfolio/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
        const out = await r.json().catch(() => ({}));
        if (!r.ok || !out.url) throw new Error(out.error || 'upload failed (' + r.status + ')');
        set(path, out.url);
        /* a category's first picture also becomes its little case on the shelf */
        await save();
        render();
      } catch (err) {
        setStatus('');
        alert('That picture did not upload. ' + err.message);
      }
    };
    input.click();
  }

  /* Phone photos are huge. Bring them to 1800px before sending. GIFs are left
     alone so they keep moving. */
  function shrink(file) {
    const MAX = 1800;
    if (file.type === 'image/gif' || file.size < 700 * 1024) return Promise.resolve(file);
    return new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, MAX / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * s);
        cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(b => resolve(b ? new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', 0.86);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  /* ---------------- saving ---------------- */
  function setStatus(s) { status = s; const el = bar && bar.querySelector('.pf-status'); if (el) el.textContent = s; }

  async function save() {
    if (!isOwner) return;
    setStatus('saving…');
    try {
      const r = await fetch('/portfolio/data', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ doc })
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out.error || 'failed (' + r.status + ')');
      setStatus('saved ✓');
    } catch (err) {
      setStatus('not saved');
      alert('That change did not save. ' + err.message);
    }
  }

  /* ---------------- start ---------------- */
  async function start() {
    render();
    if (!online) return;
    try {
      const [sess, data] = await Promise.all([
        fetch('/portfolio/session', { credentials: 'same-origin' }).then(r => r.json()),
        fetch('/portfolio/data', { credentials: 'same-origin' }).then(r => r.json())
      ]);
      signedIn = !!sess.signedIn;
      isOwner = !!sess.isOwner;
      if (data && data.doc) doc = withDefaults(data.doc, DEFAULTS);
    } catch {
      /* the routes are not reachable: show the starting content */
    }
    render();
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  start();
})();
