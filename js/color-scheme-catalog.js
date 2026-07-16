/**
 * TINTIN — Catálogo central de tokens de color (Super Admin → Apariencia)
 * Única fuente de verdad para: qué tokens existen, en qué categoría se
 * agrupan, qué variable CSS controlan y cuál es su valor por defecto (el
 * que ya está en vivo hoy, para que activar este módulo no cambie nada
 * hasta que Super Admin edite algo a propósito).
 *
 * Lo usan tanto la UI del panel (para generar los campos, categorías y el
 * buscador sin escribir 150 bloques de HTML a mano) como los motores de
 * aplicación (js/color-scheme.js y js/admin-color-scheme.js), así los tres
 * lugares nunca se desincronizan entre sí.
 */

// ---------------------------------------------------------------
// Esquema GLOBAL — toda la plataforma pública y de usuario
// ---------------------------------------------------------------

export const GLOBAL_CATEGORIES = [
  { key: 'generales', label: 'Colores generales' },
  { key: 'fondos', label: 'Fondos' },
  { key: 'tipografia', label: 'Tipografía' },
  { key: 'botones', label: 'Botones' },
  { key: 'bordes', label: 'Bordes y divisores' },
  { key: 'estados', label: 'Estados semánticos' },
  { key: 'formularios', label: 'Formularios' },
  { key: 'navegacion', label: 'Navegación' },
  { key: 'tarjetas', label: 'Tarjetas y tablas' },
  { key: 'modales', label: 'Modales y overlays' },
  { key: 'productos', label: 'Productos y carrito' },
  { key: 'avanzado', label: 'Elementos avanzados' },
];

