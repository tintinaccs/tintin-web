/**
 * site-config.js
 * Loads site content configuration from Firestore and applies it to the DOM.
 * Each page calls applySiteConfig(pageId) which fetches site_content/{pageId}
 * and updates DOM elements according to the selectors map defined below.
 */

import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/** Load config for a given page from Firestore. Returns {} if not found. */
export async function loadSiteConfig(pageId) {
  try {
    const snap = await getDoc(doc(db, "site_content", pageId));
    return snap.exists() ? snap.data() : {};
  } catch (e) {
    console.warn("[site-config] Error loading config:", e);
    return {};
  }
}

/**
 * Apply config values to DOM elements.
 * @param {string} selector - CSS selector
 * @param {string|null} value - value to apply (skips if null/undefined/'')
 * @param {"text"|"src"|"href"|"html"} attr - what to set
 */
function apply(selector, value, attr = "text") {
  if (value == null || value === "") return;
  const els = document.querySelectorAll(selector);
  els.forEach(el => {
    if (attr === "text")  el.textContent = value;
    if (attr === "html")  el.innerHTML   = value;
    if (attr === "src")   el.src         = value;
    if (attr === "href")  el.href        = value;
  });
}

// ─── INDEX PAGE ────────────────────────────────────────────────────────────
export async function applyIndexConfig() {
  const cfg = await loadSiteConfig("index");

  // Hero
  const h = cfg.hero ?? {};
  apply(".tt-hero-split-eyebrow .tt-hero-split-dash + *", h.eyebrow, "text");
  // eyebrow has a span.dash then text node — use innerHTML approach
  const eyebrow = document.querySelector(".tt-hero-split-eyebrow");
  if (eyebrow && h.eyebrow) {
    const dash = eyebrow.querySelector(".tt-hero-split-dash");
    eyebrow.innerHTML = "";
    if (dash) eyebrow.appendChild(dash);
    eyebrow.append(" " + h.eyebrow);
  }
  apply(".tt-hero-split-title", h.title, "text");
  apply(".tt-hero-split-sub", h.subtitle, "text");
  const heroBtn = document.querySelector(".tt-hero-split-btn");
  if (heroBtn) {
    if (h.btnText) heroBtn.textContent = h.btnText;
    if (h.btnHref) heroBtn.href = h.btnHref;
  }
  const heroImg = document.querySelector(".tt-hero-split-right img");
  if (heroImg) {
    if (h.image)    heroImg.src = h.image;
    if (h.imageAlt) heroImg.alt = h.imageAlt;
  }

  // Trust bar
  const t = cfg.trust ?? {};
  if (t.items && Array.isArray(t.items)) {
    const trustItems = document.querySelectorAll(".tt-trust-item");
    t.items.forEach((item, i) => {
      if (!trustItems[i]) return;
      const label = trustItems[i].querySelector(".tt-trust-label");
      const desc  = trustItems[i].querySelector(".tt-trust-desc");
      if (label && item.label) label.textContent = item.label;
      if (desc  && item.desc)  desc.textContent  = item.desc;
    });
  }

  // Editorial — Bags
  const eb = cfg.editorial_bag ?? {};
  const editorialEls = document.querySelectorAll(".tt-editorial");
  if (editorialEls[0]) {
    const el = editorialEls[0];
    applyToEditorial(el, eb);
  }

  // Editorial — Relojes
  const er = cfg.editorial_relojes ?? {};
  if (editorialEls[1]) {
    applyToEditorial(editorialEls[1], er);
  }

  // CTA Final
  const c = cfg.cta ?? {};
  const ctaEl = document.querySelector(".tt-cta-final");
  if (ctaEl) {
    const eyebrow = ctaEl.querySelector(".tt-section-eyebrow");
    const title   = ctaEl.querySelector(".tt-cta-title");
    const sub     = ctaEl.querySelector(".tt-cta-sub");
    const btn1    = ctaEl.querySelector(".tt-btn:first-of-type");
    if (eyebrow && c.eyebrow) eyebrow.textContent = c.eyebrow;
    if (title   && c.title)   title.textContent   = c.title;
    if (sub     && c.sub)     sub.textContent     = c.sub;
    if (btn1    && c.btn1Text) btn1.textContent   = c.btn1Text;
    if (btn1    && c.btn1Href) btn1.href          = c.btn1Href;
  }

  // Footer
  const f = cfg.footer ?? {};
  const footerLogoImg = document.querySelector(".tt-footer-logo-img");
  if (footerLogoImg && f.logo) footerLogoImg.src = f.logo;
  const footerCopy = document.querySelector(".tt-footer-copy");
  if (footerCopy && f.copy) footerCopy.innerHTML = f.copy.replace(/\n/g, "<br>");
  const footerWa = document.querySelector(".tt-footer-wa");
  if (footerWa) {
    if (f.waText) footerWa.textContent = f.waText;
    if (f.waHref) footerWa.href = `https://wa.me/${f.waHref}?text=Hola%21%20Me%20interesa%20saber%20m%C3%A1s%20sobre%20sus%20productos%20%F0%9F%8C%B8`;
  }
}

