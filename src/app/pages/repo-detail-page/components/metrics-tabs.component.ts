import { Component, Input, Output, EventEmitter, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartRendererService } from '../../../services/chart-renderer.service';

/**
 * Displays and manages metric selection tabs and chart rendering.
 * Handles metric tab switching, chart/json subtab selection, and chart rendering.
 */
@Component({
  selector: 'app-metrics-tabs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="mt-4 bg-[var(--bgColor-default)] rounded-md border border-[var(--borderColor-default)]"
    >
      <div class="px-4 pt-3">
        <h2 class="text-sm font-semibold">Metrics</h2>
      </div>

      <!-- Metric tabs (UnderlineNav) -->
      <div
        class="flex gap-1 border-b border-[var(--borderColor-default)] mt-2 px-2 overflow-x-auto"
      >
        @for (metricKey of metricKeys; track metricKey) {
          <button
            (click)="selectMetric(metricKey)"
            [attr.aria-selected]="activeMetric() === metricKey"
            class="UnderlineNav-item px-3 py-2 text-sm whitespace-nowrap hover:bg-[var(--bgColor-muted)] rounded-t-md font-mono text-xs"
          >
            {{ metricKey }}
          </button>
        }
      </div>

      <!-- Subtabs: JSON / Charts -->
      <div class="flex gap-1 border-b border-[var(--borderColor-default)] px-2">
        <button
          (click)="selectSubtab('json')"
          [attr.aria-selected]="activeSubtab() === 'json'"
          class="UnderlineNav-item px-3 py-2 text-sm hover:bg-[var(--bgColor-muted)] rounded-t-md"
        >
          JSON
        </button>
        <button
          (click)="selectSubtab('charts')"
          [attr.aria-selected]="activeSubtab() === 'charts'"
          class="UnderlineNav-item px-3 py-2 text-sm hover:bg-[var(--bgColor-muted)] rounded-t-md"
        >
          Charts
        </button>
      </div>

      <!-- Content: JSON view -->
      @if (activeSubtab() === 'json') {
        <div class="p-4">
          <pre
            class="text-xs font-mono overflow-auto max-h-96 p-3 rounded-md bg-[var(--bgColor-muted)] border border-[var(--borderColor-muted)]"
            >{{ getMetricData() | json }}</pre>
        </div>
      }

      <!-- Content: Chart view -->
      @if (activeSubtab() === 'charts') {
        <div class="p-4">
          @if (chartStatus()[activeMetric()] === 'ok') {
            <div [id]="'chart-' + activeMetric()" [style.height.px]="400"></div>
          }
          @if (chartStatus()[activeMetric()] === 'empty') {
            <div class="text-[var(--fgColor-muted)] text-sm text-center py-8">
              No numeric data available for chart
            </div>
          }
          @if (chartStatus()[activeMetric()] === 'error') {
            <div class="text-[var(--danger-fg)] text-sm text-center py-8">
              Error rendering chart
            </div>
          }
          @if (!chartStatus()[activeMetric()]) {
            <div class="text-[var(--fgColor-muted)] text-sm text-center py-8">
              Select a metric to view chart
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class MetricsTabsComponent implements OnDestroy {
  private chartRenderer = inject(ChartRendererService);

  @Input() metricKeys: string[] = [];
  @Input() metricsData: Record<string, unknown> = {};
  @Output() metricChanged = new EventEmitter<string>();
  @Output() subtabChanged = new EventEmitter<'json' | 'charts'>();

  activeMetric = signal<string>('');
  activeSubtab = signal<'json' | 'charts'>('json');
  chartStatus = signal<Record<string, 'idle' | 'empty' | 'ok' | 'error'>>({});

  selectMetric(key: string): void {
    if (this.activeMetric() === key) return;
    this.activeMetric.set(key);
    this.activeSubtab.set('json');
    this.metricChanged.emit(key);
  }

  selectSubtab(tab: 'json' | 'charts'): void {
    this.activeSubtab.set(tab);
    this.subtabChanged.emit(tab);

    if (tab === 'charts') {
      queueMicrotask(() => this.renderChart());
    }
  }

  getMetricData(): unknown {
    return this.metricsData[this.activeMetric()] ?? null;
  }

  private renderChart(): void {
    const data = this.getMetricData();
    if (!data) return;

    const status = this.chartRenderer.renderChart(
      this.activeMetric(),
      data,
      'chart-' + this.activeMetric(),
    );

    const currentStatus = this.chartStatus();
    this.chartStatus.set({ ...currentStatus, [this.activeMetric()]: status });
  }

  ngOnDestroy(): void {
    this.chartRenderer.disposeAll();
  }
}
