import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GraphNode, NodeTypeValues } from '../../types/graph.types';
import type { NodeMetricData } from '../../types/metrics.types';
import { components, spacing } from '../../design-system';

interface MetricRow {
  label: string;
  value: string;
}

interface MetricSection {
  title: string;
  rows: MetricRow[];
}

/** Formats a number as an integer when whole, otherwise rounded to 2 decimals. */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/**
 * Pinned node inspection popup.
 * Renders all metric metadata for a node, grouped by category (Size / Dependencies /
 * Structure). Container nodes (DIRECTORY/CLASS) show aggregated sums + averages.
 */
@Component({
  selector: 'app-node-popup',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed z-50 pointer-events-auto"
      [class]="popupCard"
      [style.left.px]="position.x"
      [style.top.px]="position.y"
      [style.transform]="'translate(16px, -50%)'"
      (click)="$event.stopPropagation()"
      (keydown.enter)="$event.stopPropagation()"
      tabindex="0"
      role="dialog"
    >
      <div [class]="headerClass">
        <span [class]="titleClass">{{ node.label }}</span>
        <span [class]="typeClass">{{ node.type }}</span>
      </div>

      @for (section of sections; track section.title) {
        <div [class]="sectionClass">
          <div [class]="sectionTitleClass">{{ section.title }}</div>
          @for (row of section.rows; track row.label) {
            <div [class]="rowClass">
              <span>{{ row.label }}</span>
              <strong>{{ row.value }}</strong>
            </div>
          }
        </div>
      }

      @if (sections.length === 0) {
        <div [class]="emptyClass">No metrics available</div>
      }
    </div>
  `,
})
export class NodePopupComponent {
  @Input({ required: true }) node!: GraphNode;
  @Input({ required: true }) position!: { x: number; y: number };

  popupCard = [components.card.default, spacing.padding.sm, 'text-sm min-w-52 max-w-xs'].join(' ');

  headerClass =
    'flex items-center justify-between gap-2 pb-1 border-b border-[var(--borderColor-muted)]';
  titleClass = 'font-semibold text-[var(--fgColor-default)] truncate';
  typeClass = 'text-[10px] font-semibold text-[var(--fgColor-muted)] uppercase shrink-0';
  sectionClass = 'mt-2';
  sectionTitleClass =
    'text-[10px] font-semibold uppercase tracking-wide text-[var(--fgColor-muted)] mb-1';
  rowClass =
    'flex items-center justify-between gap-3 py-0.5 text-xs text-[var(--fgColor-muted)] tabular';
  emptyClass = 'mt-2 text-xs text-[var(--fgColor-muted)]';

  get sections(): MetricSection[] {
    const m = this.node.metadata;
    if (!m) return [];
    const sections: MetricSection[] = [];

    const size = this.buildSizeRows(m);
    if (size.length) sections.push({ title: 'Size', rows: size });

    const deps = this.buildDependencyRows(m);
    if (deps.length) sections.push({ title: 'Dependencies', rows: deps });

    const structure = this.buildStructureRows(m);
    if (structure.length) sections.push({ title: 'Structure', rows: structure });

    return sections;
  }

  private buildSizeRows(m: NodeMetricData): MetricRow[] {
    const rows: MetricRow[] = [];
    if (m.linesPerFile) {
      rows.push({ label: 'Total lines', value: fmt(m.linesPerFile.total) });
      rows.push({ label: 'Non-empty', value: fmt(m.linesPerFile.nonEmpty) });
      rows.push({ label: 'Blank', value: fmt(m.linesPerFile.blank) });
    }
    if (m.functionLength) {
      rows.push({ label: 'Function length', value: `${fmt(m.functionLength.lines)} lines` });
    }
    if (m.sums) {
      if (m.sums.totalLines !== undefined) {
        rows.push({ label: 'Lines (sum)', value: fmt(m.sums.totalLines) });
      }
      if (m.sums.functionLines !== undefined) {
        rows.push({ label: 'Method lines (sum)', value: fmt(m.sums.functionLines) });
      }
    }
    if (m.averages) {
      if (m.averages.avgLinesPerFile !== undefined) {
        rows.push({ label: 'Lines/file (avg)', value: fmt(m.averages.avgLinesPerFile) });
      }
      if (m.averages.avgFunctionLength !== undefined) {
        rows.push({ label: 'Method length (avg)', value: fmt(m.averages.avgFunctionLength) });
      }
    }
    return rows;
  }

  private buildDependencyRows(m: NodeMetricData): MetricRow[] {
    const rows: MetricRow[] = [];
    if (m.dependencyCentrality) {
      const c = m.dependencyCentrality;
      rows.push({ label: 'In-degree', value: fmt(c.inDegree) });
      rows.push({ label: 'Out-degree', value: fmt(c.outDegree) });
      rows.push({ label: 'In centrality', value: fmt(c.inDegreeCentrality) });
      rows.push({ label: 'Out centrality', value: fmt(c.outDegreeCentrality) });
      rows.push({ label: 'Total centrality', value: fmt(c.totalDegreeCentrality) });
    }
    if (m.dependencySummary) {
      const s = m.dependencySummary;
      rows.push({ label: 'Fan-in calls', value: fmt(s.fanInCalls) });
      rows.push({ label: 'Fan-out calls', value: fmt(s.fanOutCalls) });
      rows.push({ label: 'Fan-in functions', value: fmt(s.fanInFunctions) });
      rows.push({ label: 'Fan-out functions', value: fmt(s.fanOutFunctions) });
      rows.push({ label: 'Dependency score', value: fmt(s.dependencyScore) });
    }
    if (m.sums) {
      if (m.sums.inDegree !== undefined) {
        rows.push({ label: 'In-degree (sum)', value: fmt(m.sums.inDegree) });
      }
      if (m.sums.outDegree !== undefined) {
        rows.push({ label: 'Out-degree (sum)', value: fmt(m.sums.outDegree) });
      }
      if (m.sums.fanInCalls !== undefined) {
        rows.push({ label: 'Fan-in calls (sum)', value: fmt(m.sums.fanInCalls) });
      }
      if (m.sums.fanOutCalls !== undefined) {
        rows.push({ label: 'Fan-out calls (sum)', value: fmt(m.sums.fanOutCalls) });
      }
    }
    if (m.averages) {
      if (m.averages.inDegreeCentrality !== undefined) {
        rows.push({ label: 'In centrality (avg)', value: fmt(m.averages.inDegreeCentrality) });
      }
      if (m.averages.outDegreeCentrality !== undefined) {
        rows.push({ label: 'Out centrality (avg)', value: fmt(m.averages.outDegreeCentrality) });
      }
      if (m.averages.totalDegreeCentrality !== undefined) {
        rows.push({
          label: 'Total centrality (avg)',
          value: fmt(m.averages.totalDegreeCentrality),
        });
      }
      if (m.averages.avgFanInCalls !== undefined) {
        rows.push({ label: 'Fan-in calls (avg)', value: fmt(m.averages.avgFanInCalls) });
      }
      if (m.averages.avgFanOutCalls !== undefined) {
        rows.push({ label: 'Fan-out calls (avg)', value: fmt(m.averages.avgFanOutCalls) });
      }
      if (m.averages.avgDependencyScore !== undefined) {
        rows.push({ label: 'Dependency score (avg)', value: fmt(m.averages.avgDependencyScore) });
      }
    }
    return rows;
  }

  private buildStructureRows(m: NodeMetricData): MetricRow[] {
    const rows: MetricRow[] = [];
    if (m.parameterCount) {
      rows.push({ label: 'Parameters', value: fmt(m.parameterCount.params) });
    }
    if (m.sums?.params !== undefined) {
      rows.push({ label: 'Params (sum)', value: fmt(m.sums.params) });
    }
    if (m.averages?.avgParams !== undefined) {
      rows.push({ label: 'Params (avg)', value: fmt(m.averages.avgParams) });
    }
    if (m.childCount !== undefined) {
      const label = this.node.type === NodeTypeValues.DIRECTORY ? 'Files' : 'Child entities';
      rows.push({ label, value: fmt(m.childCount) });
    }
    return rows;
  }
}
