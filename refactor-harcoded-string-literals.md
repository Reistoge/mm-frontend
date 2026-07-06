# Refactor: Replace hardcoded string literals with runtime constants

Replace raw string literals (`'DEPENDENCY'`, `'fan-in'`, `'DIRECTORY'`, etc.) with named constant references (`LinkTypeValues.DEPENDENCY`, `LinkDirectionValues.FAN_IN`, `NodeTypeValues.DIRECTORY`).

---

## 1. `src/app/types/graph.types.ts`

Add runtime constant objects and derive the existing type aliases from them.

```typescript
export const LinkTypeValues = {
  DEPENDENCY: 'DEPENDENCY',
  COUPLING: 'COUPLING',
  CALL: 'CALL',
} as const;
export type LinkType = (typeof LinkTypeValues)[keyof typeof LinkTypeValues];

export const LinkDirectionValues = {
  FAN_IN: 'fan-in',
  FAN_OUT: 'fan-out',
} as const;
export type LinkDirection = (typeof LinkDirectionValues)[keyof typeof LinkDirectionValues];

export const NodeTypeValues = {
  DIRECTORY: 'DIRECTORY',
  FILE: 'FILE',
  CLASS: 'CLASS',
  FUNCTION: 'FUNCTION',
  METHOD: 'METHOD',
} as const;
export type NodeType = (typeof NodeTypeValues)[keyof typeof NodeTypeValues];
```

The three type aliases remain unchanged in meaning — they're now derived from the const objects so the values stay in sync.

---

## 2. `src/app/services/graph-link-aggregator.service.ts`

**Inline type annotations** — change inline unions to use the type alias:
```
Map<string, { count: number; direction: 'fan-out' | 'fan-in' }>
```
→
```
Map<string, { count: number; direction: LinkDirection }>
```
(Lines: 35, 39, 43, 86, 191, 253, 255, 256, 387, 389, 392)

**`type` field assignments** — replace string literal with constant:
- `type: 'DEPENDENCY'`  → `type: LinkTypeValues.DEPENDENCY`  (lines 71, 515)
- `type: 'COUPLING'`    → `type: LinkTypeValues.COUPLING`    (lines 376, 448)
- `type: 'CALL'`        → `type: LinkTypeValues.CALL`        (lines 177, 242)

**`direction` field assignments** — replace string literal with constant:
- `direction: 'fan-out'` → `direction: LinkDirectionValues.FAN_OUT` (lines 138, 212, 342)
- `direction: 'fan-in'`  → `direction: LinkDirectionValues.FAN_IN`  (lines 162, 229, 362)

**Default values in `||` fallbacks**:
- `|| { count: 0, direction: 'fan-out' }` → `|| { count: 0, direction: LinkDirectionValues.FAN_OUT }` (lines 135, 209, 339)
- `|| { count: 0, direction: 'fan-in' }`  → `|| { count: 0, direction: LinkDirectionValues.FAN_IN }`  (lines 159, 226, 359)

**NOT changed** — raw JSON data access keys (`method['fan-out']`, `details['fan-in']`, etc.) remain as strings since they match the backend API field names, not our type constants.

---

## 3. `src/app/services/graph-hierarchy-builder.service.ts`

- `type: 'DIRECTORY'` → `type: NodeTypeValues.DIRECTORY` (line 65)
- `type: 'FILE'`     → `type: NodeTypeValues.FILE`     (line 88)
- `type: 'CLASS'`    → `type: NodeTypeValues.CLASS`    (line 130)
- `type: 'FUNCTION'` → `type: NodeTypeValues.FUNCTION` (lines 152, 202)

Also replace inline comparisons:
- `c.type === 'CLASS'` → `c.type === NodeTypeValues.CLASS` (line 189)

---

## 4. `src/app/components/base-graph.component.ts`

- `n.type === 'DIRECTORY'` → `n.type === NodeTypeValues.DIRECTORY` (line 465)

---

## 5. `src/app/components/module-class-graph/module-class-graph.component.ts`

- `n.type === 'DIRECTORY'` → `n.type === NodeTypeValues.DIRECTORY` (line 99)

---

## 6. `src/app/utils/function-coupling-util.ts`

- `'fan-out'` → `LinkDirectionValues.FAN_OUT` (line 19)

---

## Tests

No existing unit tests cover the files being refactored (only `app.component.spec.ts` exists in the project). The refactor is purely mechanical (identical values, no behavior change), so no test updates are strictly needed.

If desired, a new test could be added for `graph-link-aggregator.service.ts` to verify link creation, but that's out of scope for this string-literal refactor.
