/* LastThread — the working parts.
   No backend, no build step, no dependencies. Everything here runs in the
   browser and stores what it needs in localStorage. Each gadget checks for its
   own container first, so this one file is safe to load on every page. */

/* ==========================================================================
   1. SUBGENRES
   The vocabulary the whole site sorts by. Add one here and it appears in the
   analyser, the store filter and the profile picker at once.
   ========================================================================== */
const SUBGENRES = [
  { id:'archive',    name:'archive / deconstruction', blurb:'Exposed seams, raw hems, a garment that shows its own making. Margiela, early Demeulemeester, Helmut Lang before 2005.' },
  { id:'minimal',    name:'90s minimalism',           blurb:'Nothing decorative. Weight, drape and one colour. Jil Sander, Calvin Klein Collection, Prada nylon.' },
  { id:'workwear',   name:'workwear / utility',       blurb:'Moleskin, duck canvas, bar tacks, four pockets. Bought to be repaired rather than replaced.' },
  { id:'tailoring',  name:'tailoring',                blurb:'Cut from a block and fitted to a body. Suits, coats, trousers with a real waistband.' },
  { id:'punk',       name:'punk / DIY',               blurb:'Cut up, safety-pinned, screened by hand. The garment is a statement you made yourself.' },
  { id:'y2k',        name:'Y2K',                      blurb:'Low rise, logo hardware, shine, tiny bags. 1998 to about 2004, and back again.' },
  { id:'denim',      name:'vintage denim',            blurb:'Selvedge, repro cuts, fades that were earned. Japanese repro and American originals.' },
  { id:'ivy',        name:'ivy / prep',               blurb:'Oxford cloth, repp stripe, loafers. Sack jacket, undarted, three-roll-two.' },
  { id:'gorp',       name:'gorpcore / technical',     blurb:'Shell fabric, taped seams, hardware that does a job. Outdoor kit worn in a city.' },
  { id:'afromodern', name:'Afro-modernist',           blurb:'Ankara, aso-oke, adire and strip-weave cut into contemporary silhouettes.' },
  { id:'avant',      name:'avant-garde',              blurb:'Volume that argues with the body. Yohji, Comme des Garçons, Rick Owens.' },
  { id:'street',     name:'streetwear',               blurb:'Graphic, logo, sneaker-led. Skate and hip-hop lineage, made industrial.' }
];

/* ==========================================================================
   2. SHOPS
   Real, independent places — vintage, archive resale, and small stockists.
   NOT the high street. Coordinates are CITY CENTRES, not shopfronts: this
   sorts by which city you are nearest, which is the honest resolution for a
   list built without a maps API. Addresses and opening hours are deliberately
   absent because they change and nobody here can verify them — always check
   the shop's own site before you travel.
   ========================================================================== */
