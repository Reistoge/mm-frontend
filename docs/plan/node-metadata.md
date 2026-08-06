# Plan: Per-node metrics inspection (pinned lens)

Surfaces `dependency-centrality`, `function-length`, `function-dependency-summary`,
`lines-per-file`, and `parameter-count` as per-node metadata on the graph.
Interaction: a small "ⓘ" lens appears next to a node label on hover; clicking the
lens pins a popup that shows the node's full metrics. No hover tooltip.

## 1. Types — `src/app/types/metrics.types.ts` / `src/app/types/graph.types.ts`

- Add loose shapes for the 5 metrics, mirroring the backend/stub shapes:
  - `DependencyCentralityMetric`: `{ inDegree, outDegree, inDegreeCentrality, outDegreeCentrality, totalDegreeCentrality }`
  - `LinesPerFileMetric`: `{ total, nonEmpty, blank }`
  - `FunctionLengthMetric`: `{ lines }`
  - `FunctionDependencySummary`: `{ fanInCalls, fanOutCalls, fanInFunctions, fanOutFunctions, dependencyScore }`
  - `ParameterCountMetric`: `{ params }`
- Add `NodeMetricData` interface with:
  - file-level: `dependencyCentrality?`, `linesPerFile?`
  - function-level: `functionLength?`, `dependencySummary?`, `parameterCount?`
  - container aggregates: `sums?`, `averages?`, `childCount?`
- Add `metadata?: NodeMetricData` to `GraphNode`.

## 2. Data loading — `src/app/services/graph-data.service.ts`

- Add the 5 endpoints to the existing `forkJoin` using
  `metrics.service.getMetric(repoId, name)` (already served by the generic REST
  client and present in stubs; no backend change):
  - `dependencyCentrality` -> `dependency-centrality`
  - `functionLength` -> `function-length`
  - `functionDependencySummary` -> `function-dependency-summary`
  - `linesPerFile` -> `lines-per-file`
  - `parameterCount` -> `parameter-count`
- Keep the silent `catchError(() => of({ result: {} }))` pattern so a failed
  metric is non-fatal.
- Pass the new data into the metadata builder in `buildGraph`.

## 3. Metadata computation — new `NodeMetricBuilderService`

Runs once at build time in `GraphDataService.buildGraph`; nodes are static
afterward, so no per-tick cost.

- **FILE**: attach `dependency-centrality` + `lines-per-file`.
- **FUNCTION/METHOD**: attach `function-length` + `function-dependency-summary` +
  `parameter-count`, matched to `file::name` node IDs. Normalize method keys by
  suffix match against `functions-per-file` keys, mirroring the naming detection
  in `GraphHierarchyBuilderService.buildStandaloneFunctions`.
- **CLASS**: aggregate child methods — sum of lines, sum of params, sum of
  fanIn/fanOut calls + functions, avg dependencyScore.
- **DIRECTORY**: walk descendants -> sum `total/nonEmpty/blank`, sum in/out
  degree, avg centrality; expose both `sums` and per-child `averages` +
  `childCount`.

## 4. Rendering lens — `src/app/components/base-graph.component.ts`

- In `updateNodes()`, attach `mouseenter`/`mouseleave` to node groups purely to
  reveal/hide the "ⓘ" lens element next to the label (no data on hover).
- Lens **click** pins the full popup via a new
  `nodePopup: signal<{ node, position, pinned } | null>` (mirrors `edgePopup`).
- Clicking the node circle still expands/collapses; clicking graph background
  closes the popup and hides the lens (existing pattern).
- Generalize `updatePopupPosition()` (SVG CTM -> screen coords) to also anchor
  the node popup during pan/zoom/sim movement.

## 5. Rendering popup — `GraphWrapperComponent` + new `NodePopupComponent`

- `GraphWrapperComponent`: add `nodePopupData` input + `closeNodePopup` output;
  render `NodePopupComponent` beside `EdgePopupComponent` (fixed-position card,
  design-system classes).
- All 3 graph templates (`hierarchical`, `module-class`, `module-function`) wire
  `[nodePopupData]="nodePopup()"` + `(closeNodePopup)="nodePopup.set(null)"`.

## 6. NodePopupComponent

- Shows everything: categorized rows (Dependencies / Size / Structure),
  `sums` + `averages` for container nodes, omits rows without data.
- Pinned only via the lens; no hover content.

## 7. Verification

- `npm run lint` + `npm run build` (confirm exact scripts in `package.json`
  during implementation); manual check on all 3 graphs.
