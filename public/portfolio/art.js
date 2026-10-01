/* Portfolio. The drawings.

   Every flower, swirl, star and background on the site is drawn here as SVG,
   so there are no image files to lose and everything stays sharp at any size.
   Each function returns a string of SVG markup. The colours are read off the
   two reference screenshots (the 2006 DVD mini-sites). */

window.ART = (function () {
  const r1 = n => Math.round(n * 10) / 10;
  /* A shade of one of the site colours (see "site colors" in edit mode). */
  const mix = (v, pct, other) => `color-mix(in srgb, var(${v}) ${pct}%, ${other})`;

  /* An Archimedean spiral, the swirl in the corners and on the frame. */
  function spiralPath(cx, cy, size, turns) {
    turns = turns || 3.2;
    const steps = Math.round(turns * 28);
    const max = turns * Math.PI * 2;
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * max;
      const r = (t / max) * size;
      const x = cx + r * Math.cos(t), y = cy + r * Math.sin(t);
      d += (i ? 'L' : 'M') + r1(x) + ' ' + r1(y);
    }
    return d;
  }

  function swirl(cx, cy, size, color, width, turns) {
    return `<path d="${spiralPath(cx, cy, size, turns)}" fill="none" stroke="${color}" stroke-width="${width || 10}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  /* A cartoon daisy: rounded petals with a lighter edge, a round centre. */
  function flower(cx, cy, size, petal, edge, centre, opts) {
    opts = opts || {};
    const n = opts.petals || 8;
    const rot = opts.rotate || 0;
    let s = `<g transform="rotate(${rot} ${cx} ${cy})">`;
    for (let i = 0; i < n; i++) {
      const a = (360 / n) * i;
      s += `<ellipse cx="${cx}" cy="${r1(cy - size * 0.58)}" rx="${r1(size * 0.3)}" ry="${r1(size * 0.46)}"
              style="fill:${petal};stroke:${edge}" stroke-width="${r1(size * 0.05)}" transform="rotate(${a} ${cx} ${cy})"/>`;
    }
    s += `<circle cx="${cx}" cy="${cy}" r="${r1(size * 0.42)}" style="fill:${centre}"/>`;
    s += '</g>';
    return s;
  }

  /* A five point star. inner is the ratio of the notch to the tip. */
  function starPoints(cx, cy, r, inner, rot) {
    inner = inner || 0.48;
    rot = rot || 0;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2 + (rot * Math.PI) / 180;
      const rr = i % 2 ? r * inner : r;
      pts.push(r1(cx + rr * Math.cos(a)) + ',' + r1(cy + rr * Math.sin(a)));
    }
    return pts.join(' ');
  }

  function star(cx, cy, r, fill, opts) {
    opts = opts || {};
    const stroke = opts.stroke ? ` stroke="${opts.stroke}" stroke-width="${opts.width || 4}" stroke-linejoin="round"` : '';
    return `<polygon points="${starPoints(cx, cy, r, opts.inner, opts.rotate)}" style="fill:${fill}"${stroke}${opts.opacity ? ` opacity="${opts.opacity}"` : ''}/>`;
  }

  /* The four point twinkle beside each menu item. */
  function sparkle(size, color) {
    const c = size / 2, l = size / 2, w = size * 0.09;
    return `<svg class="sparkle" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <defs><radialGradient id="sg${size}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
      <circle cx="${c}" cy="${c}" r="${size * 0.32}" fill="url(#sg${size})" opacity=".8"/>
      <path d="M${c} ${c - l} L${c + w} ${c - w} L${c + l} ${c} L${c + w} ${c + w} L${c} ${c + l} L${c - w} ${c + w} L${c - l} ${c} L${c - w} ${c - w}Z" fill="${color || '#fff'}"/>
      <path d="M${c} ${c - l * 0.6} L${c + w * 0.7} ${c} L${c} ${c + l * 0.6} L${c - w * 0.7} ${c}Z" fill="#fff" transform="rotate(45 ${c} ${c})"/>
    </svg>`;
  }

  /* The little faceted jewel beside each item on the inside pages. */
  function gem(size) {
    return `<svg class="gem" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="20" cy="20" r="14" fill="#fff" opacity=".55"/>
      <polygon points="20,6 31,15 27,31 13,31 9,15" fill="#e9e3f2" stroke="#9c8fb4" stroke-width="1.5"/>
      <polygon points="20,6 24,15 20,31 16,15" fill="#fff"/>
      <polygon points="9,15 31,15 24,15 20,6 16,15" fill="#d2c8e4"/>
      <path d="M2 20h7M31 20h7M20 0v6M20 34v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }

  /* ---------- the homepage: lavender, a pink wavy panel, flowers ---------- */
  function homeBackground(w, h) {
    const panelOuter = `M24 70 C 300 40, 700 52, 1176 34 L 1180 690 C 1010 700, 930 760, 760 748 C 560 735, 430 790, 300 770 C 190 752, 90 790, 22 800 Z`;
    const panelInner = `M44 88 C 320 60, 700 72, 1158 54 L 1160 672 C 1000 682, 925 738, 760 728 C 560 715, 430 770, 300 750 C 190 732, 100 768, 42 778 Z`;
    let s = `<svg class="bg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <defs>
        <linearGradient id="lav" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${mix('--lavender', 80, '#fff')}"/><stop offset=".7" style="stop-color:var(--lavender)"/><stop offset="1" style="stop-color:${mix('--lavender', 92, '#000')}"/></linearGradient>
        <linearGradient id="pinkpanel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:${mix('--pink-panel', 85, '#000')}"/><stop offset=".45" style="stop-color:var(--pink-panel)"/><stop offset="1" style="stop-color:${mix('--pink-panel', 85, '#fff')}"/></linearGradient>
        <radialGradient id="glowp" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#f6a3cf" stop-opacity=".55"/><stop offset="1" stop-color="#f6a3cf" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#lav)"/>`;
    /* lavender swirls under the panel, lower left and right */
    s += `<g opacity=".55">${swirl(70, 900, 70, '#e9d3f3', 13)}${swirl(215, 960, 60, '#e9d3f3', 12)}${swirl(1080, 960, 55, '#e9d3f3', 11)}${swirl(1160, 520, 60, '#f1c6e3', 11)}</g>`;
    s += `<path d="${panelOuter}" style="fill:${mix('--pink-panel', 35, '#fff')}"/>`;
    s += `<path d="${panelInner}" fill="url(#pinkpanel)"/>`;
    s += `<path d="${panelInner}" fill="url(#glowp)"/>`;
    /* faint lighter leaves and swirls printed on the pink */
    s += `<g opacity=".18" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round">
        <path d="M470 680 c 30 -40, 70 -40, 90 0 c -30 30, -60 30, -90 0z"/>
        <path d="M510 640 c 0 -40, 30 -60, 60 -60"/>
        <path d="${spiralPath(560, 580, 34, 2.4)}"/>
      </g>`;
    /* the swirl that runs up the right edge behind the frame */
    s += `<g opacity=".35">${swirl(1130, 410, 46, '#f9c6e4', 9)}${swirl(1140, 240, 40, '#f9c6e4', 9)}</g>`;
    /* the big pink flower top right (the sound button sits on it) */
    s += flower(1095, 45, 120, mix('--flower-pink', 85, '#fff'), mix('--flower-pink', 55, '#fff'), mix('--flower-pink', 85, '#fff'), { petals: 6, rotate: 12 });
    /* lower left: pink flower, purple centre */
    s += flower(132, 708, 150, 'var(--flower-pink)', mix('--flower-pink', 60, '#fff'), '#9a72c9', { petals: 8, rotate: 6 });
    /* right: yellow flower, the magenta centre holds a link */
    s += flower(1062, 708, 175, 'var(--flower-yellow)', mix('--flower-yellow', 60, '#fff'), '#c03a86', { petals: 8, rotate: 18 });
    s += `</svg>`;
    return s;
  }

  /* ---------- the inside pages: pink, big stars, a yellow wave ---------- */
  function insideBackground(w, h) {
    let s = `<svg class="bg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <defs>
        <linearGradient id="pk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:${mix('--inside-pink', 70, '#fff')}"/><stop offset=".5" style="stop-color:var(--inside-pink)"/><stop offset="1" style="stop-color:${mix('--inside-pink', 88, '#c0287a')}"/></linearGradient>
        <linearGradient id="yl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${mix('--wave', 55, '#fff')}"/><stop offset="1" style="stop-color:var(--wave)"/></linearGradient>
        <linearGradient id="bigstar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:${mix('--big-stars', 70, '#fff')}"/><stop offset="1" style="stop-color:var(--big-stars)"/></linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#pk)"/>`;
    s += star(640, 330, 330, 'url(#bigstar)', { rotate: -8, inner: .45, opacity: .55 });
    s += star(1010, 760, 250, 'url(#bigstar)', { rotate: 14, inner: .45, opacity: .8 });
    s += star(120, 520, 200, mix('--big-stars', 50, '#fff'), { rotate: -20, inner: .45, opacity: .6 });
    [[380, 200, 26], [520, 260, 20], [860, 180, 30], [790, 150, 16], [310, 240, 18], [890, 290, 22], [700, 240, 14], [995, 255, 20]].forEach(([x, y, r]) => {
      s += star(x, y, r, '#fff', { opacity: .9 });
    });
    /* the yellow wave along the bottom, with its white ribbon */
    s += `<path d="M0 ${h - 250} C 220 ${h - 300}, 470 ${h - 205}, 720 ${h - 255} C 920 ${h - 295}, 1060 ${h - 340}, ${w} ${h - 315} L ${w} ${h} L 0 ${h} Z" fill="url(#yl)"/>`;
    s += `<path d="M0 ${h - 262} C 220 ${h - 312}, 470 ${h - 217}, 720 ${h - 267} C 920 ${h - 307}, 1060 ${h - 352}, ${w} ${h - 327}" fill="none" stroke="#fff" stroke-width="12"/>`;
    s += `<path d="M0 ${h - 276} C 220 ${h - 326}, 470 ${h - 231}, 720 ${h - 281} C 920 ${h - 321}, 1060 ${h - 366}, ${w} ${h - 341}" fill="none" stroke="#f48cc3" stroke-width="5" opacity=".7"/>`;
    s += `</svg>`;
    return s;
  }

  /* The swirl pattern pressed into the picture frame, as a CSS background. */
  function frameSwirls() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <path d="${spiralPath(48, 48, 22, 2.6)}" fill="none" stroke="#c4568e" stroke-width="4" stroke-linecap="round"/>
      <rect x="20" y="20" width="56" height="56" rx="6" fill="none" stroke="#b6467e" stroke-width="3" opacity=".6"/>
    </svg>`;
    /* single quotes: this ends up inside a double-quoted style attribute */
    return "url('data:image/svg+xml," + encodeURIComponent(svg) + "')";
  }

  /* The click-wheel star on the phone, and the burst behind Book Me. */
  function smallStar(size, fill, stroke) {
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${star(50, 52, 46, fill, { stroke: stroke || '#fff', width: 5, inner: .46, rotate: 10 })}</svg>`;
  }

  return { homeBackground, insideBackground, flower, swirl, star, sparkle, gem, frameSwirls, smallStar };
})();
