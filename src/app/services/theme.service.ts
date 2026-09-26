import { Injectable, signal, computed, effect } from '@angular/core';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'mm-theme';

/**
 * GitHub-style color mode: light / dark / system.
 * Writes `data-color-mode` on <html>; Primer CSS vars in styles.css react to it.
 * SVG/ECharts call `effectiveMode()` / `isDark()` since canvas can't use CSS vars.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** User's stored preference; `system` follows the OS color scheme. */
  readonly choice = signal<ThemeChoice>(this.readStored());
  /** Live OS dark-mode state; updates when the OS scheme changes. */
  readonly systemDark = signal(
    typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  /** Resolved mode after applying the `system` fallback; drives `data-color-mode`. */
  readonly effectiveMode = computed<EffectiveTheme>(() => {
    const c = this.choice();
    if (c === 'light') return 'light';
    if (c === 'dark') return 'dark';
    return this.systemDark() ? 'dark' : 'light';
  });

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', (e) => this.systemDark.set(e.matches));
    }
    effect(() => {
      const mode = this.effectiveMode();
      document.documentElement.setAttribute('data-color-mode', mode);
      try {
        localStorage.setItem(STORAGE_KEY, this.choice());
      } catch {
        /* ignore */
      }
    });
  }

  /** Persists the user's color-mode preference and updates the document. */
  set(choice: ThemeChoice): void {
    this.choice.set(choice);
  }

  /** Flips between light and dark, resolving `system` to its effective mode first. */
  toggle(): void {
    this.set(this.effectiveMode() === 'dark' ? 'light' : 'dark');
  }

  /** True when the resolved mode is dark (for canvas code that can't use CSS vars). */
  isDark(): boolean {
    return this.effectiveMode() === 'dark';
  }

  private readStored(): ThemeChoice {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
    } catch {
      return 'system';
    }
  }
}
