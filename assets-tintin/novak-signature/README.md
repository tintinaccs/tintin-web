# Firma NOVAK

`novak-credit.css` y `novak-mark.svg` proceden de los archivos adjuntos por el titular. El SVG se conserva sin modificar; en el CSS sólo se adapta la familia fuente genérica del sistema a Montserrat para cumplir la identidad y el gate tipográfico de Tintín. Procedencia indicada: NOVAKPY/novak-web, tools/novak-signature, implementación inicial Quinta del Vergel PR10.

La fuente compartida del marcado y del destino es `scripts/lib/firma-novak.js`. Para cambiar el dominio, editar únicamente `NOVAK_URL` y ejecutar `npm run sync:public-shell`, seguido de los generadores y verificaciones habituales. No editar las copias HTML generadas.

La integración propia de Tintín está en `css/components/novak-credit-site.css`: superficie clara para el símbolo original y texto oscuro, sin importar la identidad visual de NOVAK. El kit conserva hover, foco y movimiento reducido. No hay scripts remotos ni seguimiento.

Cobertura: 17 documentos con interfaz, incluidos acceso, administración y error404 con rutas absolutas. `nosotros.html` redirige a `/about`; la verificación de Google es un documento técnico. No reciben un pie independiente.

Prueba: `npx playwright test tests/navigation/novak-credit.spec.js --project=chromium --retries=0`. Usa documentos/estilos reales con ejecución de aplicación desactivada; simula sólo la visibilidad autenticada del panel, sin certificar autenticación ni tocar datos.

La descarga del SVG se difiere mediante el pequeño script local `js/components/novak-credit.js` hasta128px del pie. Se reserva42×40px, la animación sigue siendo CSS y existe alternativa noscript con el mismo SVG. No se recomprime, redibuja ni modifica el símbolo para reducir su peso.
