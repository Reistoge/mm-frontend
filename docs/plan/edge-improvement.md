# Edge Popup → In-Graph Rectangular Node

## Goal
Replace the current fixed-position overlay popup (triggered by clicking an edge number) with a rectangular SVG node rendered **inside the graph** at the edge's midpoint. The node zooms/pans with the graph and shows the same edge metadata.

## Key Behaviors
- Clicking an edge number **replaces the number** with the rectangular info card (the card appears at the midpoint instead of the number)
- Clicking the **X button** on the card or **clicking the graph background** closes it
- The card is part of the SVG (zoom layer), so it moves with zoom/pan naturally

## Files to Modify

### 1. `src/app/components/base-graph.component.ts`
- Remove the `edgePopup` signal (line 93) and `popupLink` field (line 94)
- Remove `updatePopupPosition()` method (lines 633-659)
- Replace `handleEdgeClick()` (line 664) to store `selectedEdgeMetadata` + `selectedEdgeLink` as private fields, call `renderEdgeInfoCard()`
- Add `renderEdgeInfoCard()` — renders/removes a `<g class="edge-info-card">` in the zoom layer:
  - `<rect>` background (white, rounded corners, border, shadow SVG filter)
  - `<text>` for "SourceName → TargetName"
  - `<text>` for "TYPE value" (badge-style)
  - `<text>` for bidirectional info (if applicable)
  - `<text>` for level (if applicable)
  - `<rect>` close button with "×" text
  - Hides the selected edge's number text
- Zoom layer click handler → clear selection, remove card
- `updateSimulationState()` → clear selection

### 2. `src/app/components/graph-wrapper/graph-wrapper.component.ts`
- Remove `edgePopupData` input (line 28)
- Remove `closeEdgePopup` output (line 31)

### 3. `src/app/components/graph-wrapper/graph-wrapper.component.html`
- Remove lines 109-114 (`<app-edge-popup>` block)

### 4-6. Graph templates
- **`src/app/components/hierarchical-graph/hierarchical-graph.component.html`** — remove `[edgePopupData]="edgePopup()"` (line 9) and `(closeEdgePopup)="edgePopup.set(null)"` (line 10)
- **`src/app/components/module-class-graph/module-class-graph.component.html`** — same
- **`src/app/components/module-function-graph/module-function-graph.component.html`** — same

### 7. (Optional) Delete `src/app/components/edge-popup/edge-popup.component.ts`

## Card Visual Layout (SVG)

```
┌─────────────────────────┐
│ SourceName → TargetName ✕│
│ TYPE value               │
│ Direction: Bidirectional │
│   S→T: fwd  T→S: rev    │
│ Level: xxx               │
└─────────────────────────┘
```

- White background (`#fff`)
- Rounded corners (`rx="6" ry="6"`)
- Thin border (`stroke="#e2e8f0"`)
- Subtle shadow (SVG drop-shadow filter)
- Fix width (e.g. 200px)
- Close button (×) in top-right corner
- Positioned at edge midpoint with vertical offset
