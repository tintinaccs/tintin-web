/* Tintin — rail colapsable del Super Panel Admin.
   Script clásico externo: aplica la preferencia antes del primer pintado y
   enlaza la interacción cuando el DOM está listo. No toca Auth ni permisos. */
(function () {
  'use strict';

  var STORAGE_KEY = 'tintin:admin:sidebar-state:v1';
  var MIN_RAIL_WIDTH = 541;
  var TABLET_MAX_WIDTH = 900;
  var TOOLTIP_ID = 'adm-sidebar-tooltip';
  var STATE_EXPANDED = 'expanded';
  var STATE_COLLAPSED = 'collapsed';
  var root = document.documentElement;
  var hasManualPreference = false;
  var closeTimer = 0;

  function readStoredState() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      return value === STATE_EXPANDED || value === STATE_COLLAPSED ? value : '';
    } catch (_) {
      return '';
    }
  }

  function writeStoredState(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
      hasManualPreference = true;
    } catch (_) {
      hasManualPreference = true;
    }
  }

  function defaultState() {
    return window.matchMedia(
      '(min-width: ' + MIN_RAIL_WIDTH + 'px) and (max-width: ' + TABLET_MAX_WIDTH + 'px)'
    ).matches ? STATE_COLLAPSED : STATE_EXPANDED;
  }

  function currentState() {
    return root.dataset.admSidebar === STATE_COLLAPSED ? STATE_COLLAPSED : STATE_EXPANDED;
  }

  function applyState(value, persist) {
    var state = value === STATE_COLLAPSED ? STATE_COLLAPSED : STATE_EXPANDED;
    root.dataset.admSidebar = state;
    if (persist) writeStoredState(state);

    var toggle = document.getElementById('adm-sidebar-rail-toggle');
    if (toggle) {
      var expanded = state === STATE_EXPANDED;
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.setAttribute('aria-label', expanded ? 'Contraer barra lateral' : 'Expandir barra lateral');
      toggle.setAttribute('title', expanded ? 'Contraer barra lateral' : 'Expandir barra lateral');
      toggle.dataset.state = state;
    }

    if (state !== STATE_COLLAPSED) hideTooltip();
  }

  var initialState = readStoredState();
  hasManualPreference = Boolean(initialState);
  applyState(initialState || defaultState(), false);

  function isRailViewport() {
    return window.innerWidth >= MIN_RAIL_WIDTH;
  }

  function isCollapsedRail() {
    return isRailViewport() && currentState() === STATE_COLLAPSED;
  }

  function normalizeLabel(item) {
    var explicit = item.getAttribute('aria-label');
    if (explicit) return explicit.trim();

    var clone = item.cloneNode(true);
    clone.querySelectorAll('.adm-nav-icon, .adm-notification-badge').forEach(function (node) {
      node.remove();
    });
    return clone.textContent.replace(/\s+/g, ' ').replace(/\s*→\s*$/, '').trim();
  }

  function tooltipElement() {
    var tooltip = document.getElementById(TOOLTIP_ID);
    if (tooltip) return tooltip;

    tooltip = document.createElement('div');
    tooltip.id = TOOLTIP_ID;
    tooltip.className = 'adm-sidebar-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function positionTooltip(item, tooltip) {
    var rect = item.getBoundingClientRect();
    var side = document.getElementById('adm-sidebar');
    var sideRect = side ? side.getBoundingClientRect() : rect;
    var gap = 10;
    var viewportPadding = 8;
    var top = rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2);
    var maxTop = Math.max(viewportPadding, window.innerHeight - tooltip.offsetHeight - viewportPadding);

    tooltip.style.left = Math.round(sideRect.right + gap) + 'px';
    tooltip.style.top = Math.round(Math.min(Math.max(top, viewportPadding), maxTop)) + 'px';
  }

  function showTooltip(item) {
    if (!isCollapsedRail() || !item || item.hidden || getComputedStyle(item).display === 'none') return;
    window.clearTimeout(closeTimer);

    var label = item.dataset.admSidebarLabel || normalizeLabel(item);
    if (!label) return;

    var tooltip = tooltipElement();
    tooltip.textContent = label;
    tooltip.hidden = false;
    tooltip.dataset.open = 'true';
    item.setAttribute('aria-describedby', TOOLTIP_ID);
    item.dataset.admTooltipOwned = 'true';

    requestAnimationFrame(function () {
      if (!tooltip.hidden) positionTooltip(item, tooltip);
    });
  }

  function hideTooltip() {
    window.clearTimeout(closeTimer);
    var tooltip = document.getElementById(TOOLTIP_ID);
    if (tooltip) {
      tooltip.hidden = true;
      tooltip.dataset.open = 'false';
    }
    document.querySelectorAll('[data-adm-tooltip-owned="true"]').forEach(function (item) {
      item.removeAttribute('aria-describedby');
      delete item.dataset.admTooltipOwned;
    });
  }

  function scheduleHideTooltip() {
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(hideTooltip, 80);
  }

  function prepareItems(sidebar) {
    sidebar.querySelectorAll('.adm-nav-item').forEach(function (item) {
      var label = normalizeLabel(item);
      if (!label) return;
      item.dataset.admSidebarLabel = label;
      if (!item.hasAttribute('aria-label')) item.setAttribute('aria-label', label);

      item.addEventListener('mouseenter', function () { showTooltip(item); });
      item.addEventListener('mouseleave', scheduleHideTooltip);
      item.addEventListener('focus', function () { showTooltip(item); });
      item.addEventListener('blur', hideTooltip);
      item.addEventListener('click', hideTooltip);
    });
  }

  function init() {
    var sidebar = document.getElementById('adm-sidebar');
    var toggle = document.getElementById('adm-sidebar-rail-toggle');
    if (!sidebar || !toggle) return;

    prepareItems(sidebar);
    applyState(currentState(), false);

    toggle.addEventListener('click', function () {
      applyState(
        currentState() === STATE_COLLAPSED ? STATE_EXPANDED : STATE_COLLAPSED,
        true
      );
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') hideTooltip();
    });

    window.addEventListener('resize', function () {
      hideTooltip();
      if (!hasManualPreference) applyState(defaultState(), false);
    }, { passive: true });

    sidebar.addEventListener('scroll', hideTooltip, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
