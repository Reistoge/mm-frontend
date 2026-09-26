import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="min-h-screen bg-[var(--bgColor-muted)] text-[var(--fgColor-default)]">
      <header class="bg-[var(--header-bg)] text-[var(--header-fg)]">
        <div class="max-w-[1280px] mx-auto px-6 py-3 flex items-center gap-4">
          <a routerLink="/repos" class="flex items-center gap-2 font-semibold text-[14px]">
            <svg height="24" width="24" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path
                d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.73 1.95 0 1.41-.01 2.55-.01 2.9 0 .21-.15.46-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
              />
            </svg>
            <span>Modularity Metrics</span>
          </a>
          <nav class="flex items-center gap-1 text-[14px]">
            <a
              routerLink="/repos"
              class="px-3 py-1 rounded-md font-medium hover:bg-white/10 transition-colors"
              >Repositories</a
            >
          </nav>
          <div class="flex-1"></div>
          <button
            (click)="theme.toggle()"
            [title]="
              theme.effectiveMode() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            "
            class="px-2 py-1 rounded-md border border-white/20 text-[12px] font-medium hover:bg-white/10 transition-colors"
          >
            {{ theme.effectiveMode() === 'dark' ? 'Light' : 'Dark' }}
          </button>
        </div>
      </header>
      <router-outlet />
    </div>
  `,
})
/** Root component: GitHub-style header + router outlet. */
export class AppComponent {
  readonly theme = inject(ThemeService);
}
