# Plan: Edge Types and Link Aggregation

## Context

jtmetrics doesn't expose dependency types explicitly, but the `files`, `classes-per-file`,
`functions-per-file`, `class-coupling`, `function-coupling`, and `file-coupling` metrics
carry enough information (AST bodies, fan-in/fan-out maps) to derive **IMPORTS**,
**CALL**, **INSTANTIATE**, **INHERITS**, and **IMPLEMENTS** dependency types.

- `functions-per-file` records only **standalone (top-level) functions**; functions inside
  classes are **not** included — use `classes-per-file` for those.
- `INHERITS` / `IMPLEMENTS` are **deferred**: the metrics don't yet expose reliable
  inheritance/implements data.
- The current code emits single-typed edges (`DEPENDENCY`/`COUPLING`/`CALL`). This plan
  replaces that with per-pair edges that carry **counts per dependency type**.

## Edge model

An **edge** connects a (source, target) pair and aggregates **counts per dependency type**.
One edge can carry several types at once (e.g. `imports: 2, calls: 2, instantiates: 3`).

| Type | Meaning | Count rule |
|---|---|---|
| `IMPORTS` | The source *uses* functions/classes that belong to the target. | Distinct **top-level target entities** (CLASS or FUNCTION) referenced by the source **across a file boundary**. References within the same class or same file never count. Exception: at **FILE→FILE** it is the count of import statements from `file-coupling.fanOut`. |
| `CALL` | The source invokes a method/function of the target. | Sum of call counts of all primitive `CALL` edges from the source to the target. |
| `INSTANTIATE` | The source constructs (`new`) a class of the target. | Sum of counts of all primitive `INSTANTIATE` edges from the source to the target. |

Conventions:

- **Direction:** edges point from the *dependent/caller* (source) to the *dependency/callee*
  (target) — i.e. the **fan-out** of the source.
- **No double counting:** fan-out records are the single source of truth. **fan-in is never
  used to build edges** (a call appears in the caller's fan-out by construction).
- An edge exists between a pair iff at least one primitive edge (or, for FILE→FILE, one
  import statement) connects them. Types with count 0 are omitted.
- `level: 'file' | 'module'` marks whether an edge is a file-level or module-level
  aggregation. Both coexist in the same dataset.

## Entities

- `FILE` — a source file (leaf of the directory tree).
- `CLASS` — a class in a file; **CLASS FUNCTION** (method) is a function whose parent is a CLASS.
- `FUNCTION` — a standalone function whose parent is a FILE.
- `MODULE` — a **directory** (equivalent to `DIRECTORY`); a file's module is its nearest
  enclosing directory. A module contains sub-modules, files, classes, and functions.

## Level 0 — Primitive edges (function ↔ function)

The base unit. Each primitive edge is directed (source entity → target entity) and carries
a dependency type and count. Sources:

1. **FUNCTION FILE → FUNCTION FILE** — from `function-coupling` fan-out. Type `CALL`.
2. **CLASS FUNCTION → CLASS FUNCTION** — from `class-coupling` fan-out. Target `_constructor`
   → `INSTANTIATE`, otherwise `CALL`. Additionally scan each class method's AST body for
   `NewExpression` callees that resolve to a class; if its constructor isn't already covered
   by the fan-out, add an `INSTANTIATE` edge to `_constructor` (also covers classes with no
   explicit constructor).
3. **CLASS FUNCTION → FUNCTION FILE** — scan each class method's AST body for
   `CallExpression` callees that resolve to a standalone function in `functions-per-file`.
   Type `CALL`.
4. **FUNCTION FILE → CLASS FUNCTION** — scan each standalone function's AST body for
   `CallExpression` / `NewExpression` callees that resolve to a class method or constructor
   in `classes-per-file`. Type `CALL` (method) / `INSTANTIATE` (constructor).

`INSTANTIATE` is therefore detected two ways: the `_constructor` heuristic (coupling
fan-out) and AST `NewExpression` scanning. fan-in records are never used.

## Level 1 — CLASS → CLASS

Aggregate primitive edge type #2 by (source class, target class). One edge per class pair:
- `IMPORTS` = 1 if the target class is referenced from a **different file**; 0 if both
  classes live in the same file.
- `CALL` / `INSTANTIATE` = sum of the corresponding primitive counts.

## Level 2 — FILE relationships

- **FILE → FILE:** aggregate all primitive edges from any entity in file S to any entity in
  file T. `IMPORTS` = import statements from `file-coupling.fanOut` (1 if S imports T);
  `CALL` / `INSTANTIATE` = sums across all four primitive edge types.
- **CLASS → FILE:** aggregate `CLASS FUNCTION → FUNCTION FILE` edges from class C to file T.
  `IMPORTS` = distinct standalone functions in T referenced by C (always cross-file);
  `CALL` = sum; `INSTANTIATE` not applicable.
- **FILE → CLASS:** aggregate `FUNCTION FILE → CLASS FUNCTION` edges from file S to class C.
  `IMPORTS` = 1 if any entity in S references C (always cross-file);
  `CALL` / `INSTANTIATE` = sums.

## Level 3 — MODULE relationships

"Module of X" = X or any descendant entity of X's directory subtree. Each edge aggregates
the primitive edges between the contained entities using the standard count rules.

- **MODULE → MODULE:** all primitive edges from entities in M1 to entities in M2.
- **MODULE → FILE:** entities inside the module → file T.
- **FILE → MODULE:** file S → entities inside the module.
- **MODULE → CLASS:** entities inside the module → class C.
- **CLASS → MODULE:** class C's methods → entities inside the module.
- **MODULE → FILE FUNCTION:** entities inside the module → standalone function F.
- **MODULE → CLASS FUNCTION:** entities inside the module → method of class C.
- **CLASS FUNCTION → MODULE:** method f's fan-out into the module.
- **FILE FUNCTION → MODULE:** standalone function f's fan-out into the module.

`IMPORTS` at these levels = distinct top-level target entities (CLASS or FUNCTION) inside
the target referenced from a **different file**; `CALL`/`INSTANTIATE` = summed primitive
counts.

## Visualization

- Each edge renders as **one line** (merged per pair) labeled with its per-type counts, e.g.
  `2 imports · 2 calls · 3 instantiates`.
- Optional: line color/styles per dependency type (e.g. dashed = imports).
- `level: 'module'` edges show in the directory-only view; `file` edges in deeper views
  (current `rebuildLinks` behavior).

## Tasks

- Change `GraphLink` to carry per-type counts (`imports`, `calls`, `instantiates`) instead of
  a single `type` + `value`; render one edge per pair.
- Build the 4 primitive edge types from the fan-out-only rule (fixes the current
  double-counting bug).
- Implement AST `CallExpression`/`NewExpression` scanning for primitive edges #3 and #4.
- Implement Level 1 → 3 aggregations; `IMPORTS` = file-coupling statements at FILE→FILE,
  usage-derived distinct cross-file top-level entities everywhere else.
- Defer `INHERITS` / `IMPLEMENTS`.