const SHOPS = [
  // ---- online first, since most people shop from where they are ----
  { name:'Grailed',              city:'online', region:'Online', lat:null, lon:null, tags:['archive','minimal','street','denim','y2k','avant'], note:'Peer-to-peer resale. Deepest pool for archive menswear; search by designer and year.' },
  { name:'Vestiaire Collective', city:'online', region:'Online', lat:null, lon:null, tags:['archive','minimal','tailoring','y2k','avant'], note:'Resale, global, authenticated. Strong on European houses.' },
  { name:'Depop',                city:'online', region:'Online', lat:null, lon:null, tags:['y2k','punk','street','denim'], note:'Seller-led and young. Best for Y2K and reworked pieces, worst for sizing accuracy.' },
  { name:'eBay + a Japan proxy', city:'online', region:'Online', lat:null, lon:null, tags:['archive','denim','avant','minimal'], note:'Japanese auction sites hold the deepest archive stock. Reached through a proxy buyer such as Buyee or ZenMarket.' },
  { name:'Etsy (vintage filter)',city:'online', region:'Online', lat:null, lon:null, tags:['workwear','denim','afromodern','punk'], note:'Set the filter to vintage. Small sellers, real garments, patchy photography.' },
  { name:'The RealReal',         city:'online', region:'Online', lat:null, lon:null, tags:['tailoring','minimal','archive'], note:'Consignment, authenticated, US-weighted.' },
  { name:'Byronesque',           city:'online', region:'Online', lat:null, lon:null, tags:['archive','avant','minimal'], note:'Curated vintage from a narrow, serious set of designers.' },

  // ---- Europe ----
  { name:'Machine-A',           city:'London',    region:'Europe', lat:51.5127, lon:-0.1350, tags:['avant','archive','street'], note:'Soho stockist of young avant-garde designers. Ships.' },
  { name:'Rellik',              city:'London',    region:'Europe', lat:51.5210, lon:-0.2060, tags:['archive','punk','avant'], note:'Long-running vintage specialist under Trellick Tower.' },
  { name:'Blitz',               city:'London',    region:'Europe', lat:51.5230, lon:-0.0730, tags:['denim','y2k','workwear','punk'], note:'Large sorted vintage department store in the East End.' },
  { name:'Goodhood',            city:'London',    region:'Europe', lat:51.5280, lon:-0.0840, tags:['street','gorp','workwear'], note:'Independent, Japanese and technical labels.' },
  { name:'Thanx God I\'m a VIP', city:'Paris',    region:'Europe', lat:48.8700, lon:2.3670, tags:['archive','minimal','y2k'], note:'Vintage racked by colour and designer rather than decade.' },
  { name:'Free\'P\'Star',        city:'Paris',    region:'Europe', lat:48.8580, lon:2.3560, tags:['y2k','punk','denim'], note:'Cheap, dense, dig-it-yourself vintage in the Marais.' },
  { name:'RA',                  city:'Antwerp',   region:'Europe', lat:51.2180, lon:4.4000, tags:['avant','archive','minimal'], note:'Concept store from the city that produced the Antwerp Six.' },
  { name:'Graanmarkt 13',       city:'Antwerp',   region:'Europe', lat:51.2150, lon:4.4090, tags:['minimal','tailoring','avant'], note:'Quiet, considered, Belgian-weighted selection.' },
  { name:'Cavalli e Nastri',    city:'Milan',     region:'Europe', lat:45.4640, lon:9.1860, tags:['archive','tailoring','y2k'], note:'Italian vintage, strong on 60s–90s house pieces.' },
  { name:'Voo Store',           city:'Berlin',    region:'Europe', lat:52.5010, lon:13.4230, tags:['street','gorp','minimal'], note:'Kreuzberg courtyard store, independent labels.' },
  { name:'Sing Blackbird',      city:'Berlin',    region:'Europe', lat:52.4930, lon:13.4270, tags:['y2k','denim','punk'], note:'Small curated vintage, Neukölln.' },
  { name:'Episode',             city:'Amsterdam', region:'Europe', lat:52.3720, lon:4.8930, tags:['workwear','denim','y2k'], note:'Chain of large sorted vintage warehouses across NL and BE.' },
  { name:'Prag Vintage',        city:'Copenhagen',region:'Europe', lat:55.6790, lon:12.5620, tags:['minimal','denim','workwear'], note:'Scandinavian vintage, restrained selection.' },

  // ---- Asia ----
  { name:'Berberjin',           city:'Tokyo',     region:'Asia', lat:35.6640, lon:139.6980, tags:['denim','workwear'], note:'Harajuku. Vintage American denim at collector level.' },
  { name:'Ragtag',              city:'Tokyo',     region:'Asia', lat:35.6660, lon:139.7000, tags:['archive','avant','minimal'], note:'Multi-floor designer resale. The most reliable archive stock anywhere.' },
  { name:'Kindal',              city:'Tokyo',     region:'Asia', lat:35.6620, lon:139.6990, tags:['archive','street','avant'], note:'Second-hand designer across many branches.' },
  { name:'Dover Street Market', city:'Tokyo',     region:'Asia', lat:35.6720, lon:139.7650, tags:['avant','street','archive'], note:'Ginza. Comme des Garçons\' own department store.' },
  { name:'Dongmyo flea market', city:'Seoul',     region:'Asia', lat:37.5720, lon:127.0160, tags:['y2k','workwear','denim','street'], note:'Open-air. Enormous, cheap, unsorted — go early.' },
  { name:'Ader Error Space',    city:'Seoul',     region:'Asia', lat:37.5560, lon:126.9230, tags:['street','minimal'], note:'Flagship of the Korean label, worth it for the merchandising alone.' },

  // ---- Americas ----
  { name:'James Veloria',       city:'New York',  region:'Americas', lat:40.7160, lon:-73.9970, tags:['archive','y2k','avant'], note:'Curated archive designer, Manhattan. Ships.' },
  { name:'Procell',             city:'New York',  region:'Americas', lat:40.7190, lon:-73.9890, tags:['punk','street','y2k'], note:'Band tees and subcultural vintage, seriously sourced.' },
  { name:'Front General Store', city:'New York',  region:'Americas', lat:40.7030, lon:-73.9900, tags:['workwear','denim','ivy'], note:'Dumbo. Japanese-American vintage and workwear.' },
  { name:'Wasteland',           city:'Los Angeles',region:'Americas',lat:34.0830, lon:-118.3720, tags:['y2k','punk','denim'], note:'Melrose. Big, sorted, consistently stocked.' },
  { name:'Departamento',        city:'Los Angeles',region:'Americas',lat:34.0640, lon:-118.2370, tags:['avant','minimal','street'], note:'Chinatown. Independent designers, quiet space.' },
  { name:'Goodbye Folk',        city:'Mexico City',region:'Americas',lat:19.4160, lon:-99.1650, tags:['denim','y2k','workwear'], note:'Roma. Vintage plus a shoemaker at the back.' },

  // ---- Africa ----
  { name:'Alára',               city:'Lagos',     region:'Africa', lat:6.4370, lon:3.4350, tags:['afromodern','avant','tailoring'], note:'Victoria Island concept store in an Adjaye building. African designers at the top end.' },
  { name:'Katangua market',     city:'Lagos',     region:'Africa', lat:6.5270, lon:3.3200, tags:['y2k','denim','workwear'], note:'Vast second-hand market. The other end of the global vintage chain — bargain hard.' },
  { name:'Kofar Mata dye pits', city:'Kano',      region:'Africa', lat:12.0000, lon:8.5160, tags:['afromodern'], note:'Working indigo pits, centuries old. Cloth, not clothing — take it to a tailor.' },
  { name:'Merchants on Long',   city:'Cape Town', region:'Africa', lat:-33.9220, lon:18.4180, tags:['afromodern','tailoring','minimal'], note:'Pan-African designers, curated small.' }
];

