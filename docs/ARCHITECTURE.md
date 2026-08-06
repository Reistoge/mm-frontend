# mm-frontend Architecture

## Tech Stack

| Technology | Purpose |
|---|---|
| **Angular 19** (standalone, no NgModules) | Framework |
| **TypeScript 5.6** (strict) | Language |
| **Tailwind CSS 4.1** | Styling |
| **D3.js 7.9** | Force-directed graph visualization |
| **ECharts 6.0** | Metric bar charts |
| **Angular Signals** | State management (no NgRx/Redux) |
| **Angular Router** (hash-based) | Routing |

## Project Layout

```
src/
  app/
    components/           # Graph components
      base-graph.component.ts        # Abstract D3 base (Template Method)
      hierarchical-graph/            # Full DIR→FILE→CLASS→FUNC tree
      module-class-graph/            # Module→Class coupling view
      module-function-graph/         # Module→Function coupling view
      graph-wrapper/                 # Visual wrapper (legend, controls, tree modal)
      graph-tree-modal/              # Searchable node tree
    services/
      graph-data.service.ts          # Orchestrator: fetches + builds graph
      graph-hierarchy-builder.service.ts   # Node hierarchy builder
      graph-link-aggregator.service.ts     # Primitive edges + file/module aggregation
      metrics.service.ts             # REST client for metric endpoints
      repos.service.ts               # REST client for repo CRUD
      chart-renderer.service.ts      # ECharts bar chart rendering
    pages/
      repos-page/                    # Repo list (add/delete)
      repo-detail-page/              # Repo detail: scan + graph view
    config/
      d3-config.ts                   # D3 physics, colors, enclosure config
    design-system/                   # Semantic tokens (colors, typography, spacing)
    types/
      graph.types.ts                 # GraphNode, GraphLink, HierarchicalData, Enclosure
      metrics.types.ts               # Metric DTOs
  environments/
    environment.ts                   # apiBase + useStubs flag
```

## Core Architecture: Graph Loading Pipeline

The graph is loaded through a 3-stage pipeline:

### Stage 1: Data Fetching (`GraphDataService.loadHierarchy`)

Fetches **6 metrics in parallel** via `forkJoin`:

```
files, classes-per-file, class-coupling,
functions-per-file, function-coupling, file-coupling
```

All failures silently default to `{ result: {} }`.

### Stage 2: Graph Construction (in `buildGraph()`)

```typescript
// 1. Build node hierarchy
hierarchyBuilder.buildHierarchy(data)
  -> buildDirectories():   Splits file paths → DIRECTORY + FILE nodes
  -> buildClassesAndMethods(): CLASS + METHOD nodes from class metrics
  -> buildStandaloneFunctions(): FUNCTION nodes from func metrics

// 2. Build links (primitive edges + multi-level aggregation)
linkAggregator.buildAllLinks(data, nodesMap, classToFilesMap, functionToFileMap, fileCoupling)
  -> Level 0: primitive function/method edges
     1. FUNCTION FILE -> FUNCTION FILE   (function-coupling fan-out, CALL)
     2. CLASS FUNCTION -> CLASS FUNCTION (class-coupling fan-out + NewExpression scan, CALL/INSTANTIATE)
     3. CLASS FUNCTION -> FUNCTION FILE  (CallExpression scan of method bodies, CALL)
     4. FUNCTION FILE -> CLASS FUNCTION  (CallExpression/NewExpression scan of bodies, CALL/INSTANTIATE)
  -> Level 1: CLASS -> CLASS aggregation
  -> Level 2: FILE -> FILE / CLASS -> FILE / FILE -> CLASS (FILE->FILE IMPORTS from file-coupling fanOut)
  -> Level 3: MODULE relationships (MODULE -> MODULE and module <-> entity)
```

