# Bidirectional Edge Merge Bug

## Problems

1. **Bidirectional overlap**: When two modules import each other (A→B and B→A), the graph renders two overlapping lines and numbers. The popup only shows one direction's data. This makes the graph hard to read and the edge popup misleading.

2. **`couplingValue` is always 0**: The popup shows "Coupling: 0" on every edge. `couplingValue` is never set by the aggregator service — it's a dead field in the popup that just confuses users.

## Solution

Merge bidirectional pairs (A→B + B→A) into a single rendered edge. The popup aggregates data from both directions.

### File-by-file plan

#### 1. `src/app/types/graph.types.ts` — nothing to change

The types already support the data. `RenderLink` will get a `bidirectional` flag set during merge.

#### 2. `src/app/components/base-graph.component.ts` — merge bidirectional links in `rebuildLinks()`

After the current loop that populates `newLinks`, add a merge pass:

```
for each (key, link) in newLinks:
  if already seen: skip
  compute reverseKey = `${targetId}-${type}-${sourceId}`
  if reverse exists in newLinks:
    mark reverse as seen
    if canonical order (sourceId < targetId):
      link.value += reverse.value
      link.bidirectional = true
      merge reverse's originals into linkToOriginals for key
      merged.set(key, link)
  else:
    merged.set(key, link)
```

Clear `edgePopup` + `popupLink` when links are rebuilt (already done via `updateSimulationState`).

Also add an `originals` merge: when merging bidirectional links, copy the reverse key's original `GraphLink[]` entries into the kept key.

#### 3. `src/app/components/module-class-graph/module-class-graph.component.ts` — same merge in its `rebuildLinks()` override

Apply identical merge logic.

#### 4. `src/app/components/base-graph.component.ts` — arrow markers for bidirectional edges

In `updateLinksForView()`:  
- Skip `marker-end` for `bidirectional` links (no arrowhead on bidirectional edges)

In `updateArrowMarkers()`:  
- Optionally add a double-headed arrow marker

#### 5. `src/app/components/base-graph.component.ts` — click handler

No changes needed. `handleEdgeClick` already aggregates from `linkToOriginals`, which now includes originals from both directions.

#### 6. `src/app/types/graph.types.ts` — remove `couplingValue` from `EdgeMetadata`

```typescript
export interface EdgeMetadata {
  sourceName: string;
  targetName: string;
  linkType: LinkType;
  direction?: LinkDirection;
  value: number;
  level?: 'file' | 'module';
}
```

#### 7. `src/app/components/base-graph.component.ts` — stop computing `couplingValue` in `handleEdgeClick()`

Remove the `couplingValue` line from the metadata construction.

#### 8. `src/app/components/edge-popup/edge-popup.component.ts` — remove couplingValue from template, show merged direction info

When the edge is bidirectional, show:
- "Direction: Bidirectional" or "A → B: N calls, B → A: M calls"

### Edge Cases

1. **Same link type only**: Reverse links must have the same `type` to be merged. A DEPENDENCY A→B won't merge with a COUPLING B→A.
2. **Value overflow**: Simple addition for now. If both directions have value 1 (module-level), merged edge shows 2.
3. **Popup closes on re-layout**: Already handled — `updateSimulationState()` clears the popup.
4. **Module-class graph**: The override in `ModuleClassGraphComponent` already has custom `rebuildLinks()` — add the same merge pass there.
