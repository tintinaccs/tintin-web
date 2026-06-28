// =============================================
// TINTIN ACCESORIOS — Onboarding Bot (Tina)
// =============================================

import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const STEPS = [
  {
    messages: [
      "¡Hola {name}! 👋 Soy Tina, tu asistente de Tintin Accesorios ✨",
      "Te voy a guiar en tu primera visita para que encuentres todo fácil 🌸"
    ],
    actions: [{ label: 'Siguiente →', next: 1 }]
  },
  {
    messages: [
      "Para ver todos nuestros productos, hacé clic en TIENDA en el menú de arriba 👆",
      "Tenemos relojes, aros, collares, bolsos y mucho más 💖"
    ],
    actions: [{ label: 'Siguiente →', next: 2 }]
  },
  {
    messages: [
      "¿Ya encontraste algo que te gustó? Agregalo al carrito con el botón + 🛒",
      "El ícono del carrito arriba a la derecha te muestra cuántas cosas tenés 🎀"
    ],
    actions: [{ label: 'Siguiente →', next: 3 }]
  },
  {
    messages: [
      "Para finalizar tu pedido, hacé clic en el carrito y luego en Finalizar compra 🎉",
      "Te vamos a ayudar paso a paso con la entrega y el pago 🌟"
    ],
    actions: [{ label: 'Siguiente →', next: 4 }]
  },
  {
    messages: [
      "¿Tenés dudas? ¡Escribinos por WhatsApp! Estamos de Lunes a Sábado 💬"
    ],
    actions: [
      { label: 'Ir a la tienda', href: 'catalogo.html' },
      { label: 'Finalizar', finish: true }
    ]
  }
];

/**
 * Initialize onboarding for the current user
 * @param {object} user - Firebase auth user
 * @param {string} userRole - user's role string
 */
export async function initOnboarding(user, userRole) {
  try {
    // Check if onboarding is enabled in settings
    const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
    const onboardingEnabled = settingsSnap.exists()
      ? settingsSnap.data().onboardingEnabled !== false
      : true; // default enabled if no settings doc

    if (!onboardingEnabled) return;

    // Check if user has completed onboarding
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    const onboardingCompleted = userSnap.exists()
      ? !!userSnap.data().onboardingCompleted
      : false;

    if (onboardingCompleted) return;

    // Inject and show onboarding
    injectOnboarding(user, userRole);
  } catch (e) {
    console.error('Onboarding init error:', e);
  }
}