/* ==========================================================================
   3. HELPERS
   ========================================================================== */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const subgenre = id => SUBGENRES.find(s => s.id === id);

/* great-circle distance in km, city centre to city centre */
function distanceKm(a, b, c, d){
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(c - a), dLon = rad(d - b);
  const h = Math.sin(dLat/2)**2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLon/2)**2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function shopRow(shop, here){
  const far = (here && shop.lat != null)
    ? `<span class="dist">${distanceKm(here.lat, here.lon, shop.lat, shop.lon).toLocaleString()} km</span>`
    : (shop.lat == null ? '<span class="dist">ships</span>' : '');
  const tags = shop.tags.map(t => (subgenre(t)||{}).name).filter(Boolean).slice(0,3).join(' · ');
  return `<li class="shop">
    <div class="shop-head"><b>${shop.name}</b> ${far}</div>
    <div class="shop-city">${shop.city === 'online' ? 'online only' : shop.city} · ${shop.region}</div>
    <p>${shop.note}</p>
    <div class="shop-tags">${tags}</div>
  </li>`;
}

/* localStorage, wrapped so a blocked or full store never breaks a page */
const store = {
  get(k, fallback){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
};

/* ==========================================================================
   4. THE ANALYSER
   You upload a photo, it shows, you tag it. The tagging is yours for now —
   automatic detection needs a server and an image model, and saying otherwise
   would be a lie dressed as a feature. What IS real: the matching, the store
   results, the distance sort and the shopping list.
   ========================================================================== */
function initAnalyser(){
  const root = $('#analyser');
  if (!root) return;

  let picked = new Set();
  let here = null;

  /* the subgenre chips */
  $('#chips').innerHTML = SUBGENRES.map(s =>
    `<button type="button" class="chip" data-id="${s.id}" title="${s.blurb}">${s.name}</button>`
  ).join('');

  $('#chips').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    const id = b.dataset.id;
    picked.has(id) ? picked.delete(id) : picked.add(id);
    b.classList.toggle('on', picked.has(id));
    render();
  });

  /* the photo. Read locally, never uploaded anywhere. */
  $('#photo').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      $('#preview').innerHTML = `<img src="${r.result}" alt="the outfit you uploaded">`;
      $('#preview').classList.add('has-image');
    };
    r.readAsDataURL(f);
  });

  /* location. Real browser GPS; falls back to the region dropdown, which is
     also the only thing that works when the page is opened as a file:// */
  $('#locate').addEventListener('click', () => {
    const out = $('#locstatus');
    if (!navigator.geolocation){ out.textContent = 'This browser has no location. Use the region list.'; return; }
    out.textContent = 'asking…';
    navigator.geolocation.getCurrentPosition(
      pos => {
        here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        out.textContent = 'located — results now sort by nearest city';
        render();
      },
      err => {
        out.textContent = err.code === 1
          ? 'you said no, which is fine — use the region list'
          : 'no fix (this needs the site served over http/https, not a file). Use the region list.';
      },
      { timeout: 8000 }
    );
  });

  $('#region').addEventListener('change', render);

  function render(){
    const region = $('#region').value;
    const list = $('#results');
    const want = [...picked];

    if (!want.length){
      list.innerHTML = '<li class="empty">Pick at least one subgenre above and the shops appear here.</li>';
      $('#shoplist').innerHTML = '';
      $('#resultcount').textContent = '';
      return;
    }

    /* score: how many of your picks a shop covers */
    let matches = SHOPS
      .map(s => ({ s, hits: s.tags.filter(t => want.includes(t)).length }))
      .filter(m => m.hits > 0)
      .filter(m => region === 'all' || m.s.region === region);

    matches.sort((a, b) => {
      if (here && a.s.lat != null && b.s.lat != null){
        return distanceKm(here.lat, here.lon, a.s.lat, a.s.lon)
             - distanceKm(here.lat, here.lon, b.s.lat, b.s.lon);
      }
      return b.hits - a.hits;
    });

    $('#resultcount').textContent = `${matches.length} places`;
    list.innerHTML = matches.map(m => shopRow(m.s, here)).join('')
      || '<li class="empty">Nothing in that region for those tags. Try Online, or widen the region.</li>';

    /* the shopping list: what to actually look for, per subgenre picked */
    $('#shoplist').innerHTML = want.map(id => {
      const g = subgenre(id);
      return `<li><b>${g.name}</b><br><span class="caption">${g.blurb}</span></li>`;
    }).join('');
  }

  render();
}