export const GLOBAL_TOKENS = [
  // Generales / marca
  { key: 'brand-primary', cssVar: '--color-brand-primary', label: 'Color principal de marca', category: 'generales', default: '#AD3F67' },
  { key: 'brand-secondary', cssVar: '--color-brand-secondary', label: 'Color secundario de marca', category: 'generales', default: '#F6B7C8' },
  { key: 'brand-accent', cssVar: '--color-brand-accent', label: 'Color de acento suave', category: 'generales', default: '#FDECF2' },
  { key: 'brand-primary-hover', cssVar: '--color-brand-primary-hover', label: 'Color principal — hover', category: 'generales', default: '#8B2642' },

  // Fondos
  { key: 'bg-page', cssVar: '--color-background-page', label: 'Fondo de página', category: 'fondos', default: '#FFF6FA' },
  { key: 'bg-surface', cssVar: '--color-background-surface', label: 'Fondo de tarjetas/superficie', category: 'fondos', default: '#FFFFFF' },
  { key: 'bg-surface-soft', cssVar: '--color-background-surface-soft', label: 'Fondo de sección suave', category: 'fondos', default: '#FFF9FC' },
  { key: 'bg-elevated', cssVar: '--color-background-elevated', label: 'Fondo elevado (modales, dropdowns)', category: 'fondos', default: '#FFFFFF' },
  { key: 'bg-header', cssVar: '--color-background-header', label: 'Fondo del header', category: 'fondos', default: '#FFFFFF' },
  { key: 'bg-footer', cssVar: '--color-background-footer', label: 'Fondo del footer', category: 'fondos', default: '#FFFFFF' },
  { key: 'bg-menu', cssVar: '--color-background-menu', label: 'Fondo de menús', category: 'fondos', default: '#FFFFFF' },
  { key: 'bg-submenu', cssVar: '--color-background-submenu', label: 'Fondo de submenús', category: 'fondos', default: '#FFF9FC' },
  { key: 'bg-table', cssVar: '--color-background-table', label: 'Fondo de tablas', category: 'fondos', default: '#FFFFFF' },
  { key: 'bg-table-row-hover', cssVar: '--color-background-table-row-hover', label: 'Fondo de fila (hover)', category: 'fondos', default: '#FFF9FC' },
  { key: 'bg-field', cssVar: '--color-background-field', label: 'Fondo de campos de formulario', category: 'fondos', default: '#FFFFFF' },
  { key: 'bg-float', cssVar: '--color-background-float', label: 'Fondo de botones/componentes flotantes', category: 'fondos', default: '#AD3F67' },
  { key: 'bg-overlay', cssVar: '--color-background-overlay', label: 'Fondo de overlays (fondo oscurecido)', category: 'fondos', default: 'rgba(20,10,14,0.55)' },
  { key: 'bg-selected', cssVar: '--color-background-selected', label: 'Fondo de elemento seleccionado', category: 'fondos', default: '#FDECF2' },
  { key: 'bg-disabled', cssVar: '--color-background-disabled', label: 'Fondo de elemento deshabilitado', category: 'fondos', default: '#F1E4E7' },

  // Tipografía
  { key: 'text-primary', cssVar: '--color-text-primary', label: 'Texto principal', category: 'tipografia', default: '#2B2B2B' },
  { key: 'text-secondary', cssVar: '--color-text-secondary', label: 'Texto secundario', category: 'tipografia', default: '#7B6F72' },
  { key: 'text-tertiary', cssVar: '--color-text-tertiary', label: 'Texto terciario', category: 'tipografia', default: '#948890' },
  { key: 'text-muted', cssVar: '--color-text-muted', label: 'Texto tenue', category: 'tipografia', default: '#7B6F72' },
  { key: 'text-disabled', cssVar: '--color-text-disabled', label: 'Texto deshabilitado', category: 'tipografia', default: '#B7ADB0' },
  { key: 'text-inverse', cssVar: '--color-text-inverse', label: 'Texto invertido (sobre fondos oscuros/de color)', category: 'tipografia', default: '#FFFFFF' },
  { key: 'text-title', cssVar: '--color-text-title', label: 'Títulos', category: 'tipografia', default: '#2B2B2B' },
  { key: 'text-subtitle', cssVar: '--color-text-subtitle', label: 'Subtítulos', category: 'tipografia', default: '#7B6F72' },
  { key: 'text-label', cssVar: '--color-text-label', label: 'Etiquetas de campo', category: 'tipografia', default: '#2B2B2B' },
  { key: 'text-placeholder', cssVar: '--color-text-placeholder', label: 'Placeholders', category: 'tipografia', default: '#7B6F72' },
  { key: 'text-link', cssVar: '--color-text-link', label: 'Enlaces', category: 'tipografia', default: '#AD3F67' },
  { key: 'text-link-visited', cssVar: '--color-text-link-visited', label: 'Enlaces visitados', category: 'tipografia', default: '#8B2642' },
  { key: 'text-help', cssVar: '--color-text-help', label: 'Textos de ayuda', category: 'tipografia', default: '#7B6F72' },

  // Botones
  { key: 'btn-primary-bg', cssVar: '--color-button-primary-background', label: 'Botón principal — fondo', category: 'botones', default: '#AD3F67' },
  { key: 'btn-primary-text', cssVar: '--color-button-primary-text', label: 'Botón principal — texto', category: 'botones', default: '#FFFFFF' },
  { key: 'btn-primary-border', cssVar: '--color-button-primary-border', label: 'Botón principal — borde', category: 'botones', default: '#AD3F67' },
  { key: 'btn-primary-hover', cssVar: '--color-button-primary-hover', label: 'Botón principal — hover', category: 'botones', default: '#8B2642' },
  { key: 'btn-primary-active', cssVar: '--color-button-primary-active', label: 'Botón principal — active', category: 'botones', default: '#711F35' },
  { key: 'btn-primary-focus', cssVar: '--color-button-primary-focus-ring', label: 'Botón principal — anillo de focus', category: 'botones', default: 'rgba(173,63,103,0.24)' },
  { key: 'btn-primary-disabled-bg', cssVar: '--color-button-primary-disabled-background', label: 'Botón principal — fondo disabled', category: 'botones', default: '#F1E4E7' },
  { key: 'btn-primary-disabled-text', cssVar: '--color-button-primary-disabled-text', label: 'Botón principal — texto disabled', category: 'botones', default: '#B7ADB0' },

  { key: 'btn-secondary-bg', cssVar: '--color-button-secondary-background', label: 'Botón secundario — fondo', category: 'botones', default: '#FFFFFF' },
  { key: 'btn-secondary-text', cssVar: '--color-button-secondary-text', label: 'Botón secundario — texto', category: 'botones', default: '#AD3F67' },
  { key: 'btn-secondary-border', cssVar: '--color-button-secondary-border', label: 'Botón secundario — borde', category: 'botones', default: '#AD3F67' },
  { key: 'btn-secondary-hover', cssVar: '--color-button-secondary-hover', label: 'Botón secundario — hover', category: 'botones', default: '#FFF9FC' },
  { key: 'btn-secondary-active', cssVar: '--color-button-secondary-active', label: 'Botón secundario — active', category: 'botones', default: '#FDECF2' },
  { key: 'btn-secondary-focus', cssVar: '--color-button-secondary-focus-ring', label: 'Botón secundario — anillo de focus', category: 'botones', default: 'rgba(173,63,103,0.24)' },
  { key: 'btn-secondary-disabled-bg', cssVar: '--color-button-secondary-disabled-background', label: 'Botón secundario — fondo disabled', category: 'botones', default: '#F1E4E7' },
  { key: 'btn-secondary-disabled-text', cssVar: '--color-button-secondary-disabled-text', label: 'Botón secundario — texto disabled', category: 'botones', default: '#B7ADB0' },

  { key: 'btn-success-bg', cssVar: '--color-button-success-background', label: 'Botón de éxito — fondo', category: 'botones', default: '#e0f5e6' },
  { key: 'btn-success-text', cssVar: '--color-button-success-text', label: 'Botón de éxito — texto', category: 'botones', default: '#166534' },
  { key: 'btn-warning-bg', cssVar: '--color-button-warning-background', label: 'Botón de advertencia — fondo', category: 'botones', default: '#fff3e0' },
  { key: 'btn-warning-text', cssVar: '--color-button-warning-text', label: 'Botón de advertencia — texto', category: 'botones', default: '#bf360c' },
  { key: 'btn-danger-bg', cssVar: '--color-button-danger-background', label: 'Botón de peligro — fondo', category: 'botones', default: '#dc2626' },
  { key: 'btn-danger-text', cssVar: '--color-button-danger-text', label: 'Botón de peligro — texto', category: 'botones', default: '#FFFFFF' },
  { key: 'btn-danger-hover', cssVar: '--color-button-danger-hover', label: 'Botón de peligro — hover', category: 'botones', default: '#b91c1c' },
  { key: 'btn-info-bg', cssVar: '--color-button-info-background', label: 'Botón informativo — fondo', category: 'botones', default: '#e3edf9' },
  { key: 'btn-info-text', cssVar: '--color-button-info-text', label: 'Botón informativo — texto', category: 'botones', default: '#1d4e89' },
  { key: 'btn-neutral-bg', cssVar: '--color-button-neutral-background', label: 'Botón neutral — fondo', category: 'botones', default: '#F1E4E7' },
  { key: 'btn-neutral-text', cssVar: '--color-button-neutral-text', label: 'Botón neutral — texto', category: 'botones', default: '#2B2B2B' },
  { key: 'btn-whatsapp-bg', cssVar: '--color-button-whatsapp-background', label: 'Botón de WhatsApp — fondo', category: 'botones', default: '#0d8043' },
  { key: 'btn-whatsapp-text', cssVar: '--color-button-whatsapp-text', label: 'Botón de WhatsApp — texto', category: 'botones', default: '#FFFFFF' },
  { key: 'btn-whatsapp-hover', cssVar: '--color-button-whatsapp-hover', label: 'Botón de WhatsApp — hover', category: 'botones', default: '#0a6835' },
  { key: 'btn-icon-text', cssVar: '--color-button-icon-text', label: 'Botones de íconos — color', category: 'botones', default: '#7B6F72' },
  { key: 'btn-icon-disabled', cssVar: '--color-button-icon-disabled-text', label: 'Botones de íconos — deshabilitado', category: 'botones', default: '#B7ADB0' },
  { key: 'btn-floating-bg', cssVar: '--color-button-floating-background', label: 'Botones flotantes — fondo', category: 'botones', default: '#AD3F67' },
  { key: 'btn-floating-text', cssVar: '--color-button-floating-text', label: 'Botones flotantes — texto', category: 'botones', default: '#FFFFFF' },
  { key: 'btn-sticky-bg', cssVar: '--color-button-sticky-background', label: 'Botones sticky — fondo', category: 'botones', default: '#AD3F67' },
  { key: 'btn-sticky-text', cssVar: '--color-button-sticky-text', label: 'Botones sticky — texto', category: 'botones', default: '#FFFFFF' },
  { key: 'btn-outline-bg', cssVar: '--color-button-outline-background', label: 'Botones outline — fondo', category: 'botones', default: '#FFFFFF' },
  { key: 'btn-outline-text', cssVar: '--color-button-outline-text', label: 'Botones outline — texto', category: 'botones', default: '#AD3F67' },
  { key: 'btn-outline-border', cssVar: '--color-button-outline-border', label: 'Botones outline — borde', category: 'botones', default: '#AD3F67' },
  { key: 'btn-transparent-text', cssVar: '--color-button-transparent-text', label: 'Botones transparentes — texto', category: 'botones', default: '#AD3F67' },

  // Bordes y divisores
  { key: 'border-primary', cssVar: '--color-border-primary', label: 'Borde principal', category: 'bordes', default: '#F1E4E7' },
  { key: 'border-secondary', cssVar: '--color-border-secondary', label: 'Borde secundario / divisores', category: 'bordes', default: '#F7E9ED' },
  { key: 'border-focus', cssVar: '--color-border-focus', label: 'Borde de focus', category: 'bordes', default: '#AD3F67' },
  { key: 'border-error', cssVar: '--color-border-error', label: 'Borde de error', category: 'bordes', default: '#b8341f' },
  { key: 'border-success', cssVar: '--color-border-success', label: 'Borde de éxito', category: 'bordes', default: '#166534' },
  { key: 'border-warning', cssVar: '--color-border-warning', label: 'Borde de advertencia', category: 'bordes', default: '#bf360c' },

  // Estados semánticos
  { key: 'state-info-bg', cssVar: '--color-info-background', label: 'Informativo — fondo', category: 'estados', default: '#e3edf9' },
  { key: 'state-info-text', cssVar: '--color-info-text', label: 'Informativo — texto', category: 'estados', default: '#1d4e89' },
  { key: 'state-success-bg', cssVar: '--color-success-background', label: 'Éxito — fondo', category: 'estados', default: '#e0f5e6' },
  { key: 'state-success-text', cssVar: '--color-success-text', label: 'Éxito — texto', category: 'estados', default: '#166534' },
  { key: 'state-warning-bg', cssVar: '--color-warning-background', label: 'Advertencia — fondo', category: 'estados', default: '#fff3e0' },
  { key: 'state-warning-text', cssVar: '--color-warning-text', label: 'Advertencia — texto', category: 'estados', default: '#bf360c' },
  { key: 'state-error-bg', cssVar: '--color-error-background', label: 'Error — fondo', category: 'estados', default: '#fde3e1' },
  { key: 'state-error-text', cssVar: '--color-error-text', label: 'Error — texto', category: 'estados', default: '#b8341f' },
  { key: 'state-danger-bg', cssVar: '--color-danger-background', label: 'Peligro — fondo', category: 'estados', default: '#dc2626' },
  { key: 'state-danger-text', cssVar: '--color-danger-text', label: 'Peligro — texto', category: 'estados', default: '#FFFFFF' },
  { key: 'state-neutral-bg', cssVar: '--color-neutral-background', label: 'Neutral — fondo', category: 'estados', default: '#F1E4E7' },
  { key: 'state-neutral-text', cssVar: '--color-neutral-text', label: 'Neutral — texto', category: 'estados', default: '#2B2B2B' },
  { key: 'state-available', cssVar: '--color-state-available', label: 'Disponibilidad / stock', category: 'estados', default: '#166534' },
  { key: 'state-soldout', cssVar: '--color-state-soldout', label: 'Agotado', category: 'estados', default: '#b8341f' },
  { key: 'state-discount', cssVar: '--color-state-discount', label: 'Descuento', category: 'estados', default: '#AD3F67' },
  { key: 'state-promo', cssVar: '--color-state-promo', label: 'Promoción', category: 'estados', default: '#8a6d1f' },
  { key: 'state-selected', cssVar: '--color-state-selected', label: 'Seleccionado', category: 'estados', default: '#AD3F67' },
  { key: 'state-hover', cssVar: '--color-state-hover', label: 'Hover (genérico)', category: 'estados', default: '#FFF9FC' },
  { key: 'state-focus', cssVar: '--color-state-focus', label: 'Focus (genérico)', category: 'estados', default: 'rgba(173,63,103,0.24)' },
  { key: 'state-active', cssVar: '--color-state-active', label: 'Active (genérico)', category: 'estados', default: '#FDECF2' },
  { key: 'state-disabled', cssVar: '--color-state-disabled', label: 'Disabled (genérico)', category: 'estados', default: '#B7ADB0' },

  // Formularios
  { key: 'field-bg', cssVar: '--color-field-background', label: 'Campos — fondo', category: 'formularios', default: '#FFFFFF' },
  { key: 'field-text', cssVar: '--color-field-text', label: 'Campos — texto', category: 'formularios', default: '#2B2B2B' },
  { key: 'field-border', cssVar: '--color-field-border', label: 'Campos — borde', category: 'formularios', default: '#F1E4E7' },
  { key: 'field-border-focus', cssVar: '--color-field-border-focus', label: 'Campos — borde de focus', category: 'formularios', default: '#AD3F67' },
  { key: 'field-placeholder', cssVar: '--color-field-placeholder', label: 'Campos — placeholder', category: 'formularios', default: '#7B6F72' },

  // Navegación
  { key: 'nav-active-bg', cssVar: '--color-nav-active-background', label: 'Navegación activa — fondo', category: 'navegacion', default: '#FDECF2' },
  { key: 'nav-active-text', cssVar: '--color-nav-active-text', label: 'Navegación activa — texto', category: 'navegacion', default: '#AD3F67' },
  { key: 'nav-inactive-text', cssVar: '--color-nav-inactive-text', label: 'Navegación inactiva — texto', category: 'navegacion', default: '#2B2B2B' },
  { key: 'tab-active-bg', cssVar: '--color-tab-active-background', label: 'Pestaña activa — fondo', category: 'navegacion', default: '#AD3F67' },
  { key: 'tab-active-text', cssVar: '--color-tab-active-text', label: 'Pestaña activa — texto', category: 'navegacion', default: '#FFFFFF' },
  { key: 'tab-inactive-text', cssVar: '--color-tab-inactive-text', label: 'Pestaña inactiva — texto', category: 'navegacion', default: '#7B6F72' },
  { key: 'breadcrumb-text', cssVar: '--color-breadcrumb-text', label: 'Breadcrumbs', category: 'navegacion', default: '#7B6F72' },
  { key: 'breadcrumb-active', cssVar: '--color-breadcrumb-active-text', label: 'Breadcrumb activo', category: 'navegacion', default: '#AD3F67' },
  { key: 'accordion-header-bg', cssVar: '--color-accordion-header-background', label: 'Encabezado de acordeón', category: 'navegacion', default: '#FFF9FC' },
  { key: 'indicator', cssVar: '--color-indicator', label: 'Indicadores (puntos, pills)', category: 'navegacion', default: '#AD3F67' },

  // Tarjetas y tablas
  { key: 'card-border', cssVar: '--color-card-border', label: 'Borde de tarjetas', category: 'tarjetas', default: '#F1E4E7' },
  { key: 'card-shadow', cssVar: '--color-card-shadow', label: 'Sombra de tarjetas', category: 'tarjetas', default: 'rgba(212,106,138,0.10)' },
  { key: 'table-border', cssVar: '--color-table-border', label: 'Bordes de tabla', category: 'tarjetas', default: '#F1E4E7' },
  { key: 'table-header-bg', cssVar: '--color-table-header-background', label: 'Encabezado de tabla — fondo', category: 'tarjetas', default: '#FDECF2' },
  { key: 'table-header-text', cssVar: '--color-table-header-text', label: 'Encabezado de tabla — texto', category: 'tarjetas', default: '#2B2B2B' },
  { key: 'badge-bg', cssVar: '--color-badge-background', label: 'Badges — fondo', category: 'tarjetas', default: '#FDECF2' },
  { key: 'badge-text', cssVar: '--color-badge-text', label: 'Badges — texto', category: 'tarjetas', default: '#AD3F67' },
  { key: 'chip-bg', cssVar: '--color-chip-background', label: 'Chips — fondo', category: 'tarjetas', default: '#FDECF2' },
  { key: 'chip-text', cssVar: '--color-chip-text', label: 'Chips — texto', category: 'tarjetas', default: '#AD3F67' },

  // Modales y overlays
  { key: 'modal-bg', cssVar: '--color-modal-background', label: 'Modales — fondo', category: 'modales', default: '#FFFFFF' },
  { key: 'modal-border', cssVar: '--color-modal-border', label: 'Modales — borde', category: 'modales', default: '#F1E4E7' },
  { key: 'modal-overlay', cssVar: '--color-modal-overlay', label: 'Fondo detrás del modal', category: 'modales', default: 'rgba(20,10,14,0.55)' },
  { key: 'tooltip-bg', cssVar: '--color-tooltip-background', label: 'Tooltips — fondo', category: 'modales', default: '#2B2B2B' },
  { key: 'tooltip-text', cssVar: '--color-tooltip-text', label: 'Tooltips — texto', category: 'modales', default: '#FFFFFF' },
  { key: 'empty-state-text', cssVar: '--color-empty-state-text', label: 'Estados vacíos — texto', category: 'modales', default: '#7B6F72' },

  // Productos y carrito
  { key: 'price', cssVar: '--color-price', label: 'Precio', category: 'productos', default: '#AD3F67' },
  { key: 'price-old', cssVar: '--color-price-old', label: 'Precio anterior (tachado)', category: 'productos', default: '#7B6F72' },
  { key: 'rating-star', cssVar: '--color-rating-star', label: 'Estrellas de reseña', category: 'productos', default: '#8a6d1f' },
  { key: 'cart-badge-bg', cssVar: '--color-cart-badge-background', label: 'Badge del carrito — fondo', category: 'productos', default: '#AD3F67' },
  { key: 'cart-badge-text', cssVar: '--color-cart-badge-text', label: 'Badge del carrito — texto', category: 'productos', default: '#FFFFFF' },

  // Avanzado
  { key: 'icon-primary', cssVar: '--color-icon-primary', label: 'Íconos principales', category: 'avanzado', default: '#7B6F72' },
  { key: 'icon-secondary', cssVar: '--color-icon-secondary', label: 'Íconos secundarios', category: 'avanzado', default: '#AD3F67' },
  { key: 'icon-disabled', cssVar: '--color-icon-disabled', label: 'Íconos deshabilitados', category: 'avanzado', default: '#B7ADB0' },
  { key: 'scrollbar-thumb', cssVar: '--color-scrollbar-thumb', label: 'Scrollbar — control', category: 'avanzado', default: '#EA7EA3' },
  { key: 'scrollbar-track', cssVar: '--color-scrollbar-track', label: 'Scrollbar — riel', category: 'avanzado', default: '#FDF0F5' },
  { key: 'switch-on-bg', cssVar: '--color-switch-on-background', label: 'Switch — encendido', category: 'avanzado', default: '#AD3F67' },
  { key: 'switch-off-bg', cssVar: '--color-switch-off-background', label: 'Switch — apagado', category: 'avanzado', default: '#E3D5D9' },
  { key: 'switch-thumb', cssVar: '--color-switch-thumb', label: 'Switch — perilla', category: 'avanzado', default: '#FFFFFF' },
  { key: 'checkbox-checked', cssVar: '--color-checkbox-checked-background', label: 'Checkbox marcado', category: 'avanzado', default: '#AD3F67' },
  { key: 'checkbox-border', cssVar: '--color-checkbox-border', label: 'Checkbox — borde', category: 'avanzado', default: '#F1E4E7' },
  { key: 'radio-checked', cssVar: '--color-radio-checked-background', label: 'Radio marcado', category: 'avanzado', default: '#AD3F67' },
  { key: 'radio-border', cssVar: '--color-radio-border', label: 'Radio — borde', category: 'avanzado', default: '#F1E4E7' },
  { key: 'progress-track', cssVar: '--color-progress-track', label: 'Barra de progreso — riel', category: 'avanzado', default: '#F1E4E7' },
  { key: 'progress-fill', cssVar: '--color-progress-fill', label: 'Barra de progreso — relleno', category: 'avanzado', default: '#AD3F67' },
  { key: 'skeleton-base', cssVar: '--color-skeleton-base', label: 'Skeleton loader — base', category: 'avanzado', default: '#F1E4E7' },
  { key: 'skeleton-shine', cssVar: '--color-skeleton-shine', label: 'Skeleton loader — brillo', category: 'avanzado', default: '#FDECF2' },
  { key: 'selection-bg', cssVar: '--color-selection-background', label: 'Selección de texto — fondo', category: 'avanzado', default: '#AD3F67' },
  { key: 'selection-text', cssVar: '--color-selection-text', label: 'Selección de texto — color', category: 'avanzado', default: '#FFFFFF' },
  { key: 'loading-spinner', cssVar: '--color-loading-spinner', label: 'Spinner de carga', category: 'avanzado', default: '#AD3F67' },
];

