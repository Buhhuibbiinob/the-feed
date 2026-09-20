/* LastThread. Edit mode.
   Lets you change anything on the site without opening a code editor:
   every piece of text, every image, and new posts of your own.

   How it stores things. Edits are saved in this browser under localStorage,
   keyed by page and by the element's position in the document. Nothing is
   uploaded, because there is no server. Two consequences worth knowing:

     1. Edits show on your machine only, until you export them. Use
        "save page as HTML" to get a real file you can put in the repo, which
        is what makes a change permanent and visible to everybody.
     2. If the HTML of a page is rewritten later, an edit pinned to a spot
        that no longer exists is dropped. Export before big changes. */

(function () {
  const PAGE = (location.pathname.split('/').pop() || 'index.html');
  const TEXT_KEY = 'lt-text-' + PAGE;
  const IMG_KEY  = 'lt-img-'  + PAGE;
  const POST_KEY = 'lt-posts';

  const read  = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; }
                            catch { alert('This browser will not save any more. Export your edits, then reset.'); return false; } };

  const THEME_KEY = 'lt-theme';

  let texts = read(TEXT_KEY, {});
  let imgs  = read(IMG_KEY, {});
  let editing = false;

  /* The colours the whole site is built from. Each one maps to a custom
     property in style.css, so changing it here changes every page at once. */
  const THEME_FIELDS = [
    { var: '--navy',       label: 'links, headings, wordmark', fallback: '#2a2a8c' },
    { var: '--ink',        label: 'body text',                 fallback: '#111111' },
    { var: '--grey-rail',  label: 'channel bar and column',    fallback: '#e9e9e9' },
    { var: '--grey-band',  label: 'the rooms band',            fallback: '#9d9d9d' },
    { var: '--grey-panel', label: 'side panel',                fallback: '#e2e2e2' },
    { var: '--page-bg',    label: 'page background',           fallback: '#ffffff' }
  ];

  function applyTheme() {
    const t = read(THEME_KEY, {});
    Object.keys(t).forEach(v => document.documentElement.style.setProperty(v, t[v]));
    if (t['--page-bg']) document.body.style.background = t['--page-bg'];
  }

  /* A stable address for an element: its ancestry by tag and position.
     Independent of class names, so restyling does not break saved edits. */
  function addressOf(el) {
    const parts = [];
    while (el && el.nodeType === 1 && el.tagName !== 'BODY') {
      const parent = el.parentNode;
      const same = Array.from(parent.children).filter(c => c.tagName === el.tagName);
      parts.unshift(el.tagName.toLowerCase() + (same.length > 1 ? '[' + same.indexOf(el) + ']' : ''));
      el = parent;
    }
    return parts.join('/');
  }

  /* what counts as editable text */
  const TEXT_SEL = 'h1,h2,h3,h4,p,li,td.desc,span.label,figcaption,.caption,.note,.lede,.credit,.cap,.shop-city,blockquote';
  /* what counts as a picture, including the grey placeholders */
  const IMG_SEL  = '.plate,.shot,.cover,.swatchbox,.thumbstrip .swatch,figure.fit img,img.editable';

  function editableTexts() {
    return Array.from(document.querySelectorAll(TEXT_SEL))
      .filter(el => !el.closest('#lt-bar') && !el.closest('#lt-panel') && !el.closest('.chips') && !el.closest('.board'));
  }
  function editableImages() {
    return Array.from(document.querySelectorAll(IMG_SEL))
      .filter(el => !el.closest('#lt-bar') && !el.closest('#lt-panel'));
  }

  /* ---------- apply saved edits on every page load ---------- */
  function applyEdits() {
    editableTexts().forEach(el => {
      const v = texts[addressOf(el)];
      if (typeof v === 'string') el.innerHTML = v;
    });
    editableImages().forEach(el => {
      const v = imgs[addressOf(el)];
      if (v) setPicture(el, v);
    });
  }

  function setPicture(el, dataUrl) {
    el.classList.remove('lt-ph');
    if (el.tagName === 'IMG') { el.src = dataUrl; return; }
    el.innerHTML = '';
    el.style.background = 'none';
    el.style.padding = '0';
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = '';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.display = 'block';
    el.appendChild(img);
  }

  /* downscale before saving. Browser storage is a few megabytes in total. */
  function readImage(file, cb, max) {
    max = max || 900;
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const scale = Math.min(1, max / Math.max(im.width, im.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(im.width * scale);
        cv.height = Math.round(im.height * scale);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL('image/jpeg', 0.82));
      };
      im.onerror = () => cb(r.result);
      im.src = r.result;
    };
    r.readAsDataURL(file);
  }

  /* ---------- the formatting toolbar ----------
     Colour, size, weight and alignment for whatever text you have selected.
     It uses the browser's own rich-text commands, then saves the block it
     touched, because those commands do not fire a blur event. */

  const SWATCHES = ['#111111','#2a2a8c','#8d1f2d','#2f3b2f','#7a5c2e','#666666','#9d9d9d','#ffffff'];

  let toolbarEl = null;
  function buildToolbar() {
    if (toolbarEl) return toolbarEl;
    toolbarEl = document.createElement('div');
    toolbarEl.id = 'lt-tools';
    toolbarEl.innerHTML =
      '<span class="lt-tgroup"><b>text</b>' +
        SWATCHES.map(c => '<button class="lt-sw" data-cmd="foreColor" data-val="' + c + '" style="background:' + c + '" title="' + c + '"></button>').join('') +
        '<input type="color" class="lt-pick" data-cmd="foreColor" value="#2a2a8c" title="any colour">' +
      '</span>' +
      '<span class="lt-tgroup"><b>highlight</b>' +
        '<button class="lt-sw" data-cmd="hiliteColor" data-val="#fff3a3" style="background:#fff3a3"></button>' +
        '<button class="lt-sw" data-cmd="hiliteColor" data-val="#e2e2e2" style="background:#e2e2e2"></button>' +
        '<button class="lt-sw" data-cmd="hiliteColor" data-val="transparent" style="background:#fff" title="none"></button>' +
      '</span>' +
      '<span class="lt-tgroup">' +
        '<button class="lt-t" data-cmd="bold"><b>B</b></button>' +
        '<button class="lt-t" data-cmd="italic"><i>I</i></button>' +
        '<button class="lt-t" data-cmd="underline"><u>U</u></button>' +
      '</span>' +
      '<span class="lt-tgroup"><b>size</b>' +
        '<select class="lt-sel" data-cmd="fontSize">' +
          '<option value="">size</option><option value="1">tiny</option><option value="2">small</option>' +
          '<option value="3">normal</option><option value="4">large</option><option value="5">bigger</option>' +
          '<option value="6">huge</option><option value="7">headline</option>' +
        '</select>' +
      '</span>' +
      '<span class="lt-tgroup"><b>font</b>' +
        '<select class="lt-sel" data-cmd="fontName">' +
          '<option value="">font</option>' +
          '<option value="Arial, Helvetica, sans-serif">Arial</option>' +
          '<option value="&quot;Times New Roman&quot;, Times, serif">Times</option>' +
          '<option value="&quot;Courier New&quot;, Courier, monospace">Courier</option>' +
          '<option value="Georgia, serif">Georgia</option>' +
          '<option value="&quot;Helvetica Neue&quot;, Helvetica, sans-serif">Helvetica</option>' +
        '</select>' +
      '</span>' +
      '<span class="lt-tgroup">' +
        '<button class="lt-t" data-cmd="justifyLeft">left</button>' +
        '<button class="lt-t" data-cmd="justifyCenter">centre</button>' +
        '<button class="lt-t" data-cmd="justifyRight">right</button>' +
      '</span>' +
      '<span class="lt-tgroup">' +
        '<button class="lt-t" data-cmd="createLink">link</button>' +
        '<button class="lt-t" data-cmd="removeFormat">clear</button>' +
      '</span>' +
      '<span class="lt-tgroup"><button class="lt-t" id="lt-colours">site colours</button></span>';
    document.body.appendChild(toolbarEl);

    /* mousedown, not click: keep the selection in the page while the button
       is pressed, otherwise the browser drops it and the command does nothing */
    toolbarEl.addEventListener('mousedown', e => {
      const b = e.target.closest('[data-cmd]');
      if (!b || b.tagName === 'SELECT' || b.type === 'color') return;
      e.preventDefault();
      run(b.dataset.cmd, b.dataset.val);
    });
    toolbarEl.querySelectorAll('select[data-cmd]').forEach(sel => {
      sel.addEventListener('change', () => { run(sel.dataset.cmd, sel.value); sel.selectedIndex = 0; });
    });
    toolbarEl.querySelectorAll('input[type="color"]').forEach(inp => {
      inp.addEventListener('input', () => run(inp.dataset.cmd, inp.value));
    });
    toolbarEl.querySelector('#lt-colours').addEventListener('mousedown', e => {
      e.preventDefault(); themePanel();
    });
    return toolbarEl;
  }

  function run(cmd, val) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) { note('select some text first'); return; }
    const host = hostOf(sel.anchorNode);
    if (!host) { note('select text inside the page, not the bar'); return; }
    if (cmd === 'createLink') {
      const url = prompt('Link to where?', 'https://');
      if (!url) return;
      document.execCommand('createLink', false, url);
    } else {
      document.execCommand('styleWithCSS', false, true);
      document.execCommand(cmd, false, val);
    }
    const addr = addressOf(host);
    texts[addr] = host.innerHTML;
    write(TEXT_KEY, texts);
    shareEdit(addr, 'text', host.innerHTML);
  }

  /* the editable block a selection sits inside */
  function hostOf(node) {
    let el = node && node.nodeType === 3 ? node.parentNode : node;
    while (el && el !== document.body) {
      if (el.getAttribute && el.getAttribute('contenteditable') === 'true') return el;
      el = el.parentNode;
    }
    return null;
  }

  /* ---------- site colours ---------- */
  function themePanel() {
    const t = read(THEME_KEY, {});
    const p = panel();
    p.innerHTML = '<h4>Site colours</h4>' +
      '<p class="lt-note" style="margin:0 0 10px;">These apply to every page. They are saved in this browser, and are included when you save a page as HTML.</p>' +
      THEME_FIELDS.map(f =>
        '<div class="lt-field lt-colourrow">' +
          '<label>' + f.label + '</label>' +
          '<input type="color" data-var="' + f.var + '" value="' + (t[f.var] || f.fallback) + '">' +
          '<code>' + f.var + '</code>' +
        '</div>').join('') +
      '<button id="lt-theme-reset" class="lt-btn lt-quiet">back to the original colours</button> ' +
      '<button id="lt-theme-close" class="lt-btn">done</button>';
    p.style.display = 'block';

    p.querySelectorAll('input[type="color"][data-var]').forEach(inp => {
      inp.addEventListener('input', () => {
        const theme = read(THEME_KEY, {});
        theme[inp.dataset.var] = inp.value;
        write(THEME_KEY, theme);
        applyTheme();
      });
    });
    p.querySelector('#lt-theme-reset').onclick = () => {
      localStorage.removeItem(THEME_KEY);
      THEME_FIELDS.forEach(f => document.documentElement.style.removeProperty(f.var));
      document.body.style.background = '';
      themePanel();
      note('colours back to the original');
    };
    p.querySelector('#lt-theme-close').onclick = () => { p.style.display = 'none'; };
  }

  /* ---------- edit mode on and off ---------- */
  function startEditing() {
    editing = true;
    document.body.classList.add('lt-editing');

    editableTexts().forEach(el => {
      el.setAttribute('contenteditable', 'true');
      el.addEventListener('blur', onTextBlur);
    });

    editableImages().forEach(el => {
      el.classList.add('lt-img-edit');
      el.addEventListener('click', onImageClick);
    });

    buildToolbar().style.display = 'flex';
    bar().querySelector('#lt-toggle').textContent = 'stop editing';
    note(editableTexts().length + ' text blocks and ' + editableImages().length + ' pictures are editable here. Type in any of them. Select text to colour or resize it. Click a picture to replace it.');
  }

  function stopEditing() {
    editing = false;
    document.body.classList.remove('lt-editing');
    editableTexts().forEach(el => {
      el.removeAttribute('contenteditable');
      el.removeEventListener('blur', onTextBlur);
    });
    editableImages().forEach(el => {
      el.classList.remove('lt-img-edit');
      el.removeEventListener('click', onImageClick);
    });
    if (toolbarEl) toolbarEl.style.display = 'none';
    bar().querySelector('#lt-toggle').textContent = 'edit this page';
    note('Edits saved in this browser. Use "save page as HTML" to make them permanent.');
  }

  function onTextBlur(e) {
    const el = e.currentTarget;
    const addr = addressOf(el);
    texts[addr] = el.innerHTML;
    write(TEXT_KEY, texts);
    shareEdit(addr, 'text', el.innerHTML);
  }

  /* An owner's edit goes to the database as well as this browser, so it is
     the site that changed rather than one screen. */
  function shareEdit(address, kind, value) {
    const s = window.LT && window.LT.state();
    if (!s || !s.isOwner) { note('saved in this browser'); return; }
    note('saving to the site...');
    window.LT.saveEdit(PAGE, address, kind, value).then(r => {
      note(r.error ? 'saved here, but the site refused it: ' + r.error : 'saved to the site, for everybody');
    });
  }

  function onImageClick(e) {
    e.preventDefault();
    const el = e.currentTarget;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const f = input.files[0];
      if (!f) return;
      readImage(f, data => {
        const addr = addressOf(el);
        imgs[addr] = data;
        if (write(IMG_KEY, imgs)) { setPicture(el, data); shareEdit(addr, 'image', data); }
      });
    };
    input.click();
  }

  /* ---------- posts: articles, blogs, anything you write ---------- */
  let remotePosts = [];
  function posts() { return remotePosts.concat(read(POST_KEY, [])); }
  function localPosts() { return read(POST_KEY, []); }
  function savePosts(list) { return write(POST_KEY, list); }

  function postForm() {
    const p = panel();
    p.innerHTML = `
      <h4>Write a post</h4>
      <div class="lt-field"><label>headline</label><input id="lt-title" type="text"></div>
      <div class="lt-row">
        <div class="lt-field"><label>era</label><input id="lt-era" type="text" placeholder="1947"></div>
        <div class="lt-field"><label>place</label><input id="lt-place" type="text" placeholder="Paris"></div>
        <div class="lt-field"><label>channel</label><input id="lt-channel" type="text" placeholder="silhouette"></div>
      </div>
      <div class="lt-field"><label>by</label><input id="lt-author" type="text" placeholder="your name"></div>
      <div class="lt-field"><label>the post</label><textarea id="lt-body" rows="10"></textarea></div>
      <div class="lt-field"><label>sources, one per line</label><textarea id="lt-sources" rows="3"></textarea></div>
      <div class="lt-field"><label>picture</label><input id="lt-image" type="file" accept="image/*"></div>
      <div id="lt-imgpreview"></div>
      <button id="lt-publish" class="lt-btn">publish to the feed</button>
      <button id="lt-close" class="lt-btn lt-quiet">close</button>
      <p class="lt-note">The post appears at the top of the feed and gets its own page. It is
      saved in this browser. Export it, or save the feed as HTML, to keep it.</p>`;
    p.style.display = 'block';

    let picture = '';
    p.querySelector('#lt-image').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      readImage(f, d => {
        picture = d;
        p.querySelector('#lt-imgpreview').innerHTML = '<img src="' + d + '" style="max-width:200px;border:1px solid #ccc;margin:6px 0;">';
      });
    };
    p.querySelector('#lt-close').onclick = () => { p.style.display = 'none'; };
    p.querySelector('#lt-publish').onclick = () => {
      const v = id => (p.querySelector('#lt-' + id).value || '').trim();
      if (!v('title')) { alert('Give it a headline.'); return; }
      const post = {
        id: 'p' + Date.now(),
        title: v('title'), era: v('era'), place: v('place'), channel: v('channel'),
        author: v('author') || 'you', body: v('body'), sources: v('sources'),
        picture: picture, date: new Date().toISOString().slice(0, 10)
      };

      const st = window.LT && window.LT.state();
      if (st && st.configured && !st.isOwner) {
        alert('Publishing to LastThread is the editor\'s.');
        return;
      }
      const signedIn = st && st.user;
      if (signedIn) {
        window.LT.createPost(post).then(r => {
          if (r.error) { alert('Could not publish it: ' + r.error + '\nIt has been kept in this browser instead.'); keepLocally(); return; }
          post.id = r.id; post.remote = true;
          remotePosts.unshift(post);
          finish('Published to the site. Everybody can read it.');
        });
      } else {
        keepLocally();
      }

      function keepLocally() {
        const list = localPosts();
        list.unshift(post);
        if (savePosts(list)) finish('Saved in this browser. Sign in to publish it to the site.');
      }

      function finish(msg) {
        p.style.display = 'none';
        note(msg);
        if (PAGE === 'index.html' || PAGE === '') { renderPosts(); window.scrollTo(0, 0); }
        else if (confirm(msg + ' Go and look at the feed?')) location.href = 'index.html';
      }
    };
  }

  /* put saved posts at the top of the feed */
  function renderPosts() {
    const main = document.querySelector('main.main');
    if (!main) return;
    document.querySelectorAll('.lt-post').forEach(n => n.remove());
    const anchor = main.querySelector('.section-head');
    if (!anchor) return;
    posts().slice().reverse().forEach(post => {
      const art = document.createElement('article');
      art.className = 'entry lt-post';
      art.innerHTML = `
        <div class="meta"><span class="era">${esc(post.era || 'undated')}</span> · ${esc(post.channel || 'unfiled')} · ${esc(post.place || '')}</div>
        <h3><a href="post.html?id=${post.id}">${esc(post.title)}</a></h3>
        <p class="byline">filed by ${esc(post.author)} · ${esc(post.date)}</p>
        ${post.picture ? '<div class="plate" style="padding:0;border:1px solid #ccc;"><img src="' + post.picture + '" style="width:100%;height:100%;object-fit:cover;"></div>' : ''}
        <p>${esc(post.body).slice(0, 420).replace(/\n/g, '<br>')}${post.body.length > 420 ? '…' : ''}</p>
        <div class="reactions"><a href="post.html?id=${post.id}">read the whole entry</a>
          <a href="#" class="lt-del" data-id="${post.id}">delete</a></div>`;
      anchor.after(art);
    });
    document.querySelectorAll('.lt-del').forEach(a => a.onclick = e => {
      e.preventDefault();
      if (!confirm('Delete this post?')) return;
      const id = a.dataset.id;
      const remote = remotePosts.find(p => p.id === id);
      if (remote && window.LT) {
        window.LT.deletePost(id).then(r => {
          if (r.error) { alert('Could not delete it: ' + r.error); return; }
          remotePosts = remotePosts.filter(p => p.id !== id);
          renderPosts();
        });
        return;
      }
      savePosts(localPosts().filter(p => p.id !== id));
      renderPosts();
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* one post on its own page */
  function renderSinglePost() {
    const holder = document.getElementById('lt-single');
    if (!holder) return;
    const id = new URLSearchParams(location.search).get('id');
    const post = posts().find(p => p.id === id);
    if (!post) {
      holder.dataset.missing = '1';
      holder.innerHTML = '<p class="lede">Looking for that post...</p>';
      setTimeout(() => {
        if (holder.dataset.missing) {
          holder.innerHTML = '<p class="lede">No post with that address. It may have been deleted, or written in a different browser. <a href="index.html">Back to the feed</a>.</p>';
        }
      }, 2500);
      return;
    }
    paintSingle(holder, post);
  }

  function paintSingle(holder, post) {
    document.title = post.title + ': LastThread';
    holder.innerHTML = `
      <div class="section-head" style="margin-top:18px;">
        <h2>${esc(post.era || '')} ${post.channel ? '· ' + esc(post.channel) : ''} ${post.place ? '· ' + esc(post.place) : ''}</h2>
        <span class="note">filed by ${esc(post.author)} · ${esc(post.date)}</span>
      </div>
      <h3 style="font-size:22px;margin:0 0 12px;">${esc(post.title)}</h3>
      ${post.picture ? '<img src="' + post.picture + '" style="max-width:520px;border:1px solid #ddd;display:block;margin:0 0 14px;">' : ''}
      <div class="lede" style="white-space:pre-wrap;">${esc(post.body)}</div>
      ${post.sources ? '<div class="block"><h4>sources</h4><div class="caption" style="white-space:pre-wrap;">' + esc(post.sources) + '</div></div>' : ''}
      <p class="caption" style="margin-bottom:26px;"><a href="index.html">Back to the feed</a></p>`;
  }

  /* ---------- export, import, save as HTML, reset ---------- */
  function exportAll() {
    const bundle = { site: 'LastThread', exported: new Date().toISOString(),
                     pages: {}, posts: posts(), theme: read(THEME_KEY, {}) };
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('lt-text-') || k.startsWith('lt-img-')) bundle.pages[k] = read(k, {});
    }
    download('lastthread-edits.json', JSON.stringify(bundle, null, 2), 'application/json');
    note('exported');
  }

  function importAll() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = () => {
      const f = input.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const b = JSON.parse(r.result);
          Object.keys(b.pages || {}).forEach(k => write(k, b.pages[k]));
          if (b.posts) savePosts(b.posts);
          if (b.theme) write(THEME_KEY, b.theme);
          alert('Imported. The page will reload.');
          location.reload();
        } catch { alert('That file is not a LastThread export.'); }
      };
      r.readAsText(f);
    };
    input.click();
  }

  /* the important one: a real HTML file with your edits baked in, ready to
     replace the file in the repo. This is how an edit becomes permanent. */
  function savePageHtml() {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('#lt-bar,#lt-panel,#lt-tools,script[src="editor.js"]').forEach(n => n.remove());
    const theme = read(THEME_KEY, {});
    if (Object.keys(theme).length) {
      const st = document.createElement('style');
      st.textContent = ':root{' + Object.keys(theme).map(v => v + ':' + theme[v] + ';').join('') + '}' +
                       (theme['--page-bg'] ? 'body{background:' + theme['--page-bg'] + ';}' : '');
      clone.querySelector('head').appendChild(st);
    }
    clone.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
    clone.querySelectorAll('.lt-img-edit').forEach(n => n.classList.remove('lt-img-edit'));
    clone.querySelectorAll('.lt-post').forEach(n => n.classList.remove('lt-post'));
    clone.querySelectorAll('.lt-del').forEach(n => n.remove());
    const html = '<!DOCTYPE html>\n' + clone.outerHTML;
    download(PAGE, html, 'text/html');
    note('saved ' + PAGE + ' to your downloads. Put that file in the repo to publish it.');
  }

  function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function resetPage() {
    if (!confirm('Undo every edit on this page? Posts are kept.')) return;
    localStorage.removeItem(TEXT_KEY);
    localStorage.removeItem(IMG_KEY);
    location.reload();
  }

  /* ---------- the bar ---------- */
  let barEl, panelEl;
  function bar() { return barEl; }
  function panel() { return panelEl; }
  function note(msg) { const n = barEl.querySelector('#lt-note'); n.textContent = msg; }

  function buildBar() {
    barEl = document.createElement('div');
    barEl.id = 'lt-bar';
    barEl.innerHTML = `
      <button id="lt-toggle" class="lt-btn">edit this page</button>
      <button id="lt-write" class="lt-btn">write a post</button>
      <button id="lt-html" class="lt-btn lt-quiet">save page as HTML</button>
      <button id="lt-export" class="lt-btn lt-quiet">export</button>
      <button id="lt-import" class="lt-btn lt-quiet">import</button>
      <button id="lt-reset" class="lt-btn lt-quiet">undo all</button>
      <button id="lt-account" class="lt-btn lt-quiet">sign in</button>
      <span id="lt-note"></span>`;
    document.body.appendChild(barEl);

    panelEl = document.createElement('div');
    panelEl.id = 'lt-panel';
    document.body.appendChild(panelEl);

    barEl.querySelector('#lt-toggle').onclick = () => editing ? stopEditing() : startEditing();
    barEl.querySelector('#lt-write').onclick  = postForm;
    barEl.querySelector('#lt-html').onclick   = savePageHtml;
    barEl.querySelector('#lt-export').onclick = exportAll;
    barEl.querySelector('#lt-import').onclick = importAll;
    barEl.querySelector('#lt-reset').onclick  = resetPage;

    /* Hidden rather than disabled: a row of greyed-out buttons invites people
       to wonder what they are missing. Until accounts answer, assume not. */
    function showOwnerTools(show) {
      ['#lt-toggle', '#lt-write', '#lt-html', '#lt-export', '#lt-import', '#lt-reset']
        .forEach(sel => { barEl.querySelector(sel).style.display = show ? '' : 'none'; });
      barEl.classList.toggle('lt-reader', !show);
    }
    showOwnerTools(false);
    barEl.querySelector('#lt-account').onclick = () => window.LT && window.LT.authPanel();

    /* The bar shows only what you are allowed to do. Writing and editing
       belong to the site owner; everybody else gets a sign in button and a
       site that behaves like any other site they are reading. */
    if (window.LT) window.LT.onChange(s => {
      const btn = barEl.querySelector('#lt-account');

      if (!s.configured) {
        // opened off disk: no site to publish to, so let them edit their copy
        btn.textContent = 'your own copy';
        showOwnerTools(true);
        document.body.classList.add('lt-can-edit');
        return;
      }

      btn.textContent = s.user ? 'signed in' : 'sign in';
      showOwnerTools(!!s.isOwner);
      document.body.classList.toggle('lt-can-edit', !!s.isOwner);

      if (s.isOwner) note('Signed in as the editor. Edits and posts save for everybody.');
      if (!s.isOwner && editing) stopEditing();
    });
  }

  /* Shared first, local second. A post that reached the database belongs to
     the site; a post that did not is still yours, so both are shown, with the
     shared ones on top. */
  async function loadRemote() {
    if (!window.LT || !window.LT.state().configured) return;
    try {
      const shared = await window.LT.listPosts();
      if (shared && shared.length) { remotePosts = shared; renderPosts(); }
      const edits = await window.LT.loadEdits(PAGE);
      if (edits) {
        Object.keys(edits.text).forEach(a => { if (!(a in texts)) texts[a] = edits.text[a]; });
        Object.keys(edits.image).forEach(a => { if (!(a in imgs)) imgs[a] = edits.image[a]; });
        applyEdits();
      }
      if (typeof renderSinglePost === 'function') await renderSingleRemote();
    } catch (e) { /* offline, or the database is not reachable. The local site still works. */ }
  }

  async function renderSingleRemote() {
    const holder = document.getElementById('lt-single');
    if (!holder || !holder.dataset.missing) return;
    const id = new URLSearchParams(location.search).get('id');
    const post = await window.LT.getPost(id);
    if (post) { delete holder.dataset.missing; paintSingle(holder, post); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildBar();
    applyTheme();
    applyEdits();
    renderPosts();
    renderSinglePost();
    loadRemote();
  });
})();
