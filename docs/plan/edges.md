# Edges click, pop up information

Objective: Show data and information about the edge between a entity and other when the user clicks on the edge number.

When the user clicks on the number of an edge then display a pop up with information about the edge.

---

## Revised Implementation Plan

### Overview

Replace the hover-with-delay approach with a **click-to-toggle** pattern. Clicking an edge number opens a popup with edge details; clicking it again or clicking elsewhere closes it.

The popup must be rendered **outside** the D3 SVG (to avoid zoom transform clipping) and uses simple absolute positioning.

---

### File-by-file implementation plan

#### 1. `src/app/types/graph.types.ts` — add `EdgeMetadata` type

Insert after the existing `GraphLink` interface (before `HierarchicalData`):

```typescript
export interface EdgeMetadata {
  sourceName: string;
  targetName: string;
  linkType: LinkType;
  direction?: LinkDirection;
  value: number;
  fanIn?: number;
  fanOut?: number;
  couplingValue?: number;
  level?: 'file' | 'module';
}
```

---

#### 2. `src/app/components/base-graph.component.ts` — wire edge click logic

**2a.** Import `EdgeMetadata` from `../types/graph.types`

**2b.** Add a signal for the popup state:

```typescript
readonly edgePopup = signal<{ metadata: EdgeMetadata; position: { x: number; y: number } } | null>(null);
```

**2c.** Add a helper map to track which original `GraphLink`s contributed to each rendered link:

```typescript
private linkToOriginals = new Map<string, GraphLink[]>();
```

**2d.** In `rebuildLinks()`, after building each aggregated `RenderLink`, also store the original `GraphLink`s:

When iterating `activeLinks.forEach(l => { ... })`, after `newLinks.set(key, ...)`, accumulate the original links:

```
// Track original links for popup
if (!this.linkToOriginals.has(key)) {
  this.linkToOriginals.set(key, []);
}
this.linkToOriginals.get(key)!.push(l);
```

Reset `this.linkToOriginals = new Map()` at the top of `rebuildLinks()`.

**2e.** In `updateLinksForView()`, change the link text from `pointer-events: 'none'` to adding a `click` handler:

```typescript
// Instead of .style('pointer-events', 'none')
// Add: .style('cursor', 'pointer')
// Add click handler on the <text> element:
merged.select('text')
  .style('cursor', 'pointer')
  .on('click', (event: MouseEvent, d: RenderLink) => {
    this.handleEdgeClick(event, d);
  });
```

**2f.** Implement `handleEdgeClick()`:

```typescript
private handleEdgeClick(event: MouseEvent, link: RenderLink): void {
  const key = `${link.source.id}-${link.type}-${link.target.id}`;
  const originals = this.linkToOriginals.get(key) || [];

  const sourceNode = this.allNodesMap.get(link.source.id);
  const targetNode = this.allNodesMap.get(link.target.id);

  // Aggregate metadata from all contributing original links
  const metadata: EdgeMetadata = {
    sourceName: sourceNode?.label || link.source.id,
    targetName: targetNode?.label || link.target.id,
    linkType: link.type as LinkType,
    value: link.value,
    fanIn: originals.reduce((sum, l) => sum + (l.fanIn ?? 0), 0),
    fanOut: originals.reduce((sum, l) => sum + (l.fanOut ?? 0), 0),
    couplingValue: originals.reduce((sum, l) => sum + (l.couplingValue ?? 0), 0),
    direction: originals.find(l => l.direction)?.direction,
    level: originals.find(l => l.level)?.level,
  };

  const current = this.edgePopup();
  if (current && current.metadata.sourceName === metadata.sourceName && current.metadata.targetName === metadata.targetName) {
    // Clicking the same edge again closes the popup
    this.edgePopup.set(null);
  } else {
    this.edgePopup.set({ metadata, position: { x: event.clientX, y: event.clientY } });
  }
}
```

**2g.** Close popup when clicking on graph background or nodes:

