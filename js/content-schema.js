/* =============================================================
   TINTIN — Fase 6: esquema único de contenido editable

   Los selectores viven únicamente en código. Firestore guarda valores, nunca
   HTML, CSS ni selectores arbitrarios. Así Super Admin puede editar textos sin
   convertir el panel en un inyector de código.
   ============================================================= */

export const CONTENT_MAX_LENGTH = 4000;
export const CONTENT_PAGE_IDS = [
  'index', 'nosotros', 'catalogo', 'collections',
  'contact', 'envios', 'faq', 'cambios'
];

export const PAGE_PATH_TO_ID = Object.freeze({
  '': 'index',
  '/': 'index',
  'index.html': 'index',
  'about.html': 'nosotros',
  'nosotros.html': 'nosotros',
  'catalogo.html': 'catalogo',
  'collections.html': 'collections',
  'contact.html': 'contact',
  'envios.html': 'envios',
  'preguntas-frecuentes.html': 'faq',
  'cambios-devoluciones.html': 'cambios',
});

const field = (key, label, selector, defaultValue, options = {}) => ({
  key,
  label,
  selector,
  default: defaultValue,
  type: options.type || 'text',
  rows: options.rows || (options.type === 'multiline' ? 4 : 1),
  index: Number.isInteger(options.index) ? options.index : null,
  maxLength: options.maxLength || CONTENT_MAX_LENGTH,
  help: options.help || '',
});

const headerFields = (eyebrow, title, desc) => [
  field('eyebrow', 'Texto pequeño', '.tt-section-sub', eyebrow, { maxLength: 120 }),
  field('title', 'Título', '.tt-page-hero-title', title, { type: 'multiline', rows: 2, maxLength: 180 }),
  field('desc', 'Descripción', '.tt-page-hero-sub', desc, { type: 'multiline', rows: 3, maxLength: 500 }),
];

const faqField = (key, label, selector, index, defaultValue, type = 'multiline') =>
  field(key, label, selector, defaultValue, {
    type,
    index,
    rows: type === 'multiline' ? 3 : 1,
    maxLength: type === 'multiline' ? 900 : 220,
  });

