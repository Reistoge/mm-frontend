import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  EdgeMetadata,
  LinkCounts,
  LinkTypeValues,
  formatLinkCounts,
} from '../../types/graph.types';
import { components, spacing } from '../../design-system';

interface TypeBadge {
  label: string;
  class: string;
}

@Component({
  selector: 'app-edge-popup',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed z-50 pointer-events-auto"
      [class]="popupCard"
      [style.left.px]="position.x"
      [style.top.px]="position.y"
      [style.transform]="'translate(-50%, -100%)'"
      (click)="$event.stopPropagation()"
      (keydown.enter)="$event.stopPropagation()"
      tabindex="0"
      role="dialog"
    >
      <div [class]="flexBetween">
        <span [class]="labelClass">{{ metadata.sourceName }}</span>
        <svg
          class="w-4 h-4 text-slate-400 mx-2 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <span [class]="labelClass">{{ metadata.targetName }}</span>
      </div>

      @if (typeBadges.length > 0) {
        <div [class]="badgeRow">
          @for (badge of typeBadges; track badge.label) {
            <span [class]="badge.class">{{ badge.label }}</span>
          }
        </div>
      }

      @if (metadata.bidirectional && metadata.forwardCounts && metadata.reverseCounts) {
        <div [class]="detailRow">
          <span [class]="detailItem">Direction: <strong>Bidirectional</strong></span>
        </div>
        <div [class]="detailRow">
          <span [class]="detailItem"
            >{{ metadata.sourceName }} → {{ metadata.targetName }}:
            <strong>{{ format(metadata.forwardCounts) }}</strong></span
          >
        </div>
        <div [class]="detailRow">
          <span [class]="detailItem"
            >{{ metadata.targetName }} → {{ metadata.sourceName }}:
            <strong>{{ format(metadata.reverseCounts) }}</strong></span
          >
        </div>
      }

      @if (metadata.level) {
        <div [class]="detailRow">
          <span [class]="detailItem"
            >Level: <strong>{{ metadata.level }}</strong></span
          >
        </div>
      }
    </div>
  `,
})
export class EdgePopupComponent {
  @Input({ required: true }) metadata!: EdgeMetadata;
  @Input({ required: true }) position!: { x: number; y: number };

  popupCard = [
    components.card.default,
    spacing.padding.sm,
    'shadow-xl border-slate-200 text-sm max-w-xs',
  ].join(' ');

  flexBetween = 'flex items-center justify-between';
  labelClass = 'font-semibold text-slate-800 truncate max-w-[120px]';
  badgeRow = 'flex items-center gap-2 mt-2';
  detailRow = 'flex items-center gap-3 mt-1.5 text-slate-600';
  detailItem = 'text-xs';

  get typeBadges(): TypeBadge[] {
    const badges: TypeBadge[] = [];
    const counts = this.metadata.counts ?? {};
    const imports = counts[LinkTypeValues.IMPORTS] ?? 0;
    const calls = counts[LinkTypeValues.CALL] ?? 0;
    const instantiates = counts[LinkTypeValues.INSTANTIATE] ?? 0;
    if (imports > 0) {
      badges.push({
        label: `${imports} import${imports > 1 ? 's' : ''}`,
        class: this.badgeClass(LinkTypeValues.IMPORTS),
      });
    }
    if (calls > 0) {
      badges.push({
        label: `${calls} call${calls > 1 ? 's' : ''}`,
        class: this.badgeClass(LinkTypeValues.CALL),
      });
    }
    if (instantiates > 0) {
      badges.push({
        label: `${instantiates} instantiate${instantiates > 1 ? 's' : ''}`,
        class: this.badgeClass(LinkTypeValues.INSTANTIATE),
      });
    }
    return badges;
  }

  format(counts: LinkCounts): string {
    return formatLinkCounts(counts);
  }

  private badgeClass(type: string): string {
    const colors: Record<string, string> = {
      CALL: 'bg-emerald-100 text-emerald-700',
      INSTANTIATE: 'bg-blue-100 text-blue-700',
      IMPORTS: 'bg-amber-100 text-amber-700',
    };
    return `${colors[type] || 'bg-gray-100 text-gray-700'} text-xs font-bold px-2 py-0.5 rounded-full`;
  }
}
