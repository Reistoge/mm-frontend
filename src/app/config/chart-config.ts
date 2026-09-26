/**
 * Chart Configuration Defaults — GitHub Primer analytics theme.
 * Flat axes, Primer grays, single accent series. Theme-aware via getChartTheme().
 */

export type ChartMode = 'light' | 'dark';

export interface ChartTheme {
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  axisLabel: string;
  axisLine: string;
  splitLine: string;
  series: string;
  seriesEmphasis: string;
  palette: string[];
  titleText: string;
}

const LIGHT: ChartTheme = {
  tooltipBg: '#ffffff',
  tooltipBorder: '#d0d7de',
  tooltipText: '#1f2328',
  axisLabel: '#59636e',
  axisLine: '#d0d7de',
  splitLine: '#d8dee4',
  series: '#0969da',
  seriesEmphasis: '#0550ae',
  palette: ['#0969da', '#8250df', '#1a7f37', '#9a6700', '#d1242c', '#59636e'],
  titleText: '#1f2328',
};

const DARK: ChartTheme = {
  tooltipBg: '#161b22',
  tooltipBorder: '#30363d',
  tooltipText: '#e6edf3',
  axisLabel: '#9198a1',
  axisLine: '#30363d',
  splitLine: '#21262d',
  series: '#4493f8',
  seriesEmphasis: '#79c0ff',
  palette: ['#4493f8', '#a371f7', '#3fb950', '#d29922', '#f85149', '#8b949e'],
  titleText: '#e6edf3',
};

/** Resolves the active chart theme from `data-color-mode` (canvas can't use CSS vars). */
export function getChartTheme(mode?: ChartMode): ChartTheme {
  if (mode) return mode === 'dark' ? DARK : LIGHT;
  if (typeof document !== 'undefined') {
    return document.documentElement.getAttribute('data-color-mode') === 'dark' ? DARK : LIGHT;
  }
  return LIGHT;
}

export const ECHART_DEFAULTS = {
  TOOLTIP: {
    trigger: 'axis',
    backgroundColor: LIGHT.tooltipBg,
    borderColor: LIGHT.axisLine,
    textStyle: {
      color: LIGHT.tooltipText,
    },
  },

  GRID: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: '8%',
    containLabel: true,
  },

  X_AXIS: {
    type: 'category',
    boundaryGap: true,
    axisLabel: {
      color: LIGHT.axisLabel,
      rotate: 0,
    },
    axisLine: {
      lineStyle: {
        color: LIGHT.axisLine,
      },
    },
  },

  Y_AXIS: {
    type: 'value',
    axisLabel: {
      color: LIGHT.axisLabel,
    },
    axisLine: {
      lineStyle: {
        color: LIGHT.axisLine,
      },
    },
    splitLine: {
      lineStyle: {
        color: LIGHT.splitLine,
        type: 'dashed',
      },
    },
  },

  SERIES: {
    type: 'bar',
    itemStyle: {
      color: LIGHT.series,
      borderRadius: [2, 2, 0, 0],
    },
    emphasis: {
      itemStyle: {
        color: LIGHT.seriesEmphasis,
      },
    },
  },

  COLOR_PALETTE: LIGHT.palette,
};

/**
 * Get default bar chart options (theme-aware)
 */
export function getDefaultBarChartOptions(title?: string, mode?: ChartMode) {
  const t = getChartTheme(mode);
  return {
    title: title
      ? { text: title, left: 'center', textStyle: { color: t.titleText, fontSize: 14 } }
      : undefined,
    tooltip: {
      trigger: 'axis',
      backgroundColor: t.tooltipBg,
      borderColor: t.tooltipBorder,
      textStyle: { color: t.tooltipText },
    },
    grid: ECHART_DEFAULTS.GRID,
    xAxis: {
      type: 'category',
      boundaryGap: true,
      axisLabel: { color: t.axisLabel, rotate: 0 },
      axisLine: { lineStyle: { color: t.axisLine } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: t.axisLabel },
      axisLine: { lineStyle: { color: t.axisLine } },
      splitLine: { lineStyle: { color: t.splitLine, type: 'dashed' } },
    },
    series: {
      type: 'bar',
      itemStyle: { color: t.series, borderRadius: [2, 2, 0, 0] },
      emphasis: { itemStyle: { color: t.seriesEmphasis } },
    },
    color: t.palette,
    textStyle: { fontFamily: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif" },
  };
}
