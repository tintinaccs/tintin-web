// Presentación común de las bandejas existentes. Sólo consume estados guardados.
export function notificationIconKey(notification = {}) {
  const kind = String(notification.kind || '');
  const status = String(notification.status || '');
  if (['payment-confirmed','payment-pending'].includes(notification.iconKey)) return notification.iconKey;
  if (kind === 'order_confirmed' && status === 'pagado') return 'payment-confirmed';
  if (kind.includes('payment')) return ['pagado','paid','approved','completed'].includes(notification.paymentStatus || status) ? 'payment-confirmed' : 'payment-pending';
  if (kind.startsWith('order')) return ({pendiente:'order',confirmado:'order',preparando:'preparing',listo:'ready',listo_retiro:'ready',en_camino:'shipping',enviado:'shipping',entregado:'delivered',cancelado:'incident',rechazado:'incident',devuelto:'incident',incidencia:'incident'})[status] || 'order';
  if (kind === 'welcome') return 'sparkle';
  return notification.iconKey || 'bell';
}
export function notificationActionLabel(notification = {}) {
  if (notification.orderId) return 'Ver pedido';
  if (String(notification.kind || '').includes('payment')) return 'Revisar pago';
  return 'Ver mensaje';
}
export function notificationIconSvg(iconKey) {
  const paths = {
    heart:'<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"/>',
    comment:'<path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z"/><path d="M8 9h8M8 13h5"/>',
    order:'<path d="M7 7V5a5 5 0 0110 0v2M4 7h16l-1 14H5L4 7z"/>',
    preparing:'<path d="M4 5h16v16H4zM4 10h16M10 5v5"/><path d="m9 16 2 2 4-4"/>',
    ready:'<path d="m3 7 9-4 9 4v12l-9 3-9-3zM3 7l9 4 9-4M12 11v11"/>',
    shipping:'<path d="M1 5h13v12H1zM14 9h5l4 5v3h-9"/><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/>',
    delivered:'<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
    incident:'<path d="m12 3 10 18H2L12 3zM12 9v5M12 17h.01"/>',
    'payment-pending':'<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 9h20M7 15h4M17 13v4M15 15h4"/>',
    'payment-confirmed':'<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 9h20M10 15l3 3 5-5"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    sparkle:'<path d="m12 3 2 6 6 3-6 2-2 7-2-7-6-2 6-3z"/>',
    bell:'<path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  };
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[iconKey === 'review' ? 'comment' : iconKey] || paths.bell}</svg>`;
}