async function markCompleted(uid) {
  try {
    await setDoc(doc(db, 'users', uid), {
      onboardingCompleted: true,
      onboardingCompletedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error('Error marking onboarding complete:', e);
  }
}

function injectOnboarding(user, userRole) {
  // Remove any existing instance
  const existing = document.getElementById('tt-onboarding');
  if (existing) existing.remove();

  const userName = user.displayName || user.email?.split('@')[0] || 'amiga';

  const modal = document.createElement('div');
  modal.id = 'tt-onboarding';
  modal.style.cssText = `
    position:fixed;bottom:90px;right:24px;z-index:9990;
    width:320px;max-width:calc(100vw - 32px);
    border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);
    font-family:'Poppins',sans-serif;
    animation: ttObSlideIn .4s cubic-bezier(.34,1.56,.64,1);
  `;

  modal.innerHTML = `
    <style>
      @keyframes ttObSlideIn {
        from { opacity:0; transform:translateY(20px) scale(.96); }
        to   { opacity:1; transform:translateY(0) scale(1); }
      }
      @keyframes ttObTyping {
        0%,80%,100% { transform:scale(0); }
        40% { transform:scale(1); }
      }
      .tt-ob-bubble {
        background:#b84c72;
        color:#fff;
        border-radius:12px 12px 12px 2px;
        padding:10px 14px;
        font-size:13px;
        line-height:1.5;
        max-width:90%;
        align-self:flex-start;
        animation: ttObSlideIn .3s ease;
      }
      .tt-ob-typing {
        display:flex;gap:4px;align-items:center;padding:10px 14px;
        background:#b84c72;border-radius:12px 12px 12px 2px;align-self:flex-start;
      }
      .tt-ob-typing span {
        width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.7);
        display:inline-block;animation:ttObTyping 1.2s infinite ease;
      }
      .tt-ob-typing span:nth-child(2) { animation-delay:.2s; }
      .tt-ob-typing span:nth-child(3) { animation-delay:.4s; }
      .tt-ob-action-btn {
        padding:8px 16px;border-radius:50px;border:none;cursor:pointer;
        font-family:'Poppins',sans-serif;font-size:12px;font-weight:700;
        text-transform:uppercase;letter-spacing:.06em;transition:all .2s;
        text-decoration:none;display:inline-block;
      }
      .tt-ob-action-btn-primary {
        background:#b84c72;color:#fff;
      }
      .tt-ob-action-btn-primary:hover { background:#9a3d5e; }
      .tt-ob-action-btn-outline {
        background:transparent;border:2px solid #b84c72;color:#b84c72;
      }
      .tt-ob-action-btn-outline:hover { background:#b84c72;color:#fff; }
    </style>
    <!-- Header -->
    <div style="background:#b84c72;color:#fff;border-radius:16px 16px 0 0;padding:14px 18px;display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:18px">🌸</div>
        <div>
          <div style="font-weight:700;font-size:14px">Tina — Asistente Tintin</div>
          <div style="font-size:11px;opacity:.8">● En línea ahora</div>
        </div>
      </div>
      <button id="tt-ob-close" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center">×</button>
    </div>
    <!-- Messages area -->
    <div id="tt-ob-messages" style="background:#fff;padding:16px;min-height:140px;max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:10px"></div>
    <!-- Actions -->
    <div id="tt-ob-actions" style="background:#fef5f8;border-radius:0 0 16px 16px;padding:12px 16px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"></div>
  `;

  document.body.appendChild(modal);

  let currentStep = 0;
  let messageQueue = [];
  let isTyping = false;

  const messagesEl = document.getElementById('tt-ob-messages');
  const actionsEl  = document.getElementById('tt-ob-actions');

  function addTypingIndicator() {
    const t = document.createElement('div');
    t.className = 'tt-ob-typing';
    t.id = 'tt-ob-typing-ind';
    t.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(t);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return t;
  }

  function removeTypingIndicator() {
    const t = document.getElementById('tt-ob-typing-ind');
    if (t) t.remove();
  }

  function addMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'tt-ob-bubble';
    bubble.textContent = text.replace('{name}', userName);
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderActions(step) {
    actionsEl.innerHTML = '';
    step.actions.forEach(action => {
      if (action.href) {
        const a = document.createElement('a');
        a.href = action.href;
        a.className = 'tt-ob-action-btn tt-ob-action-btn-outline';
        a.textContent = action.label;
        a.onclick = () => finishOnboarding();
        actionsEl.appendChild(a);
      } else {
        const btn = document.createElement('button');
        btn.className = 'tt-ob-action-btn tt-ob-action-btn-primary';
        btn.textContent = action.label;
        if (action.finish) {
          btn.onclick = () => finishOnboarding();
        } else if (action.next !== undefined) {
          btn.onclick = () => showStep(action.next);
        }
        actionsEl.appendChild(btn);
      }
    });
  }

  async function showStep(stepIdx) {
    if (stepIdx >= STEPS.length) { finishOnboarding(); return; }
    currentStep = stepIdx;
    actionsEl.innerHTML = '';

    const step = STEPS[stepIdx];
    for (let i = 0; i < step.messages.length; i++) {
      const typing = addTypingIndicator();
      await new Promise(r => setTimeout(r, 900 + Math.random() * 400));
      removeTypingIndicator();
      addMessage(step.messages[i]);
      if (i < step.messages.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    renderActions(step);
  }

  async function finishOnboarding() {
    modal.style.animation = 'none';
    modal.style.transition = 'opacity .3s,transform .3s';
    modal.style.opacity = '0';
    modal.style.transform = 'translateY(10px) scale(.96)';
    await markCompleted(user.uid);
    setTimeout(() => modal.remove(), 350);
  }

  // Close button
  document.getElementById('tt-ob-close').onclick = finishOnboarding;

  // Start with step 0
  showStep(0);
}
