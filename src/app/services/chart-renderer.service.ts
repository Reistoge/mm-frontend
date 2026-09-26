import { Injectable } from '@angular/core';
import * as echarts from 'echarts';
import { getChartTheme } from '../config/chart-config';

/**
 * Handles ECharts rendering for generic metrics data.
 * Extracts numeric data, applies heuristics, and renders bar charts.
 */
@Injectable({ providedIn: 'root' })
export class ChartRendererService {
  private charts = new Map<string, echarts.ECharts>();
  private resizeBound = false;
  private readonly resizeHandler = () => {
    for (const ch of this.charts.values()) ch.resize();
  };

  /**
   * Renders a bar chart for the given metric data.
   * Returns 'ok' | 'empty' | 'error' status.
   */
  renderChart(chartKey: string, data: unknown, containerId: string): 'ok' | 'empty' | 'error' {
    try {
      // Extract numeric pairs from data
      const pairs = this.extractNumericPairs(data);

      // If empty, try heuristic approach
      if (pairs.length === 0 && data && typeof data === 'object') {
        const inferred = this.inferNumericPairs(data);
        if (inferred.length === 0) return 'empty';
        pairs.push(...inferred);
      }

      if (pairs.length === 0) return 'empty';

      // Get top 20 items and sort
      pairs.sort((a, b) => b.value - a.value);
      const top = pairs.slice(0, 20);
      const names = top.map((d) => d.name);
      const values = top.map((d) => d.value);

      // Get or create chart
      const el = document.getElementById(containerId);
      if (!el) return 'error';

      let chart = this.charts.get(chartKey);
      if (!chart) {
        chart = echarts.init(el);
        this.charts.set(chartKey, chart);
      }

      // Configure chart (GitHub Primer analytics theme, mode-aware)
      const t = getChartTheme();
      chart.setOption({
        tooltip: {
          trigger: 'axis',
          backgroundColor: t.tooltipBg,
          borderColor: t.tooltipBorder,
          textStyle: { color: t.tooltipText },
        },
        grid: { left: 12, right: 12, top: 24, bottom: 48, containLabel: true },
        xAxis: {
          type: 'category',
          data: names,
          axisLabel: { rotate: 0, fontSize: 11, color: t.axisLabel, hideOverlap: true },
          axisLine: { lineStyle: { color: t.axisLine } },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: t.axisLabel },
          splitLine: { lineStyle: { color: t.splitLine, type: 'dashed' } },
        },
        series: [
          {
            type: 'bar',
            data: values,
            itemStyle: { color: t.series, borderRadius: [2, 2, 0, 0] },
            emphasis: { itemStyle: { color: t.seriesEmphasis } },
          },
        ],
        color: t.palette,
        textStyle: {
          fontFamily: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
        },
      });

      this.ensureResizeListener();
      return 'ok';
    } catch {
      return 'error';
    }
  }

  /**
   * Extracts numeric key-value pairs from first level of object.
   */
  private extractNumericPairs(data: unknown): { name: string; value: number }[] {
    const pairs: { name: string; value: number }[] = [];

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const k of Object.keys(data)) {
        const v = (data as Record<string, unknown>)[k];
        if (typeof v === 'number' && Number.isFinite(v)) {
          pairs.push({ name: k, value: v });
        }
      }
    }

    return pairs;
  }

  /**
   * Attempts to infer numeric values from nested objects
   * by checking for common field names (count, fanIn, fanOut, etc.)
   */
  private inferNumericPairs(data: unknown): { name: string; value: number }[] {
    const candFields = ['count', 'fanIn', 'fanOut', 'size', 'lines', 'total', 'degree'];
    const inferred: { name: string; value: number }[] = [];

    for (const k of Object.keys(data as Record<string, unknown>)) {
      const v = (data as Record<string, unknown>)[k];
      if (v && typeof v === 'object') {
        const f = candFields.find(
          (fk) =>
            typeof (v as Record<string, unknown>)[fk] === 'number' &&
            Number.isFinite((v as Record<string, unknown>)[fk]),
        );
        if (f) inferred.push({ name: k, value: (v as Record<string, unknown>)[f] as number });
      }
    }

    return inferred;
  }

  /**
   * Disposes chart and removes from cache.
   */
  disposeChart(chartKey: string): void {
    const chart = this.charts.get(chartKey);
    if (chart) {
      chart.dispose();
      this.charts.delete(chartKey);
    }
  }

  /**
   * Disposes all charts and cleans up.
   */
  disposeAll(): void {
    for (const ch of this.charts.values()) ch.dispose();
    this.charts.clear();
    this.removeResizeListener();
  }

  /**
   * Triggers resize for all charts.
   */
  resizeAll(): void {
    for (const ch of this.charts.values()) ch.resize();
  }

  private ensureResizeListener(): void {
    if (!this.resizeBound) {
      window.addEventListener('resize', this.resizeHandler, { passive: true });
      this.resizeBound = true;
    }
  }

  private removeResizeListener(): void {
    if (this.resizeBound) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeBound = false;
    }
  }
}