Edges carry **counts per dependency type** (`imports`, `calls`, `instantiates`); types with count 0 are
omitted. fan-in is **never** used to build edges (a call appears in the caller's fan-out by construction),
which avoids double counting. Primitive edges are emitted into the link set as well, so fully-expanded
function/method views keep their links.

### Stage 3: Rendering (`BaseGraphComponent.initSimulation`)

1. Calls abstract `filterNodesAndLinks()` — subclass decides which nodes are visible
2. Creates D3 force simulation with 6 forces:
   - **charge** (repulsion) — pushes nodes apart
   - **link** (spring) — pulls connected nodes together
   - **center** (gravity) — keeps graph centered
   - **collide** — prevents overlap
   - **cluster** — pulls siblings toward centroid
   - **enclosure** — leash/push for parent bubbles
3. Renders SVG: nodes as circles, links as lines with arrow markers, enclosures as dashed bubbles

### Interaction Model

- **Click node** → expand: replaces node with its children at same position
- **Click enclosure** → collapse: replaces children with parent at enclosure center
- **Drag** → manual repositioning
- **Zoom** → pan/zoom via D3 zoom behavior

## Graph Views (3 variants via Template Method)

`BaseGraphComponent` is an abstract class with 3 concrete subclasses:

| Component | Shows | Physics Config | Overrides |
|---|---|---|---|
| `HierarchicalGraphComponent` | Full DIR→FILE→CLASS→FUNC tree | `HIERARCHICAL` | `filterNodesAndLinks` (standard) |
| `ModuleClassGraphComponent` | Module→Class coupling | `MODULE_CLASS` | `filterNodesAndLinks` + custom `calculateEnclosures` (all descendants, not just direct children) |
| `ModuleFunctionGraphComponent` | Module→Function coupling | `MODULE_FUNCTION` | `filterNodesAndLinks` (standard) |

Key customization points (abstract methods):
- `getPhysicsConfig()` → charge, link distance, center, collide params
- `getColorScheme()` → map NodeType → hex color
- `getRadiusScheme()` → map NodeType → circle radius
- `filterNodesAndLinks()` → select visible nodes before simulation

## Data Flow: Repo Detail Page

```
User opens /repos/:id
  → RepoDetailPageComponent.load()
    → ReposService.getRepo(id)     — loads repo metadata
  → User selects report type (hierarchical/module-class/module-function)
    → Shows corresponding graph component

User clicks "Run Scan"
  → ReposService.scanRepo(id)
    → scanVersion++ triggers reloadTrigger input change on graph
      → BaseGraphComponent.ngOnChanges
        → GraphDataService.loadHierarchy(repoId)
          → (pipeline above)
```

## State Management

There is **no global store**. All state is component-local via Angular Signals:
- `signal()` for mutable state (loading, error, selected report, scan version)
- `computed()` for derived values
- Services are **stateless** — they fetch-and-return via Observables

The `reloadTrigger` input on graph components is a `number` signal — incrementing it triggers `ngOnChanges` → full reload.

## Link Aggregation Behavior

Two view levels determine which links are shown in `rebuildLinks()`:

| Visible Nodes | Links Shown |
|---|---|
| Only `DIRECTORY` nodes | `level === 'module'` (deduplicated module→module) |
| Any non-directory node | `!level \|\| level === 'file'` (individual file→file) |

When a link endpoint is hidden (collapsed), `findVisible()` walks up the parent chain to the nearest
visible ancestor. Multiple `GraphLink`s that resolve to the same rendered (source, target) pair are merged
per `level === 'file'`; edges at different aggregation depths are **deduplicated by ancestor distance** so a
more specific edge (e.g. a method→method primitive) is shown and the coarser aggregated edge that would
otherwise double-count it is skipped. Each rendered link is labeled with its per-type counts via
`formatLinkCounts` (e.g. `2 calls · 3 instantiates`), and the edge popup shows a badge per type plus
forward/reverse counts on bidirectional edges.

## Environment / Stub Mode

`src/environments/environment.ts`:
- `useStubs: true` → all metrics load from `/json/stub-data.json` instead of API
- `apiBase: 'http://localhost:3000'` → backend URL

## Metrics Backend Documentation

See `src/app/services/docs.md` for detailed metric specs:
- `files` — array of file paths
- `classes-per-file` — per-file class → method list
- `class-coupling` — method fan-in/fan-out between classes
- `functions-per-file` — per-file named function list
- `function-coupling` — function fan-in/fan-out
- `file-coupling` — file import fan-in/fan-out
- `instance-mapper` — internal helper for class-coupling (not exposed)