// ---------------------------------------------------------------
// Esquema del SUPER ADMIN — únicamente el panel administrativo
// ---------------------------------------------------------------

export const ADMIN_CATEGORIES = [
  { key: 'generales', label: 'Colores generales' },
  { key: 'estructura', label: 'Estructura (sidebar, header)' },
  { key: 'tipografia', label: 'Tipografía' },
  { key: 'botones', label: 'Botones' },
  { key: 'tarjetas', label: 'Tarjetas y tablas' },
  { key: 'formularios', label: 'Formularios y filtros' },
  { key: 'estados', label: 'Estados y alertas' },
  { key: 'modales', label: 'Modales' },
];

export const ADMIN_TOKENS = [
  { key: 'brand', cssVar: '--admin-color-brand', label: 'Color de acento del panel', category: 'generales', default: '#AD3F67' },
  { key: 'brand-hover', cssVar: '--admin-color-brand-hover', label: 'Acento del panel — hover', category: 'generales', default: '#8B2642' },
  { key: 'bg-page', cssVar: '--admin-color-background-page', label: 'Fondo general del panel', category: 'estructura', default: '#FFF6FA' },
  { key: 'bg-sidebar', cssVar: '--admin-color-background-sidebar', label: 'Sidebar — fondo', category: 'estructura', default: '#FFFFFF' },
  { key: 'text-sidebar', cssVar: '--admin-color-text-sidebar', label: 'Sidebar — texto', category: 'estructura', default: '#2B2B2B' },
  { key: 'bg-sidebar-active', cssVar: '--admin-color-background-sidebar-active', label: 'Sidebar — ítem activo/hover', category: 'estructura', default: '#FDECF2' },
  { key: 'text-sidebar-active', cssVar: '--admin-color-text-sidebar-active', label: 'Sidebar — texto ítem activo', category: 'estructura', default: '#2B2B2B' },
  { key: 'bg-header', cssVar: '--admin-color-background-header', label: 'Header administrativo — fondo', category: 'estructura', default: '#FFFFFF' },
  { key: 'bg-surface', cssVar: '--admin-color-background-surface', label: 'Tarjetas / superficie', category: 'estructura', default: '#FFFFFF' },
  { key: 'border', cssVar: '--admin-color-border', label: 'Bordes generales', category: 'estructura', default: '#F1E4E7' },

  { key: 'text-primary', cssVar: '--admin-color-text-primary', label: 'Texto principal', category: 'tipografia', default: '#2B2B2B' },
  { key: 'text-secondary', cssVar: '--admin-color-text-secondary', label: 'Texto secundario', category: 'tipografia', default: '#7B6F72' },
  { key: 'text-tertiary', cssVar: '--admin-color-text-tertiary', label: 'Texto terciario', category: 'tipografia', default: '#948890' },
  { key: 'text-title', cssVar: '--admin-color-text-title', label: 'Títulos', category: 'tipografia', default: '#2B2B2B' },

  { key: 'btn-primary-bg', cssVar: '--admin-color-button-primary-background', label: 'Botón principal — fondo', category: 'botones', default: '#AD3F67' },
  { key: 'btn-primary-text', cssVar: '--admin-color-button-primary-text', label: 'Botón principal — texto', category: 'botones', default: '#FFFFFF' },
  { key: 'btn-primary-hover', cssVar: '--admin-color-button-primary-hover', label: 'Botón principal — hover', category: 'botones', default: '#8B2642' },
  { key: 'btn-outline-text', cssVar: '--admin-color-button-outline-text', label: 'Botón outline — texto/borde', category: 'botones', default: '#AD3F67' },
  { key: 'btn-danger-bg', cssVar: '--admin-color-button-danger-background', label: 'Botón de peligro — fondo', category: 'botones', default: '#dc2626' },
  { key: 'btn-danger-text', cssVar: '--admin-color-button-danger-text', label: 'Botón de peligro — texto', category: 'botones', default: '#FFFFFF' },
  { key: 'btn-danger-hover', cssVar: '--admin-color-button-danger-hover', label: 'Botón de peligro — hover', category: 'botones', default: '#b91c1c' },

  { key: 'table-header-bg', cssVar: '--admin-color-table-header-background', label: 'Tabla — encabezado', category: 'tarjetas', default: '#FDECF2' },
  { key: 'table-row-hover', cssVar: '--admin-color-table-row-hover', label: 'Tabla — fila hover', category: 'tarjetas', default: '#FFF9FC' },
  { key: 'badge-bg', cssVar: '--admin-color-badge-background', label: 'Badges — fondo', category: 'tarjetas', default: '#FDECF2' },
  { key: 'badge-text', cssVar: '--admin-color-badge-text', label: 'Badges — texto', category: 'tarjetas', default: '#AD3F67' },

  { key: 'field-bg', cssVar: '--admin-color-field-background', label: 'Campos — fondo', category: 'formularios', default: '#FFFFFF' },
  { key: 'field-border', cssVar: '--admin-color-field-border', label: 'Campos — borde', category: 'formularios', default: '#F1E4E7' },
  { key: 'field-border-focus', cssVar: '--admin-color-field-border-focus', label: 'Campos — borde de focus', category: 'formularios', default: '#AD3F67' },

  { key: 'state-success-bg', cssVar: '--admin-color-success-background', label: 'Éxito — fondo', category: 'estados', default: '#e0f5e6' },
  { key: 'state-success-text', cssVar: '--admin-color-success-text', label: 'Éxito — texto', category: 'estados', default: '#166534' },
  { key: 'state-warning-bg', cssVar: '--admin-color-warning-background', label: 'Advertencia — fondo', category: 'estados', default: '#fff3e0' },
  { key: 'state-warning-text', cssVar: '--admin-color-warning-text', label: 'Advertencia — texto', category: 'estados', default: '#bf360c' },
  { key: 'state-error-bg', cssVar: '--admin-color-error-background', label: 'Error — fondo', category: 'estados', default: '#fde3e1' },
  { key: 'state-error-text', cssVar: '--admin-color-error-text', label: 'Error — texto', category: 'estados', default: '#b8341f' },

  { key: 'modal-bg', cssVar: '--admin-color-modal-background', label: 'Modales — fondo', category: 'modales', default: '#FFFFFF' },
  { key: 'modal-overlay', cssVar: '--admin-color-modal-overlay', label: 'Modales — fondo detrás', category: 'modales', default: 'rgba(20,10,14,0.55)' },
];

