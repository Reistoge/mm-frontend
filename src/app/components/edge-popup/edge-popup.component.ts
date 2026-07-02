import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EdgeMetadata, LinkType } from '../../types/graph.types';
import { components, spacing } from '../../design-system';

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
      (click)="$event.stopPropagation()">
      <div [class]="flexBetween">
        <span [class]="labelClass">{{ metadata.sourceName }}</span>
        <svg class="w-4 h-4 text-slate-400 mx-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <span [class]="labelClass">{{ metadata.targetName }}</span>
      </div>

      <div [class]="badgeRow">
        <span [class]="typeBadge(metadata.linkType)">{{ metadata.linkType }}</span>
        <span [class]="valueBadge">{{ metadata.value }}</span>
      </div>

      <div *ngIf="metadata.bidirectional" [class]="detailRow">
        <span [class]="detailItem">Direction: <strong>Bidirectional</strong></span>
      </div>
      <div *ngIf="metadata.bidirectional" [class]="detailRow">
        <span [class]="detailItem">{{ metadata.sourceName }} → {{ metadata.targetName }}: <strong>{{ metadata.forwardValue }}</strong></span>
      </div>
      <div *ngIf="metadata.bidirectional" [class]="detailRow">
        <span [class]="detailItem">{{ metadata.targetName }} → {{ metadata.sourceName }}: <strong>{{ metadata.reverseValue }}</strong></span>
      </div>

      <div *ngIf="metadata.level" [class]="detailRow">
        <span [class]="detailItem">Level: <strong>{{ metadata.level }}</strong></span>
      </div>
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
  valueBadge = 'bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full';
  detailRow = 'flex items-center gap-3 mt-1.5 text-slate-600';
  detailItem = 'text-xs';

  typeBadge(type: LinkType): string {
    const colors: Record<LinkType, string> = {
      DEPENDENCY: 'bg-amber-100 text-amber-700',
      COUPLING: 'bg-blue-100 text-blue-700',
      CALL: 'bg-emerald-100 text-emerald-700',
    };
    return `${colors[type] || 'bg-gray-100 text-gray-700'} text-xs font-bold px-2 py-0.5 rounded-full`;
  }
}
