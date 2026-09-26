/**
 * Color Design System — GitHub Primer functional tokens.
 * Classes reference CSS vars from styles.css so light/dark switch via
 * `data-color-mode` with no `dark:` variants needed.
 */

export const colors = {
  // Primary Actions (Primer Btn-primary)
  primary: {
    bg: 'bg-[var(--accent-emphasis)]',
    bgHover: 'hover:brightness-110',
    text: 'text-[var(--accent-fg)]',
    border: 'border-[var(--accent-emphasis)]',
  },

  // Success/Positive Actions
  success: {
    bg: 'bg-[var(--success-emphasis)]',
    bgHover: 'hover:brightness-110',
    text: 'text-[var(--success-fg)]',
    border: 'border-[var(--success-emphasis)]',
  },

  // Danger/Destructive Actions
  danger: {
    bg: 'bg-[var(--danger-emphasis)]',
    bgHover: 'hover:brightness-110',
    text: 'text-[var(--danger-fg)]',
    border: 'border-[var(--danger-emphasis)]',
  },

  // Neutral/Secondary Actions (Primer Btn-default)
  neutral: {
    bg: 'bg-[var(--bgColor-default)]',
    bgHover: 'hover:bg-[var(--bgColor-muted)]',
    text: 'text-[var(--fgColor-default)]',
    border: 'border-[var(--borderColor-default)]',
    dark: 'bg-[var(--bgColor-emphasis)]',
    darkHover: 'hover:brightness-110',
  },

  // Background Colors
  background: {
    primary: 'bg-[var(--bgColor-default)]',
    secondary: 'bg-[var(--bgColor-muted)]',
    light: 'bg-[var(--bgColor-muted)]',
    inset: 'bg-[var(--bgColor-inset)]',
  },

  // Text Colors
  text: {
    primary: 'text-[var(--fgColor-default)]',
    secondary: 'text-[var(--fgColor-muted)]',
    muted: 'text-[var(--fgColor-muted)]',
    light: 'text-[var(--fgColor-muted)]',
    accent: 'text-[var(--accent-fg)]',
  },

  // Border Colors
  border: {
    primary: 'border-[var(--borderColor-default)]',
    light: 'border-[var(--borderColor-muted)]',
    muted: 'border-[var(--borderColor-default)]',
  },

  // Visualization/Graph Colors (Tailwind classes for legend dots)
  visualization: {
    folder: 'bg-[#eba924]',
    file: 'bg-[#59636e]',
    class: 'bg-[#8250df]',
    function: 'bg-[#1a7f37]',
  },

  // Visualization/Graph Colors (hex values for D3/SVG rendering).
  // Mid-tone Primer accents legible on both #fff and #0d1117 canvases.
  visualizationHex: {
    DIRECTORY: '#eba924',
    FILE: '#59636e',
    CLASS: '#8250df',
    FUNCTION: '#1a7f37',
    METHOD: '#1a7f37',
    MODULE: '#0969da',
  },

  // Overlay/Alert Colors
  overlay: {
    error: 'bg-[var(--danger-muted)]',
    errorText: 'text-[var(--danger-fg)]',
    loading: 'bg-[var(--bgColor-default)]/80',
  },

  // Interactive States
  interactive: {
    accent: 'accent-[#0969da]',
  },
};
