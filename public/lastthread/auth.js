/* LastThread. Accounts.

   Sign up, sign in, sign out, and a profile that follows you between devices.
   Posts you write while signed in are saved to the database and are readable
   by everyone. Signed out, the site behaves as it always has: your work is
   kept in this browser and goes no further.

   Everything here is optional. With no database configured in config.js, this
   file adds one line to the bar saying so, and gets out of the way. */

window.LT = (function () {
  const cfg = window.LASTTHREAD_CONFIG || {};
  const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  let sb = null;
  let user = null;
  let isOwner = false;
  const listeners = [];

  function onChange(fn) { listeners.push(fn); fn(state()); }
  function fire() { const s = state(); listeners.forEach(fn => fn(s)); }
  function state() { return { configured, user, isOwner, client: sb }; }

  async function init() {
    if (!configured) { fire(); return; }
    if (!window.supabase) { console.warn('LastThread: the Supabase library did not load.'); fire(); return; }
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

    const { data } = await sb.auth.getSession();
    user = data.session ? data.session.user : null;
    await checkOwner();
    fire();

    sb.auth.onAuthStateChange(async (_event, session) => {
      user = session ? session.user : null;
      await checkOwner();
      fire();
    });
  }

  async function checkOwner() {
    isOwner = false;
    if (!user) return;
    const { data } = await sb.from('lastthread_owners').select('user_id').eq('user_id', user.id).maybeSingle();
    isOwner = !!data;
  }

  /* ---------- the sign in panel ---------- */
  function authPanel() {
    const p = document.getElementById('lt-panel');
    if (!configured) {
      p.innerHTML =
        '<h4>Accounts are not switched on yet</h4>' +
        '<p class="lt-note">The site is running without a database, so everything you write stays in this browser.</p>' +
        '<p class="lt-note">To turn accounts on: open Supabase, Settings, API, and paste the Project URL and the anon public key into <code>config.js</code>. Then run <code>supabase/migrations/020-lastthread.sql</code> in the SQL editor. Full instructions are in the README.</p>' +
        '<button id="lt-auth-close" class="lt-btn">close</button>';
      p.style.display = 'block';
      p.querySelector('#lt-auth-close').onclick = () => { p.style.display = 'none'; };
      return;
    }

    if (user) {
      p.innerHTML =
        '<h4>Signed in</h4>' +
        '<p class="lt-note">' + esc(user.email) + (isOwner ? ' (site owner: your page edits save for everybody)' : '') + '</p>' +
        '<button id="lt-signout" class="lt-btn">sign out</button> ' +
        '<button id="lt-auth-close" class="lt-btn lt-quiet">close</button>';
      p.style.display = 'block';
      p.querySelector('#lt-signout').onclick = async () => {
        await sb.auth.signOut();
        p.style.display = 'none';
        location.reload();
      };
      p.querySelector('#lt-auth-close').onclick = () => { p.style.display = 'none'; };
      return;
    }

    p.innerHTML =
      '<h4>Sign in to LastThread</h4>' +
      '<div class="lt-field"><label>email</label><input type="text" id="lt-email"></div>' +
      '<div class="lt-field"><label>password</label><input type="password" id="lt-pass"></div>' +
      '<button id="lt-signin" class="lt-btn">sign in</button> ' +
      '<button id="lt-signup" class="lt-btn lt-quiet">create an account</button> ' +
      '<button id="lt-auth-close" class="lt-btn lt-quiet">close</button>' +
      '<p class="lt-note" id="lt-authnote">Your posts are saved to the site and readable by anyone. ' +
      'Anything you wrote before signing in stays in this browser until you move it across.</p>';
    p.style.display = 'block';

    const note = m => { p.querySelector('#lt-authnote').textContent = m; };
    const creds = () => ({
      email: (p.querySelector('#lt-email').value || '').trim(),
      password: p.querySelector('#lt-pass').value || ''
    });

    p.querySelector('#lt-signin').onclick = async () => {
      const c = creds();
      if (!c.email || !c.password) { note('Email and password, please.'); return; }
      note('signing in...');
      const { error } = await sb.auth.signInWithPassword(c);
      if (error) { note(error.message); return; }
      p.style.display = 'none';
      location.reload();
    };

    p.querySelector('#lt-signup').onclick = async () => {
      const c = creds();
      if (!c.email || c.password.length < 8) { note('An email, and a password of at least eight characters.'); return; }
      note('creating the account...');
      const { error } = await sb.auth.signUp(c);
      if (error) { note(error.message); return; }
      note('Account made. Check your email if confirmation is switched on, then sign in.');
    };

    p.querySelector('#lt-auth-close').onclick = () => { p.style.display = 'none'; };
  }

  /* ---------- posts, on the server ---------- */
  async function listPosts() {
    if (!sb) return null;
    const { data, error } = await sb
      .from('lastthread_posts')
      .select('id,title,body,sources,era,place,channel,picture_url,created_at,author_id')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) { console.warn('LastThread posts:', error.message); return null; }
    return data.map(row => ({
      id: row.id, title: row.title, body: row.body || '', sources: row.sources || '',
      era: row.era || '', place: row.place || '', channel: row.channel || '',
      picture: row.picture_url || '', author: 'a member',
      date: (row.created_at || '').slice(0, 10), remote: true
    }));
  }

  async function createPost(post) {
    if (!sb || !user) return { error: 'not signed in' };
    const { data, error } = await sb.from('lastthread_posts').insert({
      author_id: user.id, title: post.title, body: post.body, sources: post.sources,
      era: post.era, place: post.place, channel: post.channel, picture_url: post.picture
    }).select('id').single();
    return error ? { error: error.message } : { id: data.id };
  }

  async function deletePost(id) {
    if (!sb || !user) return { error: 'not signed in' };
    const { error } = await sb.from('lastthread_posts').delete().eq('id', id);
    return error ? { error: error.message } : {};
  }

  async function getPost(id) {
    if (!sb) return null;
    const { data, error } = await sb.from('lastthread_posts').select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id, title: data.title, body: data.body || '', sources: data.sources || '',
      era: data.era || '', place: data.place || '', channel: data.channel || '',
      picture: data.picture_url || '', author: 'a member',
      date: (data.created_at || '').slice(0, 10), remote: true
    };
  }

  /* ---------- page edits, shared, owners only ---------- */
  async function loadEdits(page) {
    if (!sb) return null;
    const { data, error } = await sb.from('lastthread_edits').select('address,kind,value').eq('page', page);
    if (error) return null;
    const out = { text: {}, image: {} };
    data.forEach(r => { out[r.kind][r.address] = r.value; });
    return out;
  }

  async function saveEdit(page, address, kind, value) {
    if (!sb || !isOwner) return { error: 'not an owner' };
    const { error } = await sb.from('lastthread_edits')
      .upsert({ page, address, kind, value, updated_by: user.id, updated_at: new Date().toISOString() },
              { onConflict: 'page,address,kind' });
    return error ? { error: error.message } : {};
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  document.addEventListener('DOMContentLoaded', init);

  return { onChange, state, authPanel, listPosts, createPost, deletePost, getPost, loadEdits, saveEdit };
})();
