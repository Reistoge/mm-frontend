/**
 * Component Patterns Design System — GitHub Primer styling.
 * Flat 1px borders, 6px radius, no backdrop-blur / heavy shadows.
 */

export const components = {
  // Button Variants (Primer Btn: 5px 16px, 14px medium, 6px radius, 1px border)
  button: {
    primary:
      'px-4 py-[5px] rounded-md bg-[var(--accent-emphasis)] text-white text-sm font-medium border border-[var(--borderColor-default)] hover:brightness-110 transition',
    primarySmall:
      'px-3 py-[3px] rounded-md text-xs bg-[var(--accent-emphasis)] text-white font-medium border border-[var(--borderColor-default)] hover:brightness-110 transition',
    secondary:
      'px-3 py-[5px] rounded-md text-sm border border-[var(--borderColor-default)] bg-[var(--bgColor-default)] text-[var(--fgColor-default)] font-medium hover:bg-[var(--bgColor-muted)] transition',
    success:
      'px-3 py-[5px] rounded-md text-sm bg-[var(--success-emphasis)] text-white font-medium border border-[var(--borderColor-default)] hover:brightness-110 transition',
    danger:
      'px-3 py-[5px] rounded-md text-sm bg-[var(--danger-emphasis)] text-white font-medium border border-[var(--borderColor-default)] hover:brightness-110 transition',
    dangerSmall:
      'px-3 py-[3px] rounded-md bg-[var(--danger-emphasis)] text-white text-xs font-medium border border-[var(--borderColor-default)] hover:brightness-110 transition',
    icon: 'px-3 py-[5px] bg-[var(--bgColor-default)] border border-[var(--borderColor-default)] rounded-md text-xs font-medium text-[var(--fgColor-default)] hover:bg-[var(--bgColor-muted)] transition-colors flex items-center gap-1.5',
    neutral:
      'px-3 py-[5px] rounded-md text-sm border border-[var(--borderColor-default)] bg-[var(--bgColor-default)] transition hover:bg-[var(--bgColor-muted)]',
    neutralDark:
      'px-3 py-[5px] rounded-md text-sm bg-[var(--bgColor-emphasis)] text-white font-medium border border-[var(--borderColor-default)]',
  },

  // Card Variants (Primer Box)
  card: {
    default:
      'bg-[var(--bgColor-default)] rounded-md border border-[var(--borderColor-default)] p-4',
    padding: 'p-4',
    paddingSmall: 'p-3',
  },

  // Container/Layout (GitHub page width)
  container: {
    maxWidth: 'max-w-[1280px] mx-auto px-6 py-6',
  },

  // Grid Layouts
  grid: {
    responsive: 'grid md:grid-cols-2 gap-4',
    twoCol: 'md:grid-cols-2',
  },

  // Flex Utilities
  flex: {
    center: 'flex items-center justify-center',
    between: 'flex items-center justify-between',
    start: 'flex items-start justify-between',
    wrap: 'flex flex-wrap',
  },

  // Legend/Indicator (Primer popover card, flat)
  legend: {
    container:
      'absolute top-4 left-4 bg-[var(--bgColor-default)] p-4 rounded-md text-sm border border-[var(--borderColor-default)] max-w-xs z-10',
    row: 'flex items-center gap-2',
    indicator: 'w-3 h-3 rounded-full',
    text: 'text-[var(--fgColor-muted)]',
    divider: 'mt-4 pt-3 border-t border-[var(--borderColor-muted)]',
  },

  // Input Field (Primer FormControl)
  input: {
    default:
      'flex-1 border border-[var(--borderColor-default)] rounded-md px-3 py-[5px] text-sm bg-[var(--bgColor-default)] text-[var(--fgColor-default)] placeholder:text-[var(--fgColor-muted)] focus:outline-none focus:border-[var(--accent-fg)] focus:ring-1 focus:ring-[var(--accent-fg)]',
  },

  // Link
  link: {
    primary: 'text-[var(--accent-fg)] hover:underline text-sm',
  },

  // Loading State
  loading: {
    overlay:
      'absolute inset-0 bg-[var(--bgColor-default)]/80 flex flex-col items-center justify-center z-50',
    spinner:
      'w-8 h-8 border-4 border-[var(--accent-fg)] border-t-transparent rounded-full animate-spin mb-2',
    text: 'text-[var(--accent-fg)] font-medium',
  },

  // Error State (Primer Banner)
  error: {
    overlay:
      'absolute inset-0 flex items-center justify-center bg-[var(--danger-muted)] z-50 text-[var(--danger-fg)]',
  },

  // Download Button
  downloadButton:
    'px-3 py-[5px] bg-[var(--bgColor-default)] border border-[var(--borderColor-default)] rounded-md text-xs font-medium text-[var(--fgColor-default)] hover:bg-[var(--bgColor-muted)] transition-colors flex items-center gap-1.5',

  // UnderlineNav (GitHub tab navigation)
  tabNav: {
    container: 'flex gap-1 border-b border-[var(--borderColor-default)] overflow-x-auto',
    item: 'UnderlineNav-item px-3 py-2 text-sm whitespace-nowrap text-[var(--fgColor-default)] hover:bg-[var(--bgColor-muted)] rounded-t-md transition-colors',
  },

  // Counter / Label (Primer pill)
  counter:
    'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--counter-bg)] text-[var(--fgColor-default)] tabular',
  label:
    'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border border-[var(--borderColor-default)] text-[var(--fgColor-muted)]',
};