export const SITE_CONTENT_SCHEMA = Object.freeze({
  index: {
    label: 'Inicio',
    path: 'index.html',
    sections: {
      hero: {
        label: 'Banner principal',
        root: '.tt-hero',
        allowVisibility: true,
        fields: [
          field('eyebrow', 'Texto pequeño', '.tt-hero-eyebrow', 'Bienvenidas a TINTIN', { maxLength: 120 }),
          field('title', 'Título', '.tt-hero-title', 'DETALLES QUE ELEVAN\nTÚ ESTILO', { type: 'multiline', rows: 3, maxLength: 220 }),
          field('subtitle', 'Subtítulo', '.tt-hero-subtitle', '', { type: 'multiline', rows: 3, maxLength: 500 }),
          field('primaryText', 'Botón principal', '.tt-hero-actions a', 'Comprar ahora', { index: 0, maxLength: 80 }),
          field('primaryHref', 'Enlace del botón principal', '.tt-hero-actions a', 'catalogo.html', { index: 0, type: 'href', maxLength: 500 }),
          field('btnText', 'Botón secundario', '.tt-hero-actions a', '¿Quiénes somos? →', { index: 1, maxLength: 80 }),
          field('btnHref', 'Enlace del botón secundario', '.tt-hero-actions a', 'about.html', { index: 1, type: 'href', maxLength: 500 }),
        ],
      },
      trust: {
        label: 'Beneficios y confianza',
        root: '.tt-trust-bar',
        allowVisibility: true,
        fields: [
          field('items.0.label', 'Beneficio 1 — título', '.tt-trust-title', 'Envío mismo día', { index: 0, maxLength: 100 }),
          field('items.0.desc', 'Beneficio 1 — detalle', '.tt-trust-desc', 'Pedidos antes de las 11 hs, Zona Central', { index: 0, maxLength: 220 }),
          field('items.1.label', 'Beneficio 2 — título', '.tt-trust-title', 'Acero inoxidable', { index: 1, maxLength: 100 }),
          field('items.1.desc', 'Beneficio 2 — detalle', '.tt-trust-desc', 'No se oxida ni decolora', { index: 1, maxLength: 220 }),
          field('items.2.label', 'Beneficio 3 — título', '.tt-trust-title', 'Pago seguro', { index: 2, maxLength: 100 }),
          field('items.2.desc', 'Beneficio 3 — detalle', '.tt-trust-desc', 'Transferencia o efectivo', { index: 2, maxLength: 220 }),
          field('items.3.label', 'Beneficio 4 — título', '.tt-trust-title', 'Atención personalizada', { index: 3, maxLength: 100 }),
          field('items.3.desc', 'Beneficio 4 — detalle', '.tt-trust-desc', 'Te ayudamos por WhatsApp', { index: 3, maxLength: 220 }),
        ],
      },
      editorial_bag: {
        label: 'Editorial Bags',
        root: '[data-tt-section="editorial_bag"]',
        allowVisibility: true,
        fields: [
          field('eyebrow', 'Texto pequeño', '.tt-editorial-eyebrow', 'Colección Exclusiva', { maxLength: 120 }),
          field('title', 'Título', '.tt-editorial-title', 'EL COMPLEMENTO\nQUE LO CAMBIA TODO', { type: 'multiline', rows: 3, maxLength: 220 }),
          field('body', 'Descripción', '.tt-editorial-desc', 'Descubrí nuestra exclusiva colección de bags — el accesorio que transforma cualquier outfit en un look de revista. Diseños únicos pensados para la mujer moderna que quiere brillar sin esfuerzo.', { type: 'multiline', rows: 5, maxLength: 1200 }),
          field('btnText', 'Texto del botón', 'a.tt-btn', 'LO QUIERO YA!', { maxLength: 80 }),
          field('btnHref', 'Enlace del botón', 'a.tt-btn', 'catalogo.html?cat=bolsos', { type: 'href', maxLength: 500 }),
        ],
      },
      collections_header: {
        label: 'Encabezado de colecciones',
        root: '.tt-collections-section .tt-collections-header',
        allowVisibility: false,
        fields: [
          field('eyebrow', 'Texto pequeño', '.tt-section-sub', 'Explorá todo', { maxLength: 120 }),
          field('title', 'Título', '.tt-section-title', 'NUESTRAS COLECCIONES', { maxLength: 180 }),
          field('desc', 'Descripción', '.tt-section-desc', 'Descubrí todo lo que tenemos para vos', { maxLength: 400 }),
        ],
      },
      editorial_relojes: {
        label: 'Editorial Relojes',
        root: '[data-tt-section="editorial_relojes"]',
        allowVisibility: true,
        fields: [
          field('eyebrow', 'Texto pequeño', '.tt-watch-eyebrow', 'Nueva colección', { maxLength: 120 }),
          field('title', 'Título', '.tt-watch-title', 'EL RELOJ DEL QUE\nTODAS SE ENAMORAN', { type: 'multiline', rows: 3, maxLength: 220 }),
          field('body', 'Descripción', '.tt-watch-desc', 'Relojes de acero inoxidable de alta calidad. Diseños elegantes, modernos y femeninos que se adaptan a cada estilo — del casual al más sofisticado.', { type: 'multiline', rows: 5, maxLength: 1200 }),
          field('btnText', 'Texto del botón', 'a.tt-btn', 'VER RELOJES →', { maxLength: 80 }),
          field('btnHref', 'Enlace del botón', 'a.tt-btn', 'catalogo.html?cat=relojes', { type: 'href', maxLength: 500 }),
        ],
      },
      products_header: {
        label: 'Encabezado de productos',
        root: '.tt-products-section .tt-products-header',
        fields: [
          field('eyebrow', 'Texto pequeño', '.tt-section-sub', 'Nuestros productos', { maxLength: 120 }),
          field('title', 'Título', '.tt-section-title', 'MIRÁ TODO LO MÁS VENDIDO', { maxLength: 180 }),
        ],
      },
      reviews: {
        label: 'Reseñas',
        root: '.tt-reviews-section',
        allowVisibility: true,
        fields: [
          field('eyebrow', 'Texto pequeño', '.tt-reviews-header .tt-section-sub', 'Ellas ya eligieron brillar', { maxLength: 120 }),
          field('title', 'Título', '.tt-reviews-header .tt-section-title', 'TINTINAS QUE YA NOS ELIGIERON', { maxLength: 180 }),
          field('items.0.text', 'Reseña 1', '.tt-review-text', 'Me enamoré desde el primer momento. La calidad es increíble y todo llegó precioso.', { index: 0, type: 'multiline', rows: 4, maxLength: 900 }),
          field('items.0.name', 'Reseña 1 — nombre', '.tt-review-name', 'Valentina M.', { index: 0, maxLength: 100 }),
          field('items.0.product', 'Reseña 1 — producto', '.tt-review-product', 'Reloj Alissia', { index: 0, maxLength: 120 }),
          field('items.1.text', 'Reseña 2', '.tt-review-text', 'La atención fue excepcional. Me ayudaron a elegir y llegó el mismo día.', { index: 1, type: 'multiline', rows: 4, maxLength: 900 }),
          field('items.1.name', 'Reseña 2 — nombre', '.tt-review-name', 'Camila R.', { index: 1, maxLength: 100 }),
          field('items.1.product', 'Reseña 2 — producto', '.tt-review-product', 'Colección Collares', { index: 1, maxLength: 120 }),
          field('items.2.text', 'Reseña 3', '.tt-review-text', 'Los precios son súper accesibles para la calidad. Todo llegó perfecto y bien presentado.', { index: 2, type: 'multiline', rows: 4, maxLength: 900 }),
          field('items.2.name', 'Reseña 3 — nombre', '.tt-review-name', 'Lucía P.', { index: 2, maxLength: 100 }),
          field('items.2.product', 'Reseña 3 — producto', '.tt-review-product', 'Brazaletes & Pulseras', { index: 2, maxLength: 120 }),
        ],
      },
      footer: {
        label: 'Pie de página global',
        root: '.tt-footer',
        global: true,
        fields: [
          field('tagline', 'Descripción de la marca', '.tt-footer-tagline', 'Accesorios femeninos elegantes con brillo propio. Somos tu boutique online de confianza en Paraguay.', { type: 'multiline', rows: 3, maxLength: 500 }),
          field('waText', 'Texto del botón WhatsApp', '.tt-footer-wa-text', 'Escribirnos por WhatsApp', { maxLength: 100 }),
          field('copy', 'Copyright', '.tt-footer-bottom', '© 2024-2026 TINTIN ACCESORIOS — TODOS LOS DERECHOS RESERVADOS', { maxLength: 180 }),
        ],
      },
    },
  },

  nosotros: {
    label: 'Nosotros',
    path: 'about.html',
    sections: {
      hero: {
        label: 'Encabezado',
        root: '.tt-page-hero',
        fields: [
          field('eyebrow', 'Texto pequeño', '.tt-section-sub', 'Conocenos', { maxLength: 120 }),
          field('title', 'Título', '.tt-page-hero-title', '¡Hola Tintina!', { maxLength: 180 }),
          field('desc', 'Descripción', '.tt-page-hero-sub', 'Te contamos nuestra historia con todo el amor que ponemos cada día en lo que hacemos.', { type: 'multiline', rows: 3, maxLength: 500 }),
        ],
      },
      historia: {
        label: 'Nuestra historia',
        root: '.tt-about-section',
        allowVisibility: true,
        fields: [
          field('eyebrow', 'Subtítulo', '.tt-about-subtitle', 'Te contamos nuestra historia', { maxLength: 160 }),
          field('title', 'Título', '.tt-about-greeting', 'Nuestra historia', { maxLength: 180 }),
          field('date', 'Fecha / dato destacado', '.tt-about-date', '📅 Fundada el 8 de septiembre de 2024', { maxLength: 180 }),
          field('paragraphs.0', 'Párrafo 1', '.tt-about-text', 'Tintin Accesorios & Relojes nació del amor por los accesorios femeninos y del deseo de acercar opciones lindas a todo Paraguay.', { index: 0, type: 'multiline', rows: 5, maxLength: 1600 }),
          field('paragraphs.1', 'Párrafo 2', '.tt-about-text', 'Cada pieza es elegida con cuidado para reflejar un estilo moderno, femenino y con personalidad.', { index: 1, type: 'multiline', rows: 5, maxLength: 1600 }),
          field('paragraphs.2', 'Párrafo 3', '.tt-about-text', 'Creemos que toda mujer merece sentirse linda todos los días, sin importar la ocasión.', { index: 2, type: 'multiline', rows: 5, maxLength: 1600 }),
          field('paragraphs.3', 'Párrafo 4', '.tt-about-text', 'Nuestra misión es acompañarte con atención personalizada y detalles que hagan especial cada compra.', { index: 3, type: 'multiline', rows: 5, maxLength: 1600 }),
          field('paragraphs.4', 'Párrafo 5', '.tt-about-text', 'Realizamos envíos en Zona Central y a todo el país.', { index: 4, type: 'multiline', rows: 4, maxLength: 1200 }),
          field('signature', 'Firma', '.tt-about-signature', 'Con amor, Bárbara Ruiz. 🌹', { maxLength: 180 }),
        ],
      },
    },
  },

  catalogo: {
    label: 'Catálogo',
    path: 'catalogo.html',
    sections: {
      header: {
        label: 'Encabezado general',
        root: '.catalog-header, .tt-page-hero',
        fields: [
          field('eyebrow', 'Texto pequeño', '#cat-subtitulo', 'Encontrá tu favorito', { maxLength: 160 }),
          field('title', 'Título', '#cat-titulo', 'Todos los productos', { maxLength: 180 }),
          field('desc', 'Descripción', '#cat-subtitulo', 'Explorá el catálogo completo de Tintin.', { type: 'multiline', rows: 3, maxLength: 500 }),
        ],
      },
    },
  },

  collections: {
    label: 'Página de colecciones',
    path: 'collections.html',
    sections: {
      header: {
        label: 'Encabezado',
        root: '.tt-page-hero',
        fields: headerFields('Explorá', 'Nuestras Colecciones', 'Encontrá accesorios para cada estilo.'),
      },
    },
  },

  contact: {
    label: 'Contacto',
    path: 'contact.html',
    sections: {
      header: {
        label: 'Encabezado',
        root: '.tt-page-hero',
        fields: headerFields('Estamos para ayudarte', '¿Dudas o consultas?', 'Escribinos y en Tintin te ayudamos con gusto. Tu satisfacción es lo más importante para nosotras.'),
      },
      form: {
        label: 'Formulario y contacto directo',
        root: '.tt-contact-section',
        fields: [
          field('formTitle', 'Título del formulario', '.tt-contact-form-title', 'Envianos un mensaje', { maxLength: 160 }),
          field('formDesc', 'Descripción del formulario', '.tt-contact-form-sub', 'Completá el formulario y te respondemos por WhatsApp a la brevedad.', { type: 'multiline', rows: 3, maxLength: 500 }),
          field('successText', 'Mensaje de éxito', '#form-success', '✅ ¡Gracias por tu mensaje! Serás redirigida a WhatsApp para completar tu consulta.', { type: 'multiline', rows: 3, maxLength: 500 }),
          field('submitText', 'Texto del botón', '#contact-form button[type="submit"]', 'Enviar por WhatsApp 💬', { maxLength: 100 }),
          field('directTitle', 'Título de contacto directo', '.tt-contact-alt-title', '¿Preferís escribirnos directo?', { maxLength: 180 }),
          field('directDesc', 'Descripción de contacto directo', '.tt-contact-alt-desc', 'La forma más rápida de recibir atención es escribirnos directo por WhatsApp.', { type: 'multiline', rows: 4, maxLength: 700 }),
          field('directButtonText', 'Texto del botón directo', '.tt-contact-wa-link', 'Abrir WhatsApp ahora', { maxLength: 100 }),
        ],
      },
    },
  },

  envios: {
    label: 'Envíos',
    path: 'envios.html',
    sections: {
      header: {
        label: 'Encabezado',
        root: '.tt-page-hero',
        fields: headerFields('Información', 'Política de Envíos 🚚', 'Todo lo que necesitás saber sobre cómo te llegará tu pedido.'),
      },
      details: {
        label: 'Información de envíos',
        root: '.tt-page-hero + .section .container',
        fields: [
          field('blocks.0.title', 'Delivery — título', '.tt-info-title', 'Delivery — Zona Central', { index: 0, maxLength: 180 }),
          field('blocks.0.body', 'Delivery — descripción', '.tt-info-block > p', 'Realizamos delivery a domicilio en Asunción, Gran Asunción y zonas aledañas.', { index: 0, type: 'multiline', rows: 4, maxLength: 900 }),
          field('blocks.1.title', 'Encomienda — título', '.tt-info-title', 'Encomienda — Interior del País', { index: 1, maxLength: 180 }),
          field('blocks.1.body', 'Encomienda — descripción', '.tt-info-block > p', 'Enviamos al interior de Paraguay mediante empresas de transporte.', { index: 1, type: 'multiline', rows: 4, maxLength: 900 }),
          field('blocks.2.title', 'Retiro — título', '.tt-info-title', 'Retiro en Tienda — Gratis', { index: 2, maxLength: 180 }),
          field('blocks.2.body', 'Retiro — descripción', '.tt-info-block > p', 'Podés retirar tu pedido sin costo en San Lorenzo. Coordinamos día y hora por WhatsApp.', { index: 2, type: 'multiline', rows: 4, maxLength: 900 }),
          field('blocks.3.title', 'Preparación — título', '.tt-info-title', 'Tiempos de preparación', { index: 3, maxLength: 180 }),
          field('blocks.3.body', 'Preparación — descripción', '.tt-info-block > p', 'Los pedidos se preparan según disponibilidad y horario de confirmación.', { index: 3, type: 'multiline', rows: 4, maxLength: 900 }),
          field('blocks.4.title', 'Seguimiento — título', '.tt-info-title', 'Seguimiento', { index: 4, maxLength: 180 }),
          field('blocks.4.body', 'Seguimiento — descripción', '.tt-info-block > p', 'Te avisamos por WhatsApp cuando tu pedido sale para entrega.', { index: 4, type: 'multiline', rows: 4, maxLength: 900 }),
          field('ctaText', 'Texto del botón', 'a.tt-btn', '💬 Consultanos por WhatsApp', { maxLength: 120 }),
        ],
      },
    },
  },

  faq: {
    label: 'Preguntas frecuentes',
    path: 'preguntas-frecuentes.html',
    sections: {
      header: {
        label: 'Encabezado',
        root: '.tt-page-hero',
        fields: headerFields('Ayuda', 'Preguntas Frecuentes 💬', 'Encontrá respuestas rápidas a las dudas más comunes.'),
      },
      questions: {
        label: 'Preguntas y respuestas',
        root: '.tt-page-hero + .section .container',
        fields: [
          faqField('categories.0', 'Categoría 1', '.tt-info-title', 0, 'Compras', 'text'),
          faqField('questions.0.q', 'Pregunta 1', '.tt-faq-q', 0, '¿Cómo hago un pedido?', 'text'),
          faqField('questions.0.a', 'Respuesta 1', '.tt-faq-a', 0, 'Elegí los productos, agregalos al carrito y completá el checkout con tus datos.'),
          faqField('questions.1.q', 'Pregunta 2', '.tt-faq-q', 1, '¿Solo hay 1 unidad por modelo?', 'text'),
          faqField('questions.1.a', 'Respuesta 2', '.tt-faq-a', 1, 'La disponibilidad depende de cada modelo. El stock que ves en la tienda se actualiza con el catálogo.'),
          faqField('questions.2.q', 'Pregunta 3', '.tt-faq-q', 2, '¿Puedo reservar un producto?', 'text'),
          faqField('questions.2.a', 'Respuesta 3', '.tt-faq-a', 2, 'Podés consultarnos por WhatsApp para conocer las condiciones de reserva.'),
          faqField('categories.1', 'Categoría 2', '.tt-info-title', 1, 'Métodos de pago', 'text'),
          faqField('questions.3.q', 'Pregunta 4', '.tt-faq-q', 3, '¿Qué formas de pago aceptan?', 'text'),
          faqField('questions.3.a', 'Respuesta 4', '.tt-faq-a', 3, 'Los métodos habilitados aparecen en el checkout al confirmar tu pedido.'),
          faqField('questions.4.q', 'Pregunta 5', '.tt-faq-q', 4, '¿Puedo pagar con tarjeta?', 'text'),
          faqField('questions.4.a', 'Respuesta 5', '.tt-faq-a', 4, 'Consultanos por WhatsApp para conocer las opciones disponibles.'),
          faqField('categories.2', 'Categoría 3', '.tt-info-title', 2, 'Envíos', 'text'),
          faqField('questions.5.q', 'Pregunta 6', '.tt-faq-q', 5, '¿Hacen delivery a domicilio?', 'text'),
          faqField('questions.5.a', 'Respuesta 6', '.tt-faq-a', 5, 'Sí. También hacemos envíos al interior por encomienda.'),
          faqField('questions.6.q', 'Pregunta 7', '.tt-faq-q', 6, '¿Cuánto cuesta el envío?', 'text'),
          faqField('questions.6.a', 'Respuesta 7', '.tt-faq-a', 6, 'El costo se calcula según la ciudad y el método elegidos en el checkout.'),
          faqField('questions.7.q', 'Pregunta 8', '.tt-faq-q', 7, '¿Cuánto tarda en llegar?', 'text'),
          faqField('questions.7.a', 'Respuesta 8', '.tt-faq-a', 7, 'El tiempo depende del destino y del método de envío.'),
          faqField('categories.3', 'Categoría 4', '.tt-info-title', 3, 'Productos', 'text'),
          faqField('questions.8.q', 'Pregunta 9', '.tt-faq-q', 8, '¿Los materiales son de calidad?', 'text'),
          faqField('questions.8.a', 'Respuesta 9', '.tt-faq-a', 8, 'En cada producto indicamos su material y características.'),
          faqField('questions.9.q', 'Pregunta 10', '.tt-faq-q', 9, '¿Tienen garantía los productos?', 'text'),
          faqField('questions.9.a', 'Respuesta 10', '.tt-faq-a', 9, 'Consultá las condiciones vigentes antes de comprar o escribinos por WhatsApp.'),
          faqField('categories.4', 'Categoría 5', '.tt-info-title', 4, 'Contacto', 'text'),
          faqField('questions.10.q', 'Pregunta 11', '.tt-faq-q', 10, '¿Cómo me comunico con ustedes?', 'text'),
          faqField('questions.10.a', 'Respuesta 11', '.tt-faq-a', 10, 'Podés escribirnos por WhatsApp o Instagram.'),
          field('ctaPrompt', 'Texto antes del botón', '.tt-page-hero + .section .container > div:last-child p', '¿No encontraste lo que buscabas?', { maxLength: 220 }),
          field('ctaText', 'Texto del botón', '.tt-page-hero + .section .container > div:last-child a.tt-btn', '💬 Escribinos por WhatsApp', { maxLength: 120 }),
        ],
      },
    },
  },

  cambios: {
    label: 'Cambios y devoluciones',
    path: 'cambios-devoluciones.html',
    sections: {
      header: {
        label: 'Encabezado',
        root: '.tt-page-hero',
        fields: headerFields('Información', 'Cambios y Devoluciones 🔄', 'Tu satisfacción es nuestra prioridad. Si algo no está perfecto, lo resolvemos juntas.'),
      },
      policy: {
        label: 'Política',
        root: '.tt-page-hero + .section .container',
        fields: [
          field('blocks.0.title', 'Bloque 1 — título', '.tt-info-title', '¿Cuándo puedo pedir un cambio?', { index: 0, maxLength: 180 }),
          field('blocks.0.body', 'Bloque 1 — descripción', '.tt-info-block > p', 'Aceptamos cambios dentro del plazo y bajo las condiciones publicadas por Tintin.', { index: 0, type: 'multiline', rows: 4, maxLength: 1200 }),
          field('blocks.1.title', 'Bloque 2 — título', '.tt-info-title', '¿Cómo solicito un cambio?', { index: 1, maxLength: 180 }),
          field('blocks.2.title', 'Bloque 3 — título', '.tt-info-title', 'Devoluciones', { index: 2, maxLength: 180 }),
          field('blocks.2.body', 'Bloque 3 — descripción', '.tt-info-block > p', 'Si recibiste un producto con falla o diferente al pedido, escribinos para revisar el caso.', { index: 1, type: 'multiline', rows: 4, maxLength: 1200 }),
          field('blocks.3.title', 'Bloque 4 — título', '.tt-info-title', '¿Qué no tiene cambio?', { index: 3, maxLength: 180 }),
          field('blocks.4.title', 'Bloque 5 — título', '.tt-info-title', 'Reembolsos', { index: 4, maxLength: 180 }),
          field('blocks.4.body', 'Bloque 5 — descripción', '.tt-info-block > p', 'Los reembolsos aprobados se coordinan por el medio acordado con la clienta.', { index: 3, type: 'multiline', rows: 4, maxLength: 1200 }),
          field('ctaText', 'Texto del botón', 'a.tt-btn', '💬 Contactanos por WhatsApp', { maxLength: 120 }),
        ],
      },
    },
  },
});

