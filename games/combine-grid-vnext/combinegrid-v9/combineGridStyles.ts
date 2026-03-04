/* ⚠ UI CONTRACT PROTECTED
 This file is the single injection point for all Combine Grid tile animations.
 CSS values are built directly from uiTokens.ts — no manual sync required.
 Do not duplicate these keyframes elsewhere. Do not hardcode the token values.
*/

import {
  FACTOR_WARM_OUTLINE,
  FACTOR_WARM_GLOW,
  FACTOR_ONE_OUTLINE,
  FACTOR_ONE_GLOW,
  FACTOR_REVEAL_DURATION_MS,
} from './uiTokens';

const STYLE_ID = 'cg-tile-styles';

export function injectCombineGridStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return; // idempotent — never injects twice

  const css = `
    @keyframes bomb-spark {
      from { transform: translateY(0) scale(1);       opacity: 0.75; }
      to   { transform: translateY(-2px) scale(1.35); opacity: 1;    }
    }
    @keyframes bomb-heat {
      from { opacity: 0.5;  }
      to   { opacity: 0.95; }
    }
    @keyframes zap-jitter {
      0%   { transform: translate(0,0);      }
      25%  { transform: translate(2px,-2px); }
      50%  { transform: translate(-2px,1px); }
      75%  { transform: translate(1px,2px);  }
      100% { transform: translate(0,0);      }
    }
    @keyframes zap-flash {
      0%, 100% { filter: brightness(1);                 }
      50%      { filter: brightness(1.5) saturate(1.5); }
    }
    @keyframes factor-reveal {
      0%   { box-shadow: 0 0 0 0   rgba(249,115,22,0),    0 3px 0 rgba(0,0,0,0.22); }
      45%  { box-shadow: 0 0 0 3px rgba(249,115,22,0.65), 0 0 14px rgba(249,115,22,0.35), 0 3px 0 rgba(0,0,0,0.22); }
      100% { box-shadow: 0 0 0 2px ${FACTOR_WARM_OUTLINE}, 0 0 10px ${FACTOR_WARM_GLOW}, 0 3px 0 rgba(0,0,0,0.22); }
    }
    .factor-glow {
      animation: factor-reveal ${FACTOR_REVEAL_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes factor-reveal-one {
      0%   { box-shadow: 0 0 0 0   rgba(56,189,248,0),    0 3px 0 rgba(0,0,0,0.22); }
      45%  { box-shadow: 0 0 0 3px rgba(56,189,248,0.65), 0 0 14px rgba(56,189,248,0.30), 0 3px 0 rgba(0,0,0,0.22); }
      100% { box-shadow: 0 0 0 2px ${FACTOR_ONE_OUTLINE}, 0 0 10px ${FACTOR_ONE_GLOW}, 0 3px 0 rgba(0,0,0,0.22); }
    }
    .factor-glow-one {
      animation: factor-reveal-one ${FACTOR_REVEAL_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `;

  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = css;
  document.head.appendChild(el);
}