In `zoomLayer.on('click', ...)` or in `updateNodes()`, add logic to close popup when clicking somewhere that is not a link text.

---

#### 3. `src/app/components/edge-popup/edge-popup.component.ts` — new standalone component

Create file: `src/app/components/edge-popup/edge-popup.component.ts`

Standalone Angular component with:
- `@Input({ required: true }) metadata!: EdgeMetadata`
- `@Input({ required: true }) position!: { x: number; y: number }`
- Template renders a card-like popup with:
  - Source → Target (with arrow icon)
  - Link type badge (DEPENDENCY/COUPLING/CALL)
  - Value (the coupling number)
  - If fanIn/fanOut present: show breakdown
  - If couplingValue present: show that too
  - Direction indicator if available
- Positioned using `position: fixed; left: {x}px; top: {y}px; transform: translate(-50%, -100%)`
- No new external dependencies (no CDK overlay)

---

#### 4. Three CSS files — remove `pointer-events: none` from `text`

In each of:
- `src/app/components/hierarchical-graph/hierarchical-graph.component.css`
- `src/app/components/module-class-graph/module-class-graph.component.css`
- `src/app/components/module-function-graph/module-function-graph.component.css`

Change the `text { ... }` rule to remove `pointer-events: none`:

```css
text {
  user-select: none;
  text-shadow: 0 1px 0 #fff, 0 -1px 0 #fff, 1px 0 0 #fff, -1px 0 0 #fff;
}
.link text {
  cursor: pointer;
}
```

---

#### 5. `src/app/components/graph-wrapper/graph-wrapper.component.ts` — add popup wiring

**5a.** Import `EdgePopupComponent` — add to `imports` array

**5b.** Add inputs for popup state:

```typescript
@Input() edgePopupData: { metadata: EdgeMetadata; position: { x: number; y: number } } | null = null;
@Output() closeEdgePopup = new EventEmitter<void>();
```

---

#### 6. `src/app/components/graph-wrapper/graph-wrapper.component.html` — render popup

Add at the end of the template (inside the main container div):

```html
<app-edge-popup
  *ngIf="edgePopupData"
  [metadata]="edgePopupData.metadata"
  [position]="edgePopupData.position"
  (click)="closeEdgePopup.emit()">
</app-edge-popup>
```

---

#### 7. Each concrete graph template — pass `edgePopup` signal

In each of:
- `hierarchical-graph.component.html`
- `module-class-graph.component.html`
- `module-function-graph.component.html`

Add bindings to `<app-graph-wrapper>`:

```html
[edgePopupData]="edgePopup()"
(closeEdgePopup)="edgePopup.set(null)"
```

Also add a `(click)="edgePopup.set(null)"` on the `div#graphContainer` to close popup when clicking graph background.

---

### Data Flow Summary

```
User clicks edge number
  → D3 click handler on <text> in updateLinksForView()
    → handleEdgeClick() in BaseGraphComponent
      → Looks up original GraphLink[] from linkToOriginals map
      → Constructs EdgeMetadata (aggregates fanIn/fanOut/couplingValue)
      → Sets edgePopup signal
        → Concrete graph template passes signal via @Input to GraphWrapperComponent
          → Renders <app-edge-popup> positioned at cursor
          → Clicking same edge again or clicking graph background closes it
```

---

### Edge Cases

1. **Zoom transforms**: Popup uses `position: fixed` with `clientX/clientY` (viewport coords), so it stays in place regardless of D3 zoom/pan.
2. **Window overflow**: Popup should check viewport boundaries and flip position (above→below, left→right) when near edges.
3. **Rebuild on expand/collapse**: `rebuildLinks()` is called frequently (every tick + on expand/collapse). The `linkToOriginals` map is rebuilt each time. The `edgePopup` signal should be cleared when the graph re-layouts (since the link that was clicked might disappear).
4. **Multiple original links**: One rendered line may aggregate multiple `GraphLink`s. The popup metadata should sum the values and show all contributing directions/levels.
