/**
 * Typography Design System — GitHub Primer scale.
 * Base 14px/20px, semibold headings, tabular-nums for metrics.
 */

export const typography = {
  // Heading Sizes
  heading: {
    xl: 'text-2xl font-semibold tracking-tight',
    lg: 'text-lg font-semibold',
    md: 'text-base font-semibold',
    sm: 'text-sm font-semibold',
    xs: 'text-xs font-semibold',
  },

  // Body Text
  body: {
    base: 'text-sm',
    sm: 'text-sm',
    xs: 'text-xs',
  },

  // Page / section titles (GitHub Pagehead)
  pageTitle: 'text-xl font-semibold tracking-tight',
  sectionTitle: 'text-sm font-semibold',

  // KPI / metric numerals
  kpiValue: 'text-2xl font-semibold tabular',
  kpiLabel: 'text-xs font-medium uppercase tracking-wide',

  // Font Weights
  weight: {
    bold: 'font-semibold',
    semibold: 'font-semibold',
    medium: 'font-medium',
    normal: 'font-normal',
  },

  // Monospace (for code)
  monospace: 'font-mono',
};