/* ==========================================================================
   5. THE STORE DIRECTORY (stores.html)
   ========================================================================== */
function initDirectory(){
  const list = $('#dirlist');
  if (!list) return;

  $('#dirgenre').innerHTML = '<option value="all">every subgenre</option>' +
    SUBGENRES.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  const draw = () => {
    const g = $('#dirgenre').value, r = $('#dirregion').value;
    const rows = SHOPS
      .filter(s => g === 'all' || s.tags.includes(g))
      .filter(s => r === 'all' || s.region === r);
    $('#dircount').textContent = `${rows.length} of ${SHOPS.length}`;
    list.innerHTML = rows.map(s => shopRow(s, null)).join('')
      || '<li class="empty">Nothing matches. Widen one of the two filters.</li>';
  };

  $('#dirgenre').addEventListener('change', draw);
  $('#dirregion').addEventListener('change', draw);
  draw();
}

/* ==========================================================================
   6. THREADLE — the fashion word game. Five letters, six guesses, one word a
   day, same word for everybody on that date.
   ========================================================================== */
const THREADLE_WORDS = [
  'DENIM','TOILE','PLEAT','TWEED','SERGE','RAYON','LYCRA','CREPE','DRAPE','BASTE',
  'SATIN','SUEDE','LINEN','TULLE','BRAID','DOBBY','PIQUE','CHINO','LAPEL','SHEER',
  'WEAVE','BATIK','KENTE','MUSLI','SEAMS','HEMMS','CUFFS','MODAL','SISAL','ADIRE'
].filter(w => w.length === 5 && !['MUSLI','HEMMS'].includes(w));