export function getPageSchema(pageId) {
  return SITE_CONTENT_SCHEMA[pageId] || null;
}

export function getSectionSchema(pageId, sectionId) {
  return getPageSchema(pageId)?.sections?.[sectionId] || null;
}

export function getNested(object, dottedKey) {
  return String(dottedKey).split('.').reduce((value, part) =>
    value == null ? undefined : value[part], object);
}

export function setNested(object, dottedKey, value) {
  const parts = String(dottedKey).split('.');
  let cursor = object;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      cursor[part] = value;
      return;
    }
    const nextPart = parts[index + 1];
    if (cursor[part] == null) cursor[part] = /^\d+$/.test(nextPart) ? [] : {};
    cursor = cursor[part];
  });
  return object;
}

export function getSectionDefaults(pageId, sectionId) {
  const schema = getSectionSchema(pageId, sectionId);
  if (!schema) return {};
  const output = {};
  if (schema.allowVisibility) output.visible = true;
  schema.fields.forEach(item => setNested(output, item.key, item.default ?? ''));
  return output;
}

export function getPageDefaults(pageId) {
  const page = getPageSchema(pageId);
  if (!page) return {};
  return Object.fromEntries(
    Object.keys(page.sections).map(sectionId => [sectionId, getSectionDefaults(pageId, sectionId)])
  );
}

