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
  readonly choice = signal<ThemeChoice>(this.readStored());
  readonly systemDark = signal(
    typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

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

  set(choice: ThemeChoice): void {
    this.choice.set(choice);
  }

  toggle(): void {
    this.set(this.effectiveMode() === 'dark' ? 'light' : 'dark');
  }

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
