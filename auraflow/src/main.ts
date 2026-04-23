/**
 * main.ts
 * Application entry point — the first module executed by the browser.
 *
 * Responsibilities:
 *  - Rendering the single start button required by browser autoplay policy
 *  - Bootstrapping App inside the button's click handler so that:
 *      a) getUserMedia camera permission is requested within a user gesture
 *      b) AudioContext is created and resumed within the same gesture
 *  - Catching and displaying top-level initialisation errors
 *  - Registering the PWA service worker (production builds only)
 *
 * Why a start button?
 *  Browsers require a user gesture before granting camera access and before
 *  allowing AudioContext to produce sound. A single click satisfies both
 *  requirements simultaneously, avoiding a two-step permission flow.
 *  The button is removed from the DOM immediately after the click so it
 *  never reappears during the session.
 *
 * This file contains no business logic — it is purely a bootstrap shim.
 * All application logic lives in App.ts and the modules it assembles.
 */

import { App } from './App';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Text label shown on the start button. */
const START_LABEL = '开始体验';

/**
 * Error message prefix shown when initialisation fails.
 * Displayed inline in the DOM so the user sees it even if the
 * browser console is not open.
 */
const ERROR_PREFIX = '启动失败：';

// ─── PWA service worker registration ─────────────────────────────────────────

/**
 * Registers the Workbox-generated service worker for offline support
 * and PWA installability. Runs only in production (import.meta.env.PROD)
 * to avoid caching stale assets during development.
 *
 * vite-plugin-pwa generates the service worker at build time and
 * exposes it at /sw.js. Registration is deferred to 'load' so it does
 * not compete with critical resource fetches on first paint.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => {
        // Non-fatal — the app works without a service worker,
        // just without offline support.
        console.warn('[main] Service worker registration failed:', err);
      });
  });
}

// ─── Start button ─────────────────────────────────────────────────────────────

/**
 * Builds and appends the start button to the document body.
 * Styles are applied inline — no external CSS dependency at this stage
 * since styles.css may not yet be relevant before the app is running.
 */
function mountStartButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id          = 'start-btn';
  btn.textContent = START_LABEL;
  btn.setAttribute('aria-label', START_LABEL);
  document.body.appendChild(btn);
  return btn;
}

// ─── Error display ────────────────────────────────────────────────────────────

/**
 * Renders a user-facing error message when App.init() rejects.
 * Replaces the start button so the user is not left with a broken UI.
 *
 * @param err - The caught error or rejection reason.
 */
function showError(err: unknown): void {
  // Remove the start button if it is still present
  document.getElementById('start-btn')?.remove();

  const message = err instanceof Error ? err.message : String(err);

  const el = document.createElement('p');
  el.id          = 'start-error';
  el.textContent = `${ERROR_PREFIX}${message}`;

  Object.assign(el.style, {
    position:  'fixed',
    inset:     '0',
    margin:    'auto',
    height:    'fit-content',
    textAlign: 'center',
    color:     'rgba(255,100,100,0.85)',
    fontSize:  '14px',
    padding:   '0 24px',
  } satisfies Partial<CSSStyleDeclaration>);

  document.body.appendChild(el);
  console.error('[main] App initialisation failed:', err);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * Wires the start button to the App bootstrap sequence.
 * The { once: true } option ensures the handler fires exactly once
 * and is automatically removed afterward — no manual cleanup needed.
 */
const startBtn = mountStartButton();

startBtn.addEventListener(
  'click',
  async () => {
    // Remove the button immediately so a second click cannot fire
    // before init() resolves (e.g. on a slow camera permission prompt)
    startBtn.remove();

    try {
      const app = new App();

      // All module construction and camera start happens here,
      // inside the click handler, satisfying browser gesture requirements.
      await app.init();

    } catch (err) {
      showError(err);
    }
  },
  { once: true },
);