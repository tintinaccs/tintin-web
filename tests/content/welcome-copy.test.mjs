import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WELCOME_STEPS, normalizeWelcomeConfig, normalizeWelcomeStep, welcomeIconSvg } from '../../js/components/welcome/configuracion-bienvenida.js';

test('las cuatro frases base anteriores se actualizan conservando identidad, orden y visibilidad', () => {
  const old = [
    ['Bienvenida a Tintin','Te cuento rapidito cómo comprar y encontrar tus accesorios favoritos sin perderte.','🌸'],
    ['Explorá la tienda','Desde “Tienda” podés ver relojes, aros, collares, bags, pulseras y más.','🛍️'],
    ['Agregá al carrito','Cuando veas algo que te guste, agregalo al carrito. Tu carrito se mantiene sincronizado al iniciar sesión.','🛒'],
    ['Finalizá tu pedido','Completá tus datos de entrega y pago. Si necesitás ayuda, también podés escribirnos por WhatsApp.','✨']
  ];
  const stored = {title:'Mensaje de bienvenida',subtitle:'Tu primera guía Tintin',steps:old.map(([title,text,icon],i)=>({id:`saved-${i}`,title,text,icon,active:i!==1}))};
  const result = normalizeWelcomeConfig(stored);
  assert.equal(result.title,'Tintin');
  assert.equal(result.subtitle,'Cómo comprar');
  result.steps.forEach((step,i)=>{
    assert.equal(step.id,`saved-${i}`);
    assert.equal(step.active,i!==1);
    assert.equal(step.title,DEFAULT_WELCOME_STEPS[i].title);
    assert.equal(step.text,DEFAULT_WELCOME_STEPS[i].text);
    assert.equal(step.icon,DEFAULT_WELCOME_STEPS[i].icon);
  });
  assert.deepEqual(normalizeWelcomeConfig(result),result);
  assert.equal(stored.steps[1].title,'Explorá la tienda');
});

test('una edición propia conserva sus textos, imagen, emoji y botón; SVG sólo admite iconos propios', t => {
  globalThis.window={location:new URL('https://welcome.test/')};
  t.after(()=>{delete globalThis.window;});
  const step={id:'my-step',title:'Texto propio',text:'Mi indicación de compra.',icon:'♥',image:'https://example.test/photo.png',cta:'Mi acción',active:false};
  assert.deepEqual(normalizeWelcomeStep(step),step);
  const config=normalizeWelcomeConfig({title:'Mi encabezado',subtitle:'Mi contexto',steps:[step]});
  assert.equal(config.title,'Mi encabezado');assert.equal(config.subtitle,'Mi contexto');
  for(const value of ['<svg onload=alert(1)>','constructor','toString','♥'])assert.equal(welcomeIconSvg(value),'');
  for(const icon of DEFAULT_WELCOME_STEPS.map(step=>step.icon)){
    assert.match(welcomeIconSvg(icon),/^<svg /);
    assert.doesNotMatch(welcomeIconSvg(icon),/onload|script|https:/);
  }
});