// ---------------------------------------------------------------
// Pares de contraste — usados por el verificador WCAG del módulo
// ---------------------------------------------------------------

export const GLOBAL_CONTRAST_PAIRS = [
  { label: 'Texto principal sobre fondo de página', fg: 'text-primary', bg: 'bg-page', level: 'normal' },
  { label: 'Texto principal sobre tarjetas', fg: 'text-primary', bg: 'bg-surface', level: 'normal' },
  { label: 'Texto secundario sobre tarjetas', fg: 'text-secondary', bg: 'bg-surface', level: 'normal' },
  { label: 'Texto del botón principal', fg: 'btn-primary-text', bg: 'btn-primary-bg', level: 'normal' },
  { label: 'Texto del botón secundario', fg: 'btn-secondary-text', bg: 'btn-secondary-bg', level: 'normal' },
  { label: 'Texto del botón de WhatsApp', fg: 'btn-whatsapp-text', bg: 'btn-whatsapp-bg', level: 'normal' },
  { label: 'Texto de error sobre su fondo', fg: 'state-error-text', bg: 'state-error-bg', level: 'normal' },
  { label: 'Texto de éxito sobre su fondo', fg: 'state-success-text', bg: 'state-success-bg', level: 'normal' },
  { label: 'Texto de advertencia sobre su fondo', fg: 'state-warning-text', bg: 'state-warning-bg', level: 'normal' },
  { label: 'Enlaces sobre fondo de página', fg: 'text-link', bg: 'bg-page', level: 'normal' },
  { label: 'Íconos sobre fondo de página', fg: 'icon-primary', bg: 'bg-page', level: 'ui' },
  { label: 'Borde de campo sobre fondo de campo', fg: 'field-border', bg: 'field-bg', level: 'ui' },
];

