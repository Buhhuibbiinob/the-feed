/* LastThread. The working parts.
   No backend, no build step, no dependencies. Everything here runs in the
   browser and stores what it needs in localStorage. Each gadget checks for its
   own container first, so this one file is safe to load on every page. */

/* ==========================================================================
   1. SUBGENRES
   The vocabulary the whole site sorts by. Add one here and it appears in the
   analyser, the store filter and the profile picker at once.
   ========================================================================== */
const SUBGENRES = [
  { id:'archive',    name:'archive / deconstruction', blurb:'Exposed seams, raw hems, linings on the outside. Margiela, early Demeulemeester, Helmut Lang before 2005.' },
  { id:'minimal',    name:'90s minimalism',           blurb:'No decoration. Weight, drape, one colour. Jil Sander, Calvin Klein Collection, Prada nylon.' },
  { id:'workwear',   name:'workwear / utility',       blurb:'Moleskin, duck canvas, bar tacks, four pockets. Made to be mended.' },
  { id:'tailoring',  name:'tailoring',                blurb:'Cut from a block and fitted. Suits, coats, trousers with a proper waistband.' },
  { id:'punk',       name:'punk / DIY',               blurb:'Cut up, safety-pinned, screen printed at home.' },
  { id:'y2k',        name:'Y2K',                      blurb:'Low rise, logo hardware, shine, small bags. 1998 to about 2004.' },
  { id:'denim',      name:'vintage denim',            blurb:'Selvedge, repro cuts, worn-in fades. Japanese repro and American originals.' },
  { id:'ivy',        name:'ivy / prep',               blurb:'Oxford cloth, repp stripe, loafers. Undarted sack jacket, three-roll-two.' },
  { id:'gorp',       name:'gorpcore / technical',     blurb:'Shell fabric, taped seams, working hardware. Outdoor kit worn in town.' },
  { id:'afromodern', name:'Afro-modernist',           blurb:'Ankara, aso-oke, adire and strip-weave cut into modern shapes.' },
  { id:'avant',      name:'avant-garde',              blurb:'Volume worked away from the body. Yohji, Comme des Garçons, Rick Owens.' },
  { id:'street',     name:'streetwear',               blurb:'Graphics, logos, sneakers. Out of skate and hip-hop.' }
];

/* ==========================================================================
   2. SHOPS
   Real, independent places: vintage shops, archive resale, and small stockists.
   NOT the high street. Coordinates are CITY CENTRES, not shopfronts: this
   sorts by which city you are nearest, which is the honest resolution for a
   list built without a maps API. Addresses and opening hours are deliberately
   absent because they change and nobody here can verify them. Always check
   the shop's own site before you travel.
   ========================================================================== */
