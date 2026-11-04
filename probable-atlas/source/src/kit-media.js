/* Probable · media kit, shared by Probable Atlas and the Sports Lab on the web and in the apps.
   - MEDIA.photo(id): responsive photography (AVIF with a WebP fallback, several widths) with a blurred placeholder
     painted at once, so nothing shifts or flashes while the full image loads.
   - MEDIA.art(name): pre-rendered 3D objects (transparent AVIF/WebP), one per Atlas module.
   - MEDIA.icon(name): a lightweight inline SVG icon set (modules and sports), drawn with currentColor.
   Photo sizes, colours, alt text and credits come from PHOTO_META, generated from assets/photos/photos.json. */
const MEDIA = (() => {
  const META = typeof PHOTO_META !== 'undefined' ? PHOTO_META : {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pbase = () => window.PROBABLE_PHOTOS_URL || '/assets/photos/';
  const rbase = () => window.PROBABLE_RENDERS_URL || '/assets/renders/';
  const avif = () => (window.PROBABLE_MEDIA_FORMATS || ['avif', 'webp']).includes('avif');

  /* a <picture> for photo `id`. o: cls, sizes (CSS sizes), alt ('' = decorative), eager (the page's main image),
     pos (object-position), widths (subset of the available widths) */
  function photo(id, o = {}) {
    const m = META[id]; if (!m) return '';
    // widths: the sizes up to the largest one asked for, plus the next size up so sharp screens stay sharp
    const cap = o.widths ? Math.max(...o.widths) : Infinity, ws = m.sizes.filter(w => w <= cap), up = m.sizes.find(w => w > cap);
    if (up && ws.length < 2) ws.push(up);
    if (!ws.length) ws.push(m.sizes[0]);
    const set = f => ws.map(w => `${pbase()}${id}-${w}.${f} ${Math.min(w, m.w)}w`).join(', ');
    const sizes = o.sizes || '100vw', pos = o.pos || '50% 50%', alt = o.alt != null ? o.alt : (m.alt || '');
    const fb = `${pbase()}${id}-${ws[Math.min(1, ws.length - 1)]}.webp`;
    // the blurred placeholder sits on the <picture>, so the photo can fade in over it
    const ph = `background:${m.color || '#111'} url(${m.lqip}) ${pos}/cover no-repeat`;
    return `<picture class="mx-pic ${o.cls || ''}" style="${ph}"${o.alt === '' ? ' aria-hidden="true"' : ''}>${avif() ? `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">` : ''}`
      + `<img src="${fb}" srcset="${set('webp')}" sizes="${sizes}" width="${m.w}" height="${m.h}" alt="${esc(alt)}" decoding="async" ${o.eager ? 'fetchpriority="high"' : 'loading="lazy"'} style="object-position:${pos}" onload="this.classList.add('mx-in')"></picture>`;
  }
  /* a pre-rendered 3D object (512 and 256 px) */
  function art(name, o = {}) {
    const set = f => `${rbase()}${name}-256.${f} 256w, ${rbase()}${name}-512.${f} 512w`, sizes = o.sizes || '180px';
    return `<picture class="mx-art ${o.cls || ''}" aria-hidden="true">${avif() ? `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">` : ''}`
      + `<img src="${rbase()}${name}-256.webp" srcset="${set('webp')}" sizes="${sizes}" width="512" height="512" alt="" decoding="async" ${o.eager ? '' : 'loading="lazy"'} onload="this.classList.add('mx-in')"></picture>`;
  }

  /* 24px line icons */
  const I = {
    econ: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z"/>',
    fin: '<path d="M4 20.5h16"/><rect x="5" y="13" width="3" height="5" rx="1"/><rect x="10.5" y="9" width="3" height="9" rx="1"/><rect x="16" y="5" width="3" height="13" rx="1"/>',
    comm: '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M10 4l2 5 2-5M8.5 9 12 20l3.5-11"/>',
    wx: '<path d="M8 19h9a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.3 12.3 3.4 3.4 0 0 0 8 19z"/><path d="M15.5 3.5v1.4M20 5.6l-1 1M21.5 10h-1.4"/>',
    ag: '<path d="M12 21v-8"/><path d="M12 13c0-4.4 2.9-7.5 8-7.5 0 4.4-2.9 7.5-8 7.5z"/><path d="M12 15.5c0-3.6-2.4-6-6.5-6 0 3.6 2.4 6 6.5 6z"/><path d="M8 21h8"/>',
    hunger: '<path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z"/><path d="M8 3.5c-.8.9-.8 2.1 0 3M12 3.5c-.8.9-.8 2.1 0 3M16 3.5c-.8.9-.8 2.1 0 3"/>',
    wealth: '<ellipse cx="9" cy="6.5" rx="5.5" ry="2.5"/><path d="M3.5 6.5v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4"/><path d="M3.5 10.5v4c0 1.4 2.5 2.5 5.5 2.5"/><ellipse cx="15.5" cy="14" rx="5" ry="2.3"/><path d="M10.5 14v3.8c0 1.3 2.2 2.3 5 2.3s5-1 5-2.3V14"/>',
    tech: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3"/>',
    conflict: '<path d="M12 3l7.5 3v5.6c0 4.5-3.1 8.2-7.5 9.4-4.4-1.2-7.5-4.9-7.5-9.4V6z"/><path d="M12 8.2l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/>',
    pol: '<path d="M4 11.5h16v8.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M7.5 11.5V4a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v7.5"/><path d="M10 7.5l1.5 1.5 3-3"/><path d="M4 15.5h16"/>',
    health: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8v8M8 12h8"/>',
    pulse: '<circle cx="12" cy="12" r="9"/><path d="M5 12h3.2l1.6-3.6 2.8 7.2 1.6-3.6H19"/>',
    football: '<ellipse cx="12" cy="12" rx="9.6" ry="5.6" transform="rotate(-38 12 12)"/><path d="M9.2 14.8l5.6-5.6M10.1 12.3l1.6 1.6M11.2 11.2l1.6 1.6M12.3 10.1l1.6 1.6"/>',
    basketball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18"/><path d="M5.7 5.6a12.5 12.5 0 0 1 0 12.8M18.3 5.6a12.5 12.5 0 0 0 0 12.8"/>',
    baseball: '<circle cx="12" cy="12" r="9"/><path d="M6.3 5a11 11 0 0 1 0 14M17.7 5a11 11 0 0 0 0 14"/><path d="M7.4 8.3l1.4-.4M7.9 11.3h1.5M7.4 14.3l1.4.4M16.6 8.3l-1.4-.4M16.1 11.3h-1.5M16.6 14.3l-1.4.4"/>',
    hockey: '<path d="M14.5 3l-4.2 12.4a2 2 0 0 1-1.9 1.4H4.5v2.7h5.1a3 3 0 0 0 2.8-2L17 3"/><ellipse cx="17.5" cy="18" rx="3.5" ry="1.5"/><path d="M14 18v1.2c0 .8 1.6 1.5 3.5 1.5s3.5-.7 3.5-1.5V18"/>',
    soccer: '<circle cx="12" cy="12" r="9"/><path d="M12 7.6l3.6 2.6-1.4 4.3H9.8l-1.4-4.3z"/><path d="M12 3v4.6M15.6 10.2l4.3-1.4M14.2 14.5l2.7 3.7M9.8 14.5l-2.7 3.7M8.4 10.2L4.1 8.8"/>',
    tennis: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6a9 9 0 0 1 0 12.8M18.4 5.6a9 9 0 0 0 0 12.8"/>',
    golf: '<path d="M7 21V3.5"/><path d="M7 4l9 3.5L7 11"/><path d="M3.5 21h8"/><circle cx="17.5" cy="18" r="2.5"/>',
    mma: '<path d="M8 12V7.5A4.5 4.5 0 0 1 12.5 3h1A4.5 4.5 0 0 1 18 7.5V13a4.5 4.5 0 0 1-4.5 4.5H11"/><path d="M8 10.5a2.6 2.6 0 0 0 0 5.2h3"/><path d="M8 17.5h9v3.5H8z"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
    bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  const icon = (name, cls) => I[name] ? `<svg class="mx-ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${I[name]}</svg>` : '';

  /* photo credits, for the How it works sections */
  const credits = ids => ids.filter(id => META[id]).map(id => { const m = META[id]; return `<li>${esc(m.alt)}: <a href="${esc(m.link)}" target="_blank" rel="noopener">${esc(m.credit)}</a> (${esc(m.license)})</li>`; }).join('');
  return { photo, art, icon, credits, meta: META, has: id => !!META[id] };
})();
window.MEDIA = MEDIA;