export function mergeContent(defaults, saved) {
  if (Array.isArray(defaults)) {
    const incoming = Array.isArray(saved) ? saved : [];
    return defaults.map((value, index) => mergeContent(value, incoming[index]));
  }
  if (defaults && typeof defaults === 'object') {
    const incoming = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    const output = {};
    Object.keys(defaults).forEach(key => {
      output[key] = mergeContent(defaults[key], incoming[key]);
    });
    return output;
  }
  return saved === undefined || saved === null ? defaults : saved;
}

export function sanitizeContentText(value, maxLength = CONTENT_MAX_LENGTH) {
  return String(value == null ? '' : value)
    .replace(/\u0000/g, '')
    .slice(0, Math.max(0, Number(maxLength) || CONTENT_MAX_LENGTH));
}

export function sanitizeContentHref(value, fallback = '') {
  const candidate = sanitizeContentText(value, 500).trim();
  if (!candidate) return '';
  if (/['"<>\u0000-\u001f\u007f]/.test(candidate)) return fallback;
  if (/^(?:javascript|data|vbscript|file):/i.test(candidate)) return fallback;

  try {
    const parsed = new URL(candidate, window.location.href);
    if (!['http:', 'https:'].includes(parsed.protocol)) return fallback;
    if (candidate.startsWith('//')) return fallback;
    if (parsed.origin !== window.location.origin && !/^https:\/\//i.test(candidate)) return fallback;
    return candidate;
  } catch {
    return fallback;
  }
}

export function sanitizeSection(pageId, sectionId, sectionValue = {}) {
  const schema = getSectionSchema(pageId, sectionId);
  if (!schema) return {};
  const clean = {};
  if (schema.allowVisibility) clean.visible = sectionValue.visible !== false;
  schema.fields.forEach(item => {
    const raw = getNested(sectionValue, item.key);
    const fallback = item.default ?? '';
    const value = item.type === 'href'
      ? sanitizeContentHref(raw == null ? fallback : raw, fallback)
      : sanitizeContentText(raw == null ? fallback : raw, item.maxLength);
    setNested(clean, item.key, value);
  });
  return clean;
}

export function detectContentPageId(pathname = window.location.pathname) {
  const raw = String(pathname || '').toLowerCase().replace(/\/+$/, '');
  const file = raw.split('/').pop() || '';
  return PAGE_PATH_TO_ID[file] || (raw === '' ? 'index' : null);
}