const SHOPS = [
  // ---- online first, since most people shop from where they are ----
  { name:'Grailed',              city:'online', region:'Online', lat:null, lon:null, tags:['archive','minimal','street','denim','y2k','avant'], note:'Peer to peer resale. The biggest pool of archive menswear. Search by designer and year.' },
  { name:'Vestiaire Collective', city:'online', region:'Online', lat:null, lon:null, tags:['archive','minimal','tailoring','y2k','avant'], note:'Resale, worldwide, authenticated. Strong on European houses.' },
  { name:'Depop',                city:'online', region:'Online', lat:null, lon:null, tags:['y2k','punk','street','denim'], note:'Mostly young sellers. Good for Y2K and reworked pieces. Sizing is often wrong.' },
  { name:'eBay + a Japan proxy', city:'online', region:'Online', lat:null, lon:null, tags:['archive','denim','avant','minimal'], note:'Japanese auction sites hold the most archive stock. You need a proxy buyer such as Buyee or ZenMarket to reach them.' },
  { name:'Etsy (vintage filter)',city:'online', region:'Online', lat:null, lon:null, tags:['workwear','denim','afromodern','punk'], note:'Set the filter to vintage. Small sellers, real garments, bad photos.' },
  { name:'The RealReal',         city:'online', region:'Online', lat:null, lon:null, tags:['tailoring','minimal','archive'], note:'Consignment, authenticated, mostly US stock.' },
  { name:'Byronesque',           city:'online', region:'Online', lat:null, lon:null, tags:['archive','avant','minimal'], note:'Vintage from a small, tightly chosen set of designers.' },

  // ---- Europe ----
  { name:'Machine-A',           city:'London',    region:'Europe', lat:51.5127, lon:-0.1350, tags:['avant','archive','street'], note:'Soho. Stocks young avant-garde designers. Ships.' },
  { name:'Rellik',              city:'London',    region:'Europe', lat:51.5210, lon:-0.2060, tags:['archive','punk','avant'], note:'Vintage specialist under Trellick Tower, open since the 1990s.' },
  { name:'Blitz',               city:'London',    region:'Europe', lat:51.5230, lon:-0.0730, tags:['denim','y2k','workwear','punk'], note:'Big sorted vintage store in the East End.' },
  { name:'Goodhood',            city:'London',    region:'Europe', lat:51.5280, lon:-0.0840, tags:['street','gorp','workwear'], note:'Independent, Japanese and technical labels.' },
  { name:'Thanx God I\'m a VIP', city:'Paris',    region:'Europe', lat:48.8700, lon:2.3670, tags:['archive','minimal','y2k'], note:'Vintage racked by colour and designer instead of decade.' },
  { name:'Free\'P\'Star',        city:'Paris',    region:'Europe', lat:48.8580, lon:2.3560, tags:['y2k','punk','denim'], note:'Cheap and crowded. You dig through it yourself. Marais.' },
  { name:'RA',                  city:'Antwerp',   region:'Europe', lat:51.2180, lon:4.4000, tags:['avant','archive','minimal'], note:'Concept store in the city the Antwerp Six came from.' },
  { name:'Graanmarkt 13',       city:'Antwerp',   region:'Europe', lat:51.2150, lon:4.4090, tags:['minimal','tailoring','avant'], note:'Quiet shop, mostly Belgian designers.' },
  { name:'Cavalli e Nastri',    city:'Milan',     region:'Europe', lat:45.4640, lon:9.1860, tags:['archive','tailoring','y2k'], note:'Italian vintage. Strong on house pieces from the 60s to the 90s.' },
  { name:'Voo Store',           city:'Berlin',    region:'Europe', lat:52.5010, lon:13.4230, tags:['street','gorp','minimal'], note:'Courtyard store in Kreuzberg. Independent labels.' },
  { name:'Sing Blackbird',      city:'Berlin',    region:'Europe', lat:52.4930, lon:13.4270, tags:['y2k','denim','punk'], note:'Small vintage shop in Neukölln.' },
  { name:'Episode',             city:'Amsterdam', region:'Europe', lat:52.3720, lon:4.8930, tags:['workwear','denim','y2k'], note:'Chain of big sorted vintage warehouses in the Netherlands and Belgium.' },
  { name:'Prag Vintage',        city:'Copenhagen',region:'Europe', lat:55.6790, lon:12.5620, tags:['minimal','denim','workwear'], note:'Scandinavian vintage, small selection.' },

  // ---- Asia ----
  { name:'Berberjin',           city:'Tokyo',     region:'Asia', lat:35.6640, lon:139.6980, tags:['denim','workwear'], note:'Harajuku. Vintage American denim, collector prices.' },
  { name:'Ragtag',              city:'Tokyo',     region:'Asia', lat:35.6660, lon:139.7000, tags:['archive','avant','minimal'], note:'Several floors of designer resale. The most reliable archive stock anywhere.' },
  { name:'Kindal',              city:'Tokyo',     region:'Asia', lat:35.6620, lon:139.6990, tags:['archive','street','avant'], note:'Second-hand designer, many branches.' },
  { name:'Dover Street Market', city:'Tokyo',     region:'Asia', lat:35.6720, lon:139.7650, tags:['avant','street','archive'], note:'Ginza. The Comme des Garçons department store.' },
  { name:'Dongmyo flea market', city:'Seoul',     region:'Asia', lat:37.5720, lon:127.0160, tags:['y2k','workwear','denim','street'], note:'Open air, huge, cheap and unsorted. Go early.' },
  { name:'Ader Error Space',    city:'Seoul',     region:'Asia', lat:37.5560, lon:126.9230, tags:['street','minimal'], note:'Flagship of the Korean label. Worth seeing for the shop itself.' },

  // ---- Americas ----
  { name:'James Veloria',       city:'New York',  region:'Americas', lat:40.7160, lon:-73.9970, tags:['archive','y2k','avant'], note:'Archive designer pieces, chosen tightly. Manhattan. Ships.' },
  { name:'Procell',             city:'New York',  region:'Americas', lat:40.7190, lon:-73.9890, tags:['punk','street','y2k'], note:'Band shirts and subculture vintage, properly sourced.' },
  { name:'Front General Store', city:'New York',  region:'Americas', lat:40.7030, lon:-73.9900, tags:['workwear','denim','ivy'], note:'Dumbo. Japanese and American vintage, plus workwear.' },
  { name:'Wasteland',           city:'Los Angeles',region:'Americas',lat:34.0830, lon:-118.3720, tags:['y2k','punk','denim'], note:'Melrose. Big, sorted, always stocked.' },
  { name:'Departamento',        city:'Los Angeles',region:'Americas',lat:34.0640, lon:-118.2370, tags:['avant','minimal','street'], note:'Chinatown. Independent designers.' },
  { name:'Goodbye Folk',        city:'Mexico City',region:'Americas',lat:19.4160, lon:-99.1650, tags:['denim','y2k','workwear'], note:'Roma. Vintage, with a shoemaker at the back.' },

  // ---- Africa ----
  { name:'Alára',               city:'Lagos',     region:'Africa', lat:6.4370, lon:3.4350, tags:['afromodern','avant','tailoring'], note:'Concept store on Victoria Island, in a building by David Adjaye. African designers, high end.' },
  { name:'Katangua market',     city:'Lagos',     region:'Africa', lat:6.5270, lon:3.3200, tags:['y2k','denim','workwear'], note:'Very large second-hand market, and the far end of the global vintage trade. Bargain hard.' },
  { name:'Kofar Mata dye pits', city:'Kano',      region:'Africa', lat:12.0000, lon:8.5160, tags:['afromodern'], note:'Working indigo pits, centuries old. They sell cloth, not clothes. Take it to a tailor.' },
  { name:'Merchants on Long',   city:'Cape Town', region:'Africa', lat:-33.9220, lon:18.4180, tags:['afromodern','tailoring','minimal'], note:'A small selection of pan-African designers.' }
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
   You upload a photo, it shows, you tag it. The tagging is yours for now -
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

  /* The photograph. Downscaled in the browser first, both because the page
     shows it and because there is no point sending a 12 megapixel picture to
     a model that reads it at a fraction of that. */
  $('#photo').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    shrink(f, 1200, dataUrl => {
      $('#preview').innerHTML = `<img src="${dataUrl}" alt="the outfit you uploaded">`;
      $('#preview').classList.add('has-image');
    });
  });

  function shrink(file, max, cb) {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const scale = Math.min(1, max / Math.max(im.width, im.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(im.width * scale);
        cv.height = Math.round(im.height * scale);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL('image/jpeg', 0.85));
      };
      im.onerror = () => cb(r.result);
      im.src = r.result;
    };
    r.readAsDataURL(file);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* location. Real browser GPS; falls back to the region dropdown, which is
     also the only thing that works when the page is opened as a file:// */
  $('#locate').addEventListener('click', () => {
    const out = $('#locstatus');
    if (!navigator.geolocation){ out.textContent = 'This browser has no location. Use the region list.'; return; }
    out.textContent = 'asking…';
    navigator.geolocation.getCurrentPosition(
      pos => {
        here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        out.textContent = 'located. results now sort by nearest city';
        render();
      },
      err => {
        out.textContent = err.code === 1
          ? 'no problem. use the region list instead'
          : 'no fix (this needs the site served over http/https, not a file). Use the region list.';
      },
      { timeout: 8000 }
    );
  });

  $('#region').addEventListener('change', render);



  /* ---------- what you say you can see ----------
     Words to subgenres. No model, no key, nothing sent anywhere: the
     description is matched against the vocabulary below, in the browser.
     It only recognises what is listed here, which is why the matches are
     shown rather than silently applied. */
  const WORDS = {
    denim:      ['denim', 'jeans', 'jean', 'selvedge', 'selvage', 'indigo jeans', 'levi', 'trucker jacket'],
    tailoring:  ['suit', 'blazer', 'tailored', 'lapel', 'trouser', 'waistcoat', 'overcoat', 'pinstripe', 'bespoke'],
    workwear:   ['workwear', 'chore', 'moleskin', 'carhartt', 'dickies', 'duck canvas', 'boiler suit', 'coverall', 'bar tack', 'utility', 'overall'],
    street:     ['hoodie', 'sneaker', 'trainers', 'logo', 'graphic tee', 't-shirt', 'tshirt', 'cap', 'skate', 'streetwear', 'tracksuit'],
    gorp:       ['gore', 'goretex', 'shell jacket', 'fleece', 'technical', 'hiking', 'puffer', 'windbreaker', 'cagoule', 'arcteryx', 'patagonia'],
    afromodern: ['ankara', 'wax print', 'kente', 'adire', 'aso oke', 'asooke', 'indigo', 'kitenge', 'dashiki', 'boubou', 'strip weave'],
    archive:    ['raw edge', 'raw hem', 'unfinished', 'deconstructed', 'deconstruction', 'exposed seam', 'inside out', 'margiela', 'helmut lang', 'archive'],
    minimal:    ['minimal', 'plain', 'plainsurface', 'one colour', 'one color', 'undyed', 'jil sander', 'clean lines', 'unadorned'],
    y2k:        ['y2k', 'low rise', 'lowrise', 'rhinestone', 'butterfly', 'velour', 'baby tee', 'shiny', 'bedazzled', 'juicy'],
    punk:       ['safety pin', 'studs', 'studded', 'patched', 'patches', 'diy', 'ripped', 'torn', 'screen print', 'punk', 'tartan'],
    ivy:        ['oxford shirt', 'loafer', 'penny loafer', 'repp', 'prep', 'ivy', 'chino', 'varsity', 'letterman', 'argyle'],
    avant:      ['oversized', 'draped', 'drape', 'volume', 'asymmetric', 'yohji', 'comme des', 'rick owens', 'sculptural', 'voluminous']
  };

  function readDescription(){
    /* "no logos" is a statement about minimalism, not a mention of logos.
       Fold the negations into one token before matching so they cannot count
       as the thing they are denying. */
    const text = (' ' + ($('#describe').value || '').toLowerCase() + ' ')
      .replace(/\b(no|without|zero)\s+(logos?|branding|graphics?)\b/g, ' plainsurface ')
      .replace(/\bunbranded\b/g, ' plainsurface ');
    const out = $('#described');
    if (!text.trim()) {
      out.innerHTML = '<p class="caption">Write a line or two first.</p>';
      return;
    }

    const hits = {};
    Object.keys(WORDS).forEach(id => {
      WORDS[id].forEach(word => {
        if (text.indexOf(word) !== -1) {
          const list = hits[id] = hits[id] || [];
          // 'draped' already covers 'drape'; keep the longer word only
          if (!list.some(w => w.indexOf(word) !== -1)) list.push(word);
        }
      });
    });

    const found = Object.keys(hits);
    if (!found.length) {
      out.innerHTML = '<p class="caption">Nothing in that matched the vocabulary. ' +
        'Try naming the garment (jacket, jeans, suit), the cloth (denim, wool, wax print) ' +
        'or the finish (raw edges, logos, studs). Or answer the questions below.</p>';
      return;
    }

    found.forEach(id => {
      picked.add(id);
      const chip = $('#chips .chip[data-id="' + id + '"]');
      if (chip) chip.classList.add('on');
    });

    out.innerHTML = '<p class="caption">Matched: ' +
      found.map(id => '<b>' + ((subgenre(id) || {}).name || id) + '</b> (' +
        hits[id].map(w => w === 'plainsurface' ? 'no logos' : w).join(', ') + ')').join('; ') +
      '. Change any of them below.</p>';
    render();
  }

  /* ---------- the questions ----------
     Reading a photograph with a model costs money per picture and needs a
     key. This does the same job for nothing: four questions about what you
     can see, each answer voting for subgenres, the top three ticked. It is
     cruder than a model and honest about that, but for "which shops sell
     this" it is usually enough. */
  const QUESTIONS = [
    {
      q: 'What is the main piece?',
      a: [
        { label: 'a jacket or suit, tailored', tags: ['tailoring', 'ivy'] },
        { label: 'a work jacket or utility trousers', tags: ['workwear'] },
        { label: 'denim', tags: ['denim'] },
        { label: 'a t-shirt, hoodie or sneakers', tags: ['street'] },
        { label: 'a shell, fleece or technical piece', tags: ['gorp'] },
        { label: 'a dress, skirt or knitwear', tags: ['minimal', 'tailoring'] }
      ]
    },
    {
      q: 'How does it sit on the body?',
      a: [
        { label: 'close and structured', tags: ['tailoring'] },
        { label: 'oversized, draped, volume away from the body', tags: ['avant'] },
        { label: 'tight, low on the hips, shiny', tags: ['y2k'] },
        { label: 'boxy and practical', tags: ['workwear', 'gorp'] }
      ]
    },
    {
      q: 'What is the surface like?',
      a: [
        { label: 'one flat colour, no decoration', tags: ['minimal'] },
        { label: 'raw edges, exposed seams, unfinished on purpose', tags: ['archive'] },
        { label: 'wax print, strip weave, indigo', tags: ['afromodern'] },
        { label: 'cut up, pinned, patched, hand printed', tags: ['punk'] },
        { label: 'logos or graphics', tags: ['street', 'y2k'] },
        { label: 'worn in, faded, repaired', tags: ['denim', 'workwear'] }
      ]
    },
    {
      q: 'What era does it look like?',
      a: [
        { label: 'before 1960', tags: ['tailoring', 'workwear'] },
        { label: '1960s or 1970s', tags: ['ivy', 'punk'] },
        { label: '1980s or 1990s', tags: ['archive', 'minimal'] },
        { label: 'around 2000', tags: ['y2k'] },
        { label: 'now', tags: ['street', 'gorp'] }
      ]
    }
  ];

  function buildQuestions(){
    const host = $('#questions');
    if (!host) return;
    host.innerHTML = QUESTIONS.map((row, i) =>
      '<div class="qrow"><p class="qq">' + row.q + '</p>' +
      row.a.map((ans, j) =>
        '<button type="button" class="chip q" data-row="' + i + '" data-ans="' + j + '">' + ans.label + '</button>'
      ).join('') + '</div>'
    ).join('');

    const answers = {};
    host.addEventListener('click', e => {
      const b = e.target.closest('.chip.q');
      if (!b) return;
      const row = Number(b.dataset.row);
      host.querySelectorAll('.chip.q[data-row="' + row + '"]').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      answers[row] = Number(b.dataset.ans);

      const votes = {};
      Object.keys(answers).forEach(r => {
        QUESTIONS[r].a[answers[r]].tags.forEach(t => { votes[t] = (votes[t] || 0) + 1; });
      });

      picked = new Set(Object.keys(votes).sort((x, y) => votes[y] - votes[x]).slice(0, 3));
      $$('#chips .chip').forEach(c => c.classList.toggle('on', picked.has(c.dataset.id)));
      render();
    });
  }

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

  buildQuestions();
  const describeBtn = $('#readdesc');
  if (describeBtn) describeBtn.addEventListener('click', readDescription);
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
   6. THREADLE. The fashion word game. Five letters, six guesses, one word a
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
        : `<b>out of guesses. it was ${answer}.</b> come back tomorrow.`;
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
   Your picture, your fits, your subgenres. All of it local to this browser -
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
      $('#savestate').textContent = 'could not save. this browser is blocking storage';
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
      : '<p class="caption">Nothing here yet. Add a fit below, a whole outfit or one garment.</p>';
  }

  /* read a file as a data URL, downscaled. Full-size photos fill localStorage
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
