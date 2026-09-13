export function enhanceMobileFooter(root = document) {
  const mobile = window.matchMedia('(max-width: 480px)');

  root.querySelectorAll('.tt-footer-col').forEach((column, index) => {
    const title = column.querySelector('.tt-footer-col-title');
    const list = column.querySelector(':scope > ul');
    if (!title || !list || title.querySelector('.tt-footer-accordion-toggle')) return;

    const panelId = list.id || `tt-footer-panel-${index + 1}`;
    list.id = panelId;
    const label = title.textContent.trim();
    title.textContent = '';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'tt-footer-accordion-toggle';
    toggle.setAttribute('aria-controls', panelId);
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const iconEl = document.createElement('span');
    iconEl.className = 'tt-footer-accordion-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.textContent = '+';
    toggle.append(labelEl, iconEl);
    title.appendChild(toggle);

    const sync = () => {
      if (!mobile.matches) {
        list.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        return;
      }
      list.hidden = toggle.getAttribute('aria-expanded') !== 'true';
    };

    toggle.setAttribute('aria-expanded', mobile.matches ? 'false' : 'true');
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      sync();
    });
    mobile.addEventListener?.('change', sync);
    sync();
  });
}
