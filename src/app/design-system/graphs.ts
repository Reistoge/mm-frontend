/**
 * Graph/Visualization Design System — GitHub Primer styling.
 * Flat panels, 6px radius, Primer borders. Canvas uses Primer canvas tokens.
 */

export const graphs = {
  // Graph Container
  container: {
    main: 'w-full h-[800px] bg-[var(--bgColor-default)] border border-[var(--borderColor-default)] rounded-md relative overflow-hidden',
    inner: 'w-full h-full absolute inset-0',
  },

  // Legend
  legend: {
    container:
      'absolute top-4 left-4 bg-[var(--bgColor-default)] p-4 rounded-md text-sm border border-[var(--borderColor-default)] max-w-xs z-10',
    title: 'font-semibold text-[var(--fgColor-default)] text-sm mb-2',
    itemsContainer: 'space-y-2',
    item: 'flex items-center gap-2',
    label: 'text-[var(--fgColor-muted)]',
    divider:
      'mt-4 pt-3 border-t border-[var(--borderColor-muted)] text-xs text-[var(--fgColor-muted)] space-y-1',
    controlGroup: 'mt-4 pt-3 border-t border-[var(--borderColor-muted)]',
  },

  // Legend Items (Node Types) — Primer hues
  node: {
    folder: 'w-3 h-3 rounded-full bg-[#eba924]',
    file: 'w-3 h-3 rounded-full bg-[#59636e]',
    class: 'w-3 h-3 rounded-full bg-[#8250df]',
    function: 'w-3 h-3 rounded-full bg-[#1a7f37]',
  },

  // Control Slider
  slider: {
    label: 'flex items-center justify-between mb-1.5',
    labelText: 'text-xs font-medium text-[var(--fgColor-muted)]',
    labelValue: 'text-xs font-mono text-[var(--fgColor-muted)]',
    input:
      'w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#0969da] bg-[var(--borderColor-default)]',
    range: 'flex justify-between text-[10px] text-[var(--fgColor-muted)] mt-1',
  },

  // Button Group (Primer BtnGroup small)
  buttonGroup: {
    container: 'mt-4 pt-3 border-t border-[var(--borderColor-muted)] flex gap-2',
    button: 'flex-1 px-3 py-[3px] text-xs font-medium rounded-md border transition-colors',
    expand:
      'bg-[var(--success-emphasis)] text-white border-[var(--borderColor-default)] hover:brightness-110',
    collapse:
      'bg-[var(--bgColor-default)] text-[var(--fgColor-default)] border-[var(--borderColor-default)] hover:bg-[var(--bgColor-muted)]',
  },

  // Download Actions
  actions: {
    container: 'absolute top-4 right-4 flex flex-col gap-2 z-10',
    button:
      'px-3 py-[5px] bg-[var(--bgColor-default)] border border-[var(--borderColor-default)] rounded-md text-xs font-medium text-[var(--fgColor-default)] hover:bg-[var(--bgColor-muted)] transition-colors flex items-center gap-1.5',
  },

  // State Overlays
  state: {
    loading: {
      overlay:
        'absolute inset-0 bg-[var(--bgColor-default)]/80 flex flex-col items-center justify-center z-50',
      spinner:
        'w-8 h-8 border-4 border-[var(--accent-fg)] border-t-transparent rounded-full animate-spin mb-2',
      text: 'text-[var(--accent-fg)] font-medium',
    },
    error: {
      overlay:
        'absolute inset-0 flex items-center justify-center bg-[var(--danger-muted)] z-50 text-[var(--danger-fg)]',
    },
  },
};
