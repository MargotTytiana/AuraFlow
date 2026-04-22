/**
 * StatusIndicator.ts
 * Renders a minimal status dot in the corner of the screen.
 *
 * Responsibilities:
 *  - Displaying the current hand-detection state (active / idle)
 *  - Reflecting the mute state with a distinct colour
 *  - Animating state transitions with CSS so JS stays minimal
 *  - Self-cleaning on dispose() with no DOM residue
 *
 * Visual states:
 *  - Gray   : no hand detected in the current frame
 *  - Green  : hand detected, gesture recognition active
 *  - Amber  : audio is muted (fist held or mute toggled in AppState)
 *
 * Design principle:
 *  The indicator must never draw attention to itself during normal use.
 *  It exists only to confirm the app is running and listening —
 *  a silent reassurance rather than a UI element to interact with.
 *  Size, opacity, and position are chosen to sit at the edge of
 *  peripheral vision without registering as a distraction.
 */

import type { AppState } from '../store/AppState';

// ─── Configuration ────────────────────────────────────────────────────────────

/** Diameter of the status dot in pixels. */
const DOT_SIZE_PX = 10;

/** Distance from the bottom and right viewport edges in pixels. */
const OFFSET_PX = 20;

/** Opacity when idle (no hand detected). Dimmer = less distracting. */
const OPACITY_IDLE   = 0.35;

/** Opacity when a hand is actively detected. */
const OPACITY_ACTIVE = 0.75;

/** CSS transition duration for all property changes. */
const TRANSITION = 'background 0.4s ease, opacity 0.4s ease, transform 0.3s ease';

// ─── Colour tokens ────────────────────────────────────────────────────────────

const COLOR_IDLE   = '#555557';   // neutral gray — no hand present
const COLOR_ACTIVE = '#4caf50';   // green — hand detected, audio running
const COLOR_MUTED  = '#f59e0b';   // amber — audio muted (fist or toggle)

// ─── StatusIndicator ─────────────────────────────────────────────────────────

export class StatusIndicator {
  private readonly dot: HTMLElement;

  /** Tracks detection state so mute colour is applied correctly. */
  private isDetecting = false;

  /** Cleanup function for the AppState mute subscription. */
  private unsubscribeMute: (() => void) | null = null;

  /**
   * @param state - Optional AppState instance. If provided, the indicator
   *                automatically reflects mute state changes without
   *                requiring external calls to setMuted().
   */
  constructor(private readonly state?: AppState) {
    this.dot = this.buildDot();
    document.body.appendChild(this.dot);

    if (state) {
      this.unsubscribeMute = state.on<boolean>(
        'isMuted',
        (muted) => this.onMuteChanged(muted),
      );
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Updates the indicator to reflect the current hand-detection state.
   * Called every frame by App.ts via the VisionCapture callbacks.
   *
   * @param active - True when landmarks were detected in the current frame.
   */
  setActive(active: boolean): void {
    this.isDetecting = active;

    // Mute colour takes priority over detection colour
    if (this.state?.isMuted) return;

    this.dot.style.background = active ? COLOR_ACTIVE : COLOR_IDLE;
    this.dot.style.opacity    = active ? String(OPACITY_ACTIVE) : String(OPACITY_IDLE);
    this.dot.style.transform  = active ? 'scale(1.2)' : 'scale(1)';
  }

  /**
   * Manually overrides the mute visual state.
   * Only needed when AppState is not injected in the constructor.
   *
   * @param muted - True to show the muted colour.
   */
  setMuted(muted: boolean): void {
    this.onMuteChanged(muted);
  }

  /**
   * Shows a brief first-use hint overlay that fades out automatically.
   * Rendered as a small tooltip above the dot — disappears after the
   * specified duration so it never clutters long sessions.
   *
   * @param message  - Short instruction string (keep under 30 chars).
   * @param duration - How long the hint stays visible in ms. Default: 3000.
   */
  showHint(message: string, duration = 3000): void {
    // Remove any existing hint before creating a new one
    document.getElementById('aura-hint')?.remove();

    const hint = document.createElement('div');
    hint.id = 'aura-hint';

    Object.assign(hint.style, {
      position:      'fixed',
      bottom:        `${OFFSET_PX + DOT_SIZE_PX + 10}px`,
      right:         `${OFFSET_PX}px`,
      padding:       '5px 10px',
      borderRadius:  '12px',
      background:    'rgba(255,255,255,0.08)',
      color:         'rgba(255,255,255,0.65)',
      fontSize:      '12px',
      pointerEvents: 'none',
      transition:    'opacity 0.5s ease',
      opacity:       '1',
      whiteSpace:    'nowrap',
    } satisfies Partial<CSSStyleDeclaration>);

    hint.textContent = message;
    document.body.appendChild(hint);

    // Fade out and remove after the specified duration
    setTimeout(() => {
      hint.style.opacity = '0';
      hint.addEventListener('transitionend', () => hint.remove(), { once: true });
    }, duration);
  }

  /**
   * Removes the dot from the DOM and cleans up all subscriptions.
   * Call when the application is torn down or the indicator is no
   * longer needed.
   */
  dispose(): void {
    this.dot.remove();
    document.getElementById('aura-hint')?.remove();
    this.unsubscribeMute?.();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Creates and styles the indicator dot element.
   * All styles are applied inline so the component has no external
   * CSS dependency and can be instantiated in any environment.
   */
  private buildDot(): HTMLElement {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true'); // decorative — no screen-reader value
    el.setAttribute('role', 'presentation');

    Object.assign(el.style, {
      position:     'fixed',
      bottom:       `${OFFSET_PX}px`,
      right:        `${OFFSET_PX}px`,
      width:        `${DOT_SIZE_PX}px`,
      height:       `${DOT_SIZE_PX}px`,
      borderRadius: '50%',
      background:   COLOR_IDLE,
      opacity:      String(OPACITY_IDLE),
      transition:   TRANSITION,
      pointerEvents:'none',
      zIndex:       '9999',
      transform:    'scale(1)',
    } satisfies Partial<CSSStyleDeclaration>);

    return el;
  }

  /**
   * Reacts to AppState mute changes.
   * When muted, shows amber regardless of detection state.
   * When unmuted, restores the correct detection colour.
   *
   * @param muted - New mute state from AppState.
   */
  private onMuteChanged(muted: boolean): void {
    if (muted) {
      this.dot.style.background = COLOR_MUTED;
      this.dot.style.opacity    = String(OPACITY_ACTIVE);
      this.dot.style.transform  = 'scale(1)';
    } else {
      // Restore detection colour based on the last known detection state
      this.setActive(this.isDetecting);
    }
  }
}