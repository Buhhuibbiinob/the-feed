/* LastThread. One account, no setup.

   LastThread is part of mythefeed.com and shares its accounts. It does not
   talk to the database itself and holds no keys: it asks two same-origin
   routes, and the browser sends the feed's own session cookie along with the
   request. So signing in on the feed signs you in here, it is remembered
   between visits, and there is nothing to configure.

     /lastthread/session   who you are, and whether you can edit
     /lastthread/data      the posts and page edits, public to read,
                           admins only to write

   Editing is the same admin flag that guards Admin on the feed. Everybody
   else reads.

   Opened as a file off disk there are no routes, so it falls back to saving
   in that browser alone, which is what the edit bar has always done. */

window.LT = (function () {
  const online = location.protocol !== 'file:';
  let user = null;
  let isOwner = false;
  let doc = { edits: {}, posts: [] };
  const listeners = [];

  function state() { return { configured: online, user, isOwner, doc }; }
  function fire() { const s = state(); listeners.forEach(fn => fn(s)); }
  function onChange(fn) { listeners.push(fn); fn(state()); }

  async function init() {
    if (!online) { fire(); return; }
    try {
      const r = await fetch('/lastthread/session', { credentials: 'same-origin' });
      const s = await r.json();
      user = s.signedIn ? { email: s.email } : null;
      isOwner = !!s.isOwner;
    } catch {
      // The routes are not reachable. The site still reads and still saves
      // locally; it just cannot publish.
    }
    fire();
  }

  async function post(payload) {
    if (!online) return { error: 'not online' };
    try {
      const r = await fetch('/lastthread/data', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const out = await r.json();
      return r.ok ? out : { error: out.error || ('failed: ' + r.status) };
    } catch (e) {
      return { error: e.message };
    }
  }

  async function load() {
    if (!online) return null;
    try {
      const r = await fetch('/lastthread/data', { credentials: 'same-origin' });
      doc = await r.json();
      return doc;
    } catch {
      return null;
    }
  }

  /* ---------- what the edit bar calls ---------- */

  async function listPosts() {
    const d = doc.posts && doc.posts.length ? doc : (await load());
    if (!d || !d.posts) return null;
    return d.posts.map(p => Object.assign({}, p, { remote: true, author: p.author || 'the editor' }));
  }

  async function getPost(id) {
    const d = await load();
    const p = d && d.posts ? d.posts.find(x => x.id === id) : null;
    return p ? Object.assign({}, p, { remote: true }) : null;
  }

  async function createPost(p) {
    const id = p.id || ('p' + Date.now());
    const r = await post({ type: 'post', post: Object.assign({}, p, { id }) });
    return r.error ? r : { id };
  }

  async function deletePost(id) { return post({ type: 'delete', id }); }

  async function loadEdits(page) {
    const d = await load();
    const forPage = d && d.edits ? d.edits[page] : null;
    if (!forPage) return { text: {}, image: {} };
    return { text: forPage.text || {}, image: forPage.image || {} };
  }

  async function saveEdit(page, address, kind, value) {
    return post({ type: 'edit', page, address, kind, value });
  }

  /* ---------- the panel ---------- */

  function authPanel() {
    const p = document.getElementById('lt-panel');
    const back = encodeURIComponent(location.pathname + location.search);

    if (!online) {
      p.innerHTML =
        '<h4>Reading this off your own disk</h4>' +
        '<p class="lt-note">There is no site to sign in to from here, so anything you change ' +
        'is kept in this browser. Open it at mythefeed.com/lastthread to publish.</p>' +
        '<button id="lt-auth-close" class="lt-btn">close</button>';
    } else if (user && isOwner) {
      p.innerHTML =
        '<h4>Signed in as the editor</h4>' +
        '<p class="lt-note">' + esc(user.email || '') + '. Your edits and posts save for everybody.</p>' +
        '<p class="lt-note">This is your mythefeed.com account. Sign out from the feed.</p>' +
        '<button id="lt-auth-close" class="lt-btn">close</button>';
    } else if (user) {
      p.innerHTML =
        '<h4>Signed in</h4>' +
        '<p class="lt-note">' + esc(user.email || '') + ', with your mythefeed.com account.</p>' +
        '<p class="lt-note">Writing and editing LastThread belong to the site\'s editor. ' +
        'Everything here is yours to read.</p>' +
        '<button id="lt-auth-close" class="lt-btn">close</button>';
    } else {
      p.innerHTML =
        '<h4>Sign in</h4>' +
        '<p class="lt-note">LastThread is part of mythefeed.com and uses the same account. ' +
        'Sign in on either and you are signed in on both.</p>' +
        '<p><a class="lt-btn lt-link" href="/sign-in?next=' + back + '">sign in with your mythefeed.com account</a></p>' +
        '<p class="lt-note">Reading needs no account at all.</p>' +
        '<button id="lt-auth-close" class="lt-btn lt-quiet">close</button>';
    }

    p.style.display = 'block';
    p.querySelector('#lt-auth-close').onclick = () => { p.style.display = 'none'; };
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  document.addEventListener('DOMContentLoaded', init);

  return { onChange, state, authPanel, listPosts, createPost, deletePost, getPost, loadEdits, saveEdit };
})();