function applyToEditorial(el, cfg) {
  const eyebrow = el.querySelector(".tt-editorial-eyebrow");
  const title   = el.querySelector(".tt-editorial-title");
  const body    = el.querySelector(".tt-editorial-body");
  const btn     = el.querySelector(".tt-btn");
  const img     = el.querySelector("img");
  if (eyebrow && cfg.eyebrow) eyebrow.textContent = cfg.eyebrow;
  if (title   && cfg.title)   title.innerHTML     = cfg.title.replace(/\n/g, "<br>");
  if (body    && cfg.body)    body.textContent    = cfg.body;
  if (btn     && cfg.btnText) btn.textContent     = cfg.btnText;
  if (btn     && cfg.btnHref) btn.href            = cfg.btnHref;
  if (img     && cfg.image)   img.src             = cfg.image;
}

// ─── NOSOTROS PAGE ─────────────────────────────────────────────────────────
export async function applyNosotrosConfig() {
  const cfg = await loadSiteConfig("nosotros");

  // Hero Nosotros
  const h = cfg.hero ?? {};
  apply(".ta-eyebrow", h.eyebrow, "text");
  apply(".ta-title",   h.title,   "text");
  apply(".ta-desc",    h.desc,    "text");

  const points = document.querySelectorAll(".ta-point .ta-point-text");
  if (h.point1 && points[0]) points[0].textContent = h.point1;
  if (h.point2 && points[1]) points[1].textContent = h.point2;
  if (h.point3 && points[2]) points[2].textContent = h.point3;

  const btn = document.querySelector(".ta-btn");
  if (btn) {
    if (h.btnText) btn.textContent = h.btnText;
    if (h.btnHref) btn.href        = h.btnHref;
  }

  const imgDesktop = document.querySelector(".ta-img-desktop");
  const imgTablet  = document.querySelector(".ta-img-tablet");
  const imgMobile  = document.querySelector(".ta-img-mobile");
  if (imgDesktop && h.image_desktop) imgDesktop.src = h.image_desktop;
  if (imgTablet  && h.image_tablet)  imgTablet.src  = h.image_tablet;
  if (imgMobile  && h.image_mobile)  imgMobile.src  = h.image_mobile;

  // Historia section
  const hi = cfg.historia ?? {};
  const historiaEl = document.querySelector(".ta-historia");
  if (historiaEl) {
    const eyebrow = historiaEl.querySelector(".ta-section-eyebrow, .tt-section-eyebrow");
    const title   = historiaEl.querySelector(".ta-section-title, .tt-section-title");
    const img     = historiaEl.querySelector("img");
    if (eyebrow && hi.eyebrow) eyebrow.textContent = hi.eyebrow;
    if (title   && hi.title)   title.textContent   = hi.title;
    if (img     && hi.image)   img.src             = hi.image;

    // Paragraphs
    const ps = historiaEl.querySelectorAll("p.ta-p, p.ta-historia-p");
    if (hi.p1 && ps[0]) ps[0].textContent = hi.p1;
    if (hi.p2 && ps[1]) ps[1].textContent = hi.p2;
  }
}