function initThreadle(){
  const board = $('#board');
  if (!board) return;

  const DAY = Math.floor(Date.now() / 864e5);
  const answer = THREADLE_WORDS[DAY % THREADLE_WORDS.length];
  const key = 'threadle-' + DAY;

  let state = store.get(key, { guesses: [], done: false });

  function paint(){
    let html = '';
    for (let r = 0; r < 6; r++){
      const g = state.guesses[r] || '';
      html += '<div class="row">';
      for (let c = 0; c < 5; c++){
        let cls = '';
        if (g){
          const ch = g[c];
          cls = ch === answer[c] ? 'hit' : (answer.includes(ch) ? 'near' : 'miss');
        }
        html += `<span class="cell ${cls}">${g[c] || ''}</span>`;
      }
      html += '</div>';
    }
    board.innerHTML = html;

    const msg = $('#threadle-msg');
    if (state.done){
      const won = state.guesses.includes(answer);
      msg.innerHTML = won
        ? `<b>got it in ${state.guesses.length}.</b> come back tomorrow.`
        : `<b>out of guesses — it was ${answer}.</b> come back tomorrow.`;
      $('#guess').disabled = true;
      $('#guessbtn').disabled = true;
    } else {
      msg.textContent = `${6 - state.guesses.length} guesses left`;
    }
  }

  function submit(){
    const input = $('#guess');
    const g = (input.value || '').toUpperCase().trim();
    const msg = $('#threadle-msg');
    if (g.length !== 5){ msg.textContent = 'five letters.'; return; }
    if (!/^[A-Z]+$/.test(g)){ msg.textContent = 'letters only.'; return; }
    state.guesses.push(g);
    if (g === answer || state.guesses.length === 6) state.done = true;
    store.set(key, state);
    input.value = '';
    paint();
  }

  $('#guessbtn').addEventListener('click', submit);
  $('#guess').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  paint();
}

/* ==========================================================================
   7. PROFILE
   Your picture, your fits, your subgenres. All of it local to this browser —
   nothing is sent anywhere, because there is nowhere to send it yet.
   The social half (friends, following, followers) is built but archived; see
   profile.html, where it sits commented out until we want it.
   ========================================================================== */
function initProfile(){
  const root = $('#profile');
  if (!root) return;

  let me = store.get('lastthread-profile', {
    name: 'your name', handle: '@you', bio: 'One line about what you wear and why.',
    avatar: '', tags: [], fits: []
  });

  function save(){ 
    if (!store.set('lastthread-profile', me)){
      $('#savestate').textContent = 'could not save — this browser is blocking storage';
      return;
    }
    $('#savestate').textContent = 'saved to this browser';
    setTimeout(() => { $('#savestate').textContent = ''; }, 2500);
  }

  function paint(){
    $('#p-name').value   = me.name;
    $('#p-handle').value = me.handle;
    $('#p-bio').value    = me.bio;
    $('#avatar').innerHTML = me.avatar
      ? `<img src="${me.avatar}" alt="your profile picture">`
      : 'no picture yet';
    $('#avatar').classList.toggle('has-image', !!me.avatar);

    $('#p-tags').innerHTML = SUBGENRES.map(s =>
      `<button type="button" class="chip ${me.tags.includes(s.id) ? 'on' : ''}" data-id="${s.id}">${s.name}</button>`
    ).join('');

    $('#fits').innerHTML = me.fits.length
      ? me.fits.map((f, i) => `<figure class="fit">
          <img src="${f.src}" alt="${f.cap || 'a fit'}">
          <figcaption>${f.cap || 'untitled'}<br><button type="button" class="linky" data-del="${i}">remove</button></figcaption>
        </figure>`).join('')
      : '<p class="caption">Nothing here yet. Add a fit below — a whole outfit, or one garment.</p>';
  }

  /* read a file as a data URL, downscaled — full-size photos fill localStorage
     in about four uploads, and this site is meant to look low-res anyway */
  function readSmall(file, cb){
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 420;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width  = Math.round(img.width  * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => cb(r.result);
      img.src = r.result;
    };
    r.readAsDataURL(file);
  }

  $('#avatarfile').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    readSmall(f, d => { me.avatar = d; paint(); save(); });
  });

  $('#fitfile').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    readSmall(f, d => {
      me.fits.unshift({ src: d, cap: $('#fitcap').value.trim() });
      $('#fitcap').value = '';
      e.target.value = '';
      paint(); save();
    });
  });

  $('#fits').addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    me.fits.splice(Number(b.dataset.del), 1);
    paint(); save();
  });

  $('#p-tags').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    const id = b.dataset.id;
    me.tags = me.tags.includes(id) ? me.tags.filter(t => t !== id) : me.tags.concat(id);
    paint(); save();
  });

  ['p-name','p-handle','p-bio'].forEach(id => {
    $('#' + id).addEventListener('input', e => {
      me[id.slice(2)] = e.target.value;
      save();
    });
  });

  paint();
}

document.addEventListener('DOMContentLoaded', () => {
  initAnalyser();
  initDirectory();
  initThreadle();
  initProfile();
});