export const ADMIN_CONTRAST_PAIRS = [
  { label: 'Texto principal sobre fondo del panel', fg: 'text-primary', bg: 'bg-page', level: 'normal' },
  { label: 'Texto del sidebar', fg: 'text-sidebar', bg: 'bg-sidebar', level: 'normal' },
  { label: 'Texto del botón principal', fg: 'btn-primary-text', bg: 'btn-primary-bg', level: 'normal' },
  { label: 'Texto del botón de peligro', fg: 'btn-danger-text', bg: 'btn-danger-bg', level: 'normal' },
  { label: 'Texto de error sobre su fondo', fg: 'state-error-text', bg: 'state-error-bg', level: 'normal' },
  { label: 'Texto de éxito sobre su fondo', fg: 'state-success-text', bg: 'state-success-bg', level: 'normal' },
];

// ---------------------------------------------------------------
// Breakpoints centralizados para "personalizar colores por dispositivo"
// (alineados a los ya usados en el CSS del sitio — no se inventan nuevos)
// ---------------------------------------------------------------

export const DEVICE_BREAKPOINTS = [
  { key: 'desktopLg', label: 'Desktop grande', min: 1440, max: null },
  { key: 'desktop', label: 'Desktop', min: 1200, max: 1439 },
  { key: 'laptop', label: 'Laptop', min: 992, max: 1199 },
  { key: 'tablet', label: 'Tablet', min: 768, max: 991 },
  { key: 'mobile', label: 'Mobile', min: 480, max: 767 },
  { key: 'miniMobile', label: 'Mini mobile', min: 0, max: 479 },
];

export function findTokenByKey(tokens, key) {
  return tokens.find(t => t.key === key) || null;
}

export function buildDefaultTokenMap(tokens) {
  const out = {};
  tokens.forEach(t => { out[t.key] = t.default; });
  return out;
}
