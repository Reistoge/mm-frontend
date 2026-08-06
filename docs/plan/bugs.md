What works: Node hierarchy (DIRECTORY→FILE→CLASS→FUNCTION) builds correctly. Method/function/class/file/module-level links ARE produced, and CALL/INSTANTIATE/IMPORTS typing via the constructor heuristic works.

Confirmed bug — double-counting of edges: In buildMethodLevelCoupling (graph-link-aggregator.service.ts:246-275) and buildFunctionLevelCoupling (:373-393), the fan-in skip check (if (methodLinks.has(linkKey)) return) only dedupes if the matching fan-out edge was already created earlier in iteration. Fan-in/fan-out of the same edge are redundant by construction, but iteration is object-key order, so a fan-in is often processed before its fan-out. Verified: DataAdapter::normalize → DataProcessor::prepare yields value 2 instead of 1 (stub data). This also affects function-level edges in general.
Bigger gap — plan features not implemented at all:

- FUNCTION CLASS → FUNCTION FILE (class method calling a standalone function): no metric provides this; only NewExpression is scanned in AST bodies, not CallExpression. So CLASS→FILE edges (plan line 25) don't exist.
- FILE → CLASS edges (plan line 27): function→class links are dropped at buildFileLevelCoupling (:632-655) since it only aggregates when both parents are FILE.
- All MODULE→CLASS/→FUNCTION and CLASS/FUNCTION→MODULE relationships (plan lines 31-49): nothing implements them. buildModuleLevelCoupling only does DIRECTORY→DIRECTORY. The module-class-graph and module-function-graph components render the same tree as the hierarchical graph.
- Function-level NewExpression→constructor INSTANTIATE only fires when the target class has an explicit constructor node (classes without constructors are missed).
  Side issues: metrics.types.ts:84-91 has 3 type errors under tsc --noEmit (won't fail ng build since the importer is unused). Also the graph opens showing only the root folder with zero edges (all links collapse to root) — can look "broken" until expanded.
