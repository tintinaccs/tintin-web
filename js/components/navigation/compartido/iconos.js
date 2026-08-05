export const CATEGORY_ICONS = Object.freeze({
  bolsos: '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>',
  collares: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="4" x2="12" y2="9"/>',
  earcuff: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0116 0z"/><circle cx="12" cy="10" r="3"/>',
  gafas: '<circle cx="7" cy="14" r="4"/><circle cx="17" cy="14" r="4"/><path d="M11 14h2m-8.5-4l-1-4h18l-1 4"/>',
  brazaletes: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
  aros: '<circle cx="12" cy="8" r="5"/><path d="M9.5 12.5l-3 7a2 2 0 004 0v-1"/><path d="M14.5 12.5l3 7a2 2 0 01-4 0v-1"/>',
  armcuff: '<path d="M5 12h14M5 8h14M5 16h14"/><rect x="2" y="6" width="20" height="12" rx="3"/>',
  anillos: '<circle cx="12" cy="14" r="6"/><path d="M12 8V2m-4 2l4 4 4-4"/>',
  joyeros: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M3 10h18M8 8V5a4 4 0 018 0v3"/>',
  pulseras: '<path d="M4 8h16M4 16h16"/><path d="M8 4v16M16 4v16" opacity=".4"/><rect x="2" y="6" width="20" height="12" rx="3"/>',
  relojes: '<circle cx="12" cy="12" r="7"/><polyline points="12 9 12 12 13.5 13.5"/><path d="M16.51 17.35l-.35 3.83a2 2 0 01-1.99 1.82H9.83a2 2 0 01-1.99-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 019.83 1h4.35a2 2 0 011.99 1.82l.35 3.83"/>',
  tobilleras: '<path d="M12 22a10 10 0 01-7.07-3A9.94 9.94 0 012 12"/><path d="M22 12a9.94 9.94 0 01-2.93 7M12 2a10 10 0 0110 10"/><circle cx="12" cy="12" r="4"/>',
});

export const CATEGORIES = Object.freeze([
  Object.freeze({ slug: 'bolsos', label: 'Bolsos', legacyLabel: 'Bags', background: 'linear-gradient(135deg,#e8c5d0,#c48a9e)' }),
  Object.freeze({ slug: 'collares', label: 'Collares', background: 'linear-gradient(135deg,#d4b0c0,#a87090)' }),
  Object.freeze({ slug: 'earcuff', label: 'Earcuff', background: 'linear-gradient(135deg,#f0d0e0,#d090a8)' }),
  Object.freeze({ slug: 'gafas', label: 'Gafas', background: 'linear-gradient(135deg,#e8c0d0,#c88098)' }),
  Object.freeze({ slug: 'brazaletes', label: 'Brazaletes', background: 'linear-gradient(135deg,#c8a0b8,#a06080)' }),
  Object.freeze({ slug: 'aros', label: 'Aros', background: 'linear-gradient(135deg,#f0c8d8,#d48098)' }),
  Object.freeze({ slug: 'armcuff', label: 'Armcuff', background: 'linear-gradient(135deg,#c8b0cc,#9870a0)' }),
  Object.freeze({ slug: 'anillos', label: 'Anillos', background: 'linear-gradient(135deg,#dca8c0,#b06880)' }),
  Object.freeze({ slug: 'joyeros', label: 'Joyeros', background: 'linear-gradient(135deg,#c0a0b8,#906080)' }),
  Object.freeze({ slug: 'pulseras', label: 'Pulseras', background: 'linear-gradient(135deg,#e0b8c8,#c07888)' }),
  Object.freeze({ slug: 'relojes', label: 'Relojes', background: 'linear-gradient(135deg,#b8849a,#8b5070)' }),
  Object.freeze({ slug: 'tobilleras', label: 'Tobilleras', background: 'linear-gradient(135deg,#d8a8c0,#b06888)' }),
]);

export function svgIcon(paths, { size = 20, stroke = 'currentColor', className = '' } = {}) {
  const classAttribute = className ? ` class="${className}"` : '';
  return `<svg${classAttribute} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export function categoryIcon(name, options = {}) {
  return svgIcon(CATEGORY_ICONS[name] || CATEGORY_ICONS.joyeros, options);
}

export const UI_ICONS = Object.freeze({
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  account: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  bag: '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  storefront: '<path d="M3 9l1.5-5h15L21 9"/><path d="M5 13v8h14v-8"/><path d="M9 21v-6h6v6"/><path d="M3 9c0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
});
