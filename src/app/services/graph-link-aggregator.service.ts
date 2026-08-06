import { Injectable } from '@angular/core';
import { GraphNode, GraphLink, LinkCounts, LinkType, LinkTypeValues } from '../types/graph.types';

/**
 * Aggregation levels used for GraphLink.level:
 * - 'file': file/class level edges (FILE→FILE, CLASS→CLASS, CLASS→FILE, FILE→CLASS)
 * - 'module': directory→directory edges (MODULE→MODULE)
 * - 'module-entity': module → specific entity edges (MODULE→CLASS, CLASS→MODULE, etc.)
 */
type LevelKey = 'file' | 'module' | 'module-entity';

/** A single directed function/method-level dependency edge. */
interface PrimitiveEdge {
  source: string;
  target: string;
  type: LinkType;
  count: number;
}

/** Accumulated per-type counts for one aggregated (source, target) pair. */
interface AggCounts {
  calls: number;
  instantiates: number;
  /** Distinct top-level target entities referenced across a file boundary. */
  imports: Set<string>;
}

/* ------------------------------------------------------------------ */
/* AST helpers                                                          */
/* ------------------------------------------------------------------ */

function walkBody(body: unknown, visit: (node: Record<string, unknown>) => void): void {
  if (!body || typeof body !== 'object') return;
  if (Array.isArray(body)) {
    body.forEach((b) => walkBody(b, visit));
    return;
  }
  const obj = body as Record<string, unknown>;
  visit(obj);
  for (const val of Object.values(obj)) walkBody(val, visit);
}

/** Counts `new Foo()` occurrences keyed by callee name. */
function extractNewExpressionCalleeCounts(body: unknown): Map<string, number> {
  const counts = new Map<string, number>();
  walkBody(body, (node) => {
    if (node['type'] !== 'NewExpression') return;
    const callee = node['callee'] as Record<string, unknown> | undefined;
    if (callee?.['type'] === 'Identifier' && typeof callee['name'] === 'string') {
      counts.set(callee['name'], (counts.get(callee['name']) || 0) + 1);
    }
  });
  return counts;
}

/** Counts direct calls `foo()` keyed by callee name. */
function collectIdentifierCallCounts(body: unknown): Map<string, number> {
  const counts = new Map<string, number>();
  walkBody(body, (node) => {
    if (node['type'] !== 'CallExpression') return;
    const callee = node['callee'] as Record<string, unknown> | undefined;
    if (callee?.['type'] === 'Identifier' && typeof callee['name'] === 'string') {
      counts.set(callee['name'], (counts.get(callee['name']) || 0) + 1);
    }
  });
  return counts;
}

/** Counts member calls `obj.method()` grouped by object name → method name. */
function collectMemberCallCounts(body: unknown): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  walkBody(body, (node) => {
    if (node['type'] !== 'CallExpression') return;
    const callee = node['callee'] as Record<string, unknown> | undefined;
    if (callee?.['type'] !== 'MemberExpression') return;
    const obj = callee['object'] as Record<string, unknown> | undefined;
    const prop = callee['property'] as Record<string, unknown> | undefined;
    if (obj?.['type'] !== 'Identifier' || prop?.['type'] !== 'Identifier') return;
    if (obj['name'] === 'this') return;
    const objName = obj['name'] as string;
    const propName = prop['name'] as string;
    let methods = result.get(objName);
    if (!methods) {
      methods = new Map();
      result.set(objName, methods);
    }
    methods.set(propName, (methods.get(propName) || 0) + 1);
  });
  return result;
}

/** Resolves `const x = new Foo()` local bindings to their class names. */
function resolveLocalInstances(body: unknown): Map<string, string> {
  const instances = new Map<string, string>();
  walkBody(body, (node) => {
    if (node['type'] !== 'VariableDeclaration') return;
    const declarations = node['declarations'];
    if (!Array.isArray(declarations)) return;
    for (const decl of declarations) {
      const d = decl as Record<string, unknown>;
      const id = d['id'] as Record<string, unknown> | undefined;
      const init = d['init'] as Record<string, unknown> | undefined;
      if (id?.['type'] !== 'Identifier' || init?.['type'] !== 'NewExpression') continue;
      const callee = init['callee'] as Record<string, unknown> | undefined;
      if (callee?.['type'] === 'Identifier' && typeof callee['name'] === 'string') {
        instances.set(id['name'] as string, callee['name']);
      }
    }
  });
  return instances;
}

/* ------------------------------------------------------------------ */
/* Edge accumulator                                                     */
/* ------------------------------------------------------------------ */

/**
 * Accumulates primitive edges into per-(source, target) counts at every
 * aggregation level (Level 1: CLASS→CLASS, Level 2: FILE relationships,
 * Level 3: MODULE relationships). IMPORTS counts are usage-derived distinct
 * cross-file top-level target entities, except at FILE→FILE where they come
 * from file-coupling statements.
 */
class EdgeAccumulator {
  private edges = new Map<string, AggCounts>();

  constructor(private nodesMap: Map<string, GraphNode>) {}

  /** Nearest FILE ancestor of a node id. */
  private fileId(nodeId: string): string | undefined {
    const seen = new Set<string>();
    let cur = this.nodesMap.get(nodeId);
    while (cur && cur.type !== 'FILE') {
      if (!cur.parentId || seen.has(cur.id)) return undefined;
      seen.add(cur.id);
      cur = this.nodesMap.get(cur.parentId);
    }
    return cur?.type === 'FILE' ? cur.id : undefined;
  }

  /** Top-level entity for a primitive edge target: CLASS for methods, itself for functions/classes. */
  private topLevelId(nodeId: string): string {
    const node = this.nodesMap.get(nodeId);
    if (node && node.type === 'FUNCTION' && node.parentId) {
      const parent = this.nodesMap.get(node.parentId);
      if (parent?.type === 'CLASS') return parent.id;
    }
    return nodeId;
  }

  /** Nearest DIRECTORY (module) ancestor of a file node. */
  private moduleId(fileId: string): string | undefined {
    const fileNode = this.nodesMap.get(fileId);
    if (!fileNode?.parentId) return undefined;
    const seen = new Set<string>();
    let cur = this.nodesMap.get(fileNode.parentId);
    while (cur && cur.type !== 'DIRECTORY') {
      if (!cur.parentId || seen.has(cur.id)) return undefined;
      seen.add(cur.id);
      cur = this.nodesMap.get(cur.parentId);
    }
    return cur?.type === 'DIRECTORY' ? cur.id : undefined;
  }

  private upsert(
    level: LevelKey,
    src: string,
    tgt: string,
    type: LinkType,
    count: number,
    importTarget: string | undefined,
  ): void {
    const key = `${level}::${src}->${tgt}`;
    let e = this.edges.get(key);
    if (!e) {
      e = { calls: 0, instantiates: 0, imports: new Set() };
      this.edges.set(key, e);
    }
    if (type === LinkTypeValues.CALL) e.calls += count;
    else if (type === LinkTypeValues.INSTANTIATE) e.instantiates += count;
    if (importTarget) e.imports.add(importTarget);
  }

  add(e: PrimitiveEdge): void {
    const srcNode = this.nodesMap.get(e.source);
    const tgtNode = this.nodesMap.get(e.target);
    if (!srcNode || !tgtNode) return;

    const srcFile = this.fileId(e.source);
    const tgtFile = this.fileId(e.target);
    if (!srcFile || !tgtFile) return;

    const importTarget = srcFile !== tgtFile ? this.topLevelId(e.target) : undefined;

    const srcParent = srcNode.parentId ? this.nodesMap.get(srcNode.parentId) : undefined;
    const tgtParent = tgtNode.parentId ? this.nodesMap.get(tgtNode.parentId) : undefined;

    const srcClassId =
      srcNode.type === 'CLASS'
        ? e.source
        : srcParent?.type === 'CLASS'
          ? srcNode.parentId
          : undefined;
    const tgtClassId =
      tgtNode.type === 'CLASS'
        ? e.target
        : tgtParent?.type === 'CLASS'
          ? tgtNode.parentId
          : undefined;

    const srcIsStandaloneFunc = srcNode.type === 'FUNCTION' && srcParent?.type === 'FILE';
    const tgtIsStandaloneFunc = tgtNode.type === 'FUNCTION' && tgtParent?.type === 'FILE';
    const srcIsMethod = srcNode.type === 'FUNCTION' && srcParent?.type === 'CLASS';
    const tgtIsMethod = tgtNode.type === 'FUNCTION' && tgtParent?.type === 'CLASS';

    // Level 2 — FILE → FILE (usage-derived CALL/INSTANTIATE; IMPORTS come from file-coupling)
    if (srcFile !== tgtFile) {
      this.upsert('file', srcFile, tgtFile, e.type, e.count, undefined);
    }

    // Level 1 — CLASS → CLASS
    if (srcClassId && tgtClassId && srcClassId !== tgtClassId) {
      this.upsert('file', srcClassId, tgtClassId, e.type, e.count, importTarget);
    }

    // Level 2 — CLASS → FILE (class method → standalone function in another file)
    if (srcClassId && tgtIsStandaloneFunc && srcFile !== tgtFile) {
      this.upsert('file', srcClassId, tgtFile, e.type, e.count, importTarget);
    }

    // Level 2 — FILE → CLASS (standalone function → class method/class in another file)
    if (srcIsStandaloneFunc && tgtClassId && srcFile !== tgtFile) {
      this.upsert('file', srcFile, tgtClassId, e.type, e.count, importTarget);
    }

    // Level 3 — MODULE relationships (cross-module only)
    const srcMod = this.moduleId(srcFile);
    const tgtMod = this.moduleId(tgtFile);
    if (srcMod && tgtMod && srcMod !== tgtMod) {
      this.upsert('module', srcMod, tgtMod, e.type, e.count, importTarget); // MODULE → MODULE
      this.upsert('module-entity', srcMod, tgtFile, e.type, e.count, importTarget); // MODULE → FILE
      this.upsert('module-entity', srcFile, tgtMod, e.type, e.count, importTarget); // FILE → MODULE
      if (tgtClassId) {
        this.upsert('module-entity', srcMod, tgtClassId, e.type, e.count, importTarget); // MODULE → CLASS
      }
      if (srcClassId) {
        this.upsert('module-entity', srcClassId, tgtMod, e.type, e.count, importTarget); // CLASS → MODULE
      }
      if (tgtIsStandaloneFunc) {
        this.upsert('module-entity', srcMod, e.target, e.type, e.count, importTarget); // MODULE → FILE FUNCTION
      }
      if (tgtIsMethod) {
        this.upsert('module-entity', srcMod, e.target, e.type, e.count, importTarget); // MODULE → CLASS FUNCTION
      }
      if (srcIsMethod) {
        this.upsert('module-entity', e.source, tgtMod, e.type, e.count, importTarget); // CLASS FUNCTION → MODULE
      }
      if (srcIsStandaloneFunc) {
        this.upsert('module-entity', e.source, tgtMod, e.type, e.count, importTarget); // FILE FUNCTION → MODULE
      }
    }
  }

  /** Adds FILE→FILE IMPORTS edges from file-coupling statements (1 per import). */
  addFileImports(
    fileCoupling: Record<string, { fanIn: string[]; fanOut: string[] }> | undefined,
  ): void {
    if (!fileCoupling) return;
    for (const [src, coupling] of Object.entries(fileCoupling)) {
      if (!this.nodesMap.has(src)) continue;
      for (const tgt of coupling.fanOut ?? []) {
        if (this.nodesMap.has(tgt) && src !== tgt) {
          this.upsert('file', src, tgt, LinkTypeValues.IMPORTS, 1, tgt);
        }
      }
    }
  }

  finalize(links: GraphLink[]): void {
    for (const [key, e] of this.edges) {
      const sepIdx = key.indexOf('::');
      const level = key.substring(0, sepIdx) as LevelKey;
      const pair = key.substring(sepIdx + 2);
      const dashIdx = pair.indexOf('->');
      const src = pair.substring(0, dashIdx);
      const tgt = pair.substring(dashIdx + 2);

      const counts: LinkCounts = {};
      if (e.calls > 0) counts[LinkTypeValues.CALL] = e.calls;
      if (e.instantiates > 0) counts[LinkTypeValues.INSTANTIATE] = e.instantiates;
      if (e.imports.size > 0) counts[LinkTypeValues.IMPORTS] = e.imports.size;

      links.push({ source: src, target: tgt, counts, level });
    }
  }
}

/**
 * Builds graph links from metrics data following the edge.md plan:
 *
 * Level 0 — primitive edges (fan-out only, fan-in never used to avoid double counting):
 *   1. FUNCTION FILE → FUNCTION FILE   (function-coupling fan-out, CALL)
 *   2. CLASS FUNCTION → CLASS FUNCTION (class-coupling fan-out + NewExpression scan, CALL/INSTANTIATE)
 *   3. CLASS FUNCTION → FUNCTION FILE  (CallExpression scan of class method bodies, CALL)
 *   4. FUNCTION FILE → CLASS FUNCTION  (CallExpression/NewExpression scan of function bodies, CALL/INSTANTIATE)
 * Level 1 — CLASS → CLASS aggregation
 * Level 2 — FILE → FILE, CLASS → FILE, FILE → CLASS aggregation
 * Level 3 — MODULE relationships (MODULE → MODULE and module ↔ entity aggregation)
 *
 * IMPORTS counts: distinct cross-file top-level target entities referenced (usage-derived),
 * except FILE→FILE which uses file-coupling import statements.
 */
@Injectable({ providedIn: 'root' })
export class GraphLinkAggregatorService {
  buildAllLinks(
    data: Record<string, unknown>,
    nodesMap: Map<string, GraphNode>,
    classToFilesMap: Map<string, string[]>,
    functionToFileMap: Map<string, string>,
    fileCoupling?: Record<string, { fanIn: string[]; fanOut: string[] }>,
  ): GraphLink[] {
    const primitives: PrimitiveEdge[] = [];

    const classes =
      (data['classes'] as { result?: Record<string, Record<string, unknown[]>> } | undefined)
        ?.result ?? {};
    const funcs =
      (data['funcs'] as { result?: Record<string, Record<string, unknown>> } | undefined)?.result ??
      {};
    const classCoupling =
      (data['classCoupling'] as { result?: Record<string, Record<string, unknown[]>> } | undefined)
        ?.result ?? {};
    const funcCoupling =
      (
        data['funcCoupling'] as
          | {
              result?: Record<
                string,
                Record<
                  string,
                  { 'fan-out'?: Record<string, number>; 'fan-in'?: Record<string, number> }
                >
              >;
            }
          | undefined
      )?.result ?? {};

    const normalize = (name: string): string => (name === 'constructor' ? '_constructor' : name);

    const findClassFile = (className: string): string | undefined => {
      const files = classToFilesMap.get(className);
      if (!files || files.length === 0) return undefined;
      for (const file of files) {
        if (nodesMap.has(`${file}::${className}`)) return file;
      }
      return files[0];
    };

    // name → all files that declare a standalone function with that name
    const functionNameToFiles = new Map<string, string[]>();
    Object.entries(funcs).forEach(([file, fnMap]) => {
      Object.keys(fnMap).forEach((name) => {
        const files = functionNameToFiles.get(name) || [];
        if (!files.includes(file)) files.push(file);
        functionNameToFiles.set(name, files);
      });
    });

    this.buildFunctionPrimitives(funcCoupling, nodesMap, functionToFileMap, primitives);
    this.buildClassPrimitives(
      classCoupling,
      nodesMap,
      classToFilesMap,
      findClassFile,
      normalize,
      primitives,
    );
    this.buildClassToFunctionPrimitives(
      classes,
      nodesMap,
      functionNameToFiles,
      normalize,
      primitives,
    );
    this.buildFunctionToClassPrimitives(
      funcs,
      nodesMap,
      classToFilesMap,
      findClassFile,
      normalize,
      primitives,
    );

    const accumulator = new EdgeAccumulator(nodesMap);
    primitives.forEach((e) => accumulator.add(e));
    accumulator.addFileImports(fileCoupling);

    const links: GraphLink[] = [];
    // Level 0 — emit primitive (function/method-level) edges so expanded views
    // keep their links. rebuildLinks dedups these against the aggregated edges
    // below, keeping the most specific edge per rendered (source, target) pair.
    primitives.forEach((p) => {
      const counts: LinkCounts = { [p.type]: p.count };
      links.push({ source: p.source, target: p.target, counts, level: 'file' });
    });
    accumulator.finalize(links);
    return links;
  }

  /** Level 0 #1 — FUNCTION FILE → FUNCTION FILE from function-coupling fan-out. */
  private buildFunctionPrimitives(
    funcCoupling: Record<
      string,
      Record<string, { 'fan-out'?: Record<string, number>; 'fan-in'?: Record<string, number> }>
    >,
    nodesMap: Map<string, GraphNode>,
    functionToFileMap: Map<string, string>,
    primitives: PrimitiveEdge[],
  ): void {
    for (const [srcFile, fnMap] of Object.entries(funcCoupling)) {
      for (const [srcFuncName, details] of Object.entries(fnMap)) {
        const srcId = `${srcFile}::${srcFuncName}`;
        if (!nodesMap.has(srcId)) continue;

        const fanOut = details['fan-out'] ?? {};
        for (const [targetFuncName, count] of Object.entries(fanOut)) {
          const targetFile = functionToFileMap.get(targetFuncName);
          if (!targetFile) continue;
          const targetId = `${targetFile}::${targetFuncName}`;
          if (!nodesMap.has(targetId) || srcId === targetId) continue;
          primitives.push({
            source: srcId,
            target: targetId,
            type: LinkTypeValues.CALL,
            count: Number(count),
          });
        }
      }
    }
  }

  /**
   * Level 0 #2 — CLASS FUNCTION → CLASS FUNCTION from class-coupling fan-out,
   * plus NewExpression fallback for instantiations not captured by fan-out
   * (also covers classes without an explicit constructor).
   */
  private buildClassPrimitives(
    classCoupling: Record<string, Record<string, unknown[]>>,
    nodesMap: Map<string, GraphNode>,
    classToFilesMap: Map<string, string[]>,
    findClassFile: (className: string) => string | undefined,
    normalize: (name: string) => string,
    primitives: PrimitiveEdge[],
  ): void {
    const instantiated = new Map<string, Set<string>>(); // srcId → instantiated class ids
    const markInstantiated = (srcId: string, classId: string): void => {
      let set = instantiated.get(srcId);
      if (!set) {
        set = new Set();
        instantiated.set(srcId, set);
      }
      set.add(classId);
    };

    for (const [file, clsMap] of Object.entries(classCoupling)) {
      for (const [className, methods] of Object.entries(clsMap)) {
        const classId = `${file}::${className}`;
        if (!nodesMap.has(classId)) continue;

        for (const method of methods) {
          const m = method as Record<string, unknown>;
          const key = m['key'] as Record<string, unknown> | undefined;
          const methodName = (key?.['name'] as string | undefined) || 'unknown';
          const srcId = `${classId}::${normalize(methodName)}`;
          if (!nodesMap.has(srcId)) continue;

          // fan-out
          const fanOut = (m['fan-out'] ?? {}) as Record<string, Record<string, number>>;
          for (const [targetClassName, targetMethods] of Object.entries(fanOut)) {
            const targetClassFile = findClassFile(targetClassName);
            if (!targetClassFile) continue;
            const targetClassId = `${targetClassFile}::${targetClassName}`;
            if (!nodesMap.has(targetClassId)) continue;

            for (const [targetMethodName, count] of Object.entries(targetMethods)) {
              const normalizedTargetName = normalize(targetMethodName);
              const targetId = `${targetClassId}::${normalizedTargetName}`;
              if (!nodesMap.has(targetId) || srcId === targetId) continue;
              if (normalizedTargetName === '_constructor') markInstantiated(srcId, targetClassId);
              primitives.push({
                source: srcId,
                target: targetId,
                type:
                  normalizedTargetName === '_constructor'
                    ? LinkTypeValues.INSTANTIATE
                    : LinkTypeValues.CALL,
                count: Number(count),
              });
            }
          }

          // NewExpression fallback (instantiations not covered by fan-out)
          const newExprCounts = extractNewExpressionCalleeCounts(m['body']);
          for (const [calleeName, count] of newExprCounts) {
            const targetFiles = classToFilesMap.get(calleeName);
            if (!targetFiles) continue;
            for (const targetFile of targetFiles) {
              const targetClassId = `${targetFile}::${calleeName}`;
              if (srcId === targetClassId) continue;
              if (!nodesMap.has(targetClassId)) continue;
              if (instantiated.get(srcId)?.has(targetClassId)) continue;
              markInstantiated(srcId, targetClassId);

              const ctorId = `${targetClassId}::_constructor`;
              const target = nodesMap.has(ctorId) ? ctorId : targetClassId;
              primitives.push({
                source: srcId,
                target,
                type: LinkTypeValues.INSTANTIATE,
                count,
              });
            }
          }
        }
      }
    }
  }

  /** Level 0 #3 — CLASS FUNCTION → FUNCTION FILE via CallExpression scan of class method bodies. */
  private buildClassToFunctionPrimitives(
    classes: Record<string, Record<string, unknown[]>>,
    nodesMap: Map<string, GraphNode>,
    functionNameToFiles: Map<string, string[]>,
    normalize: (name: string) => string,
    primitives: PrimitiveEdge[],
  ): void {
    for (const [file, clsMap] of Object.entries(classes)) {
      for (const [className, methods] of Object.entries(clsMap)) {
        const classId = `${file}::${className}`;
        if (!nodesMap.has(classId)) continue;

        for (const method of methods) {
          const m = method as Record<string, unknown>;
          const key = m['key'] as Record<string, unknown> | undefined;
          const methodName = (key?.['name'] as string | undefined) || 'unknown';
          const srcId = `${classId}::${normalize(methodName)}`;
          if (!nodesMap.has(srcId)) continue;

          const idCalls = collectIdentifierCallCounts(m['body']);
          for (const [callee, count] of idCalls) {
            const targetFiles = functionNameToFiles.get(callee);
            if (!targetFiles) continue;
            for (const targetFile of targetFiles) {
              const targetId = `${targetFile}::${callee}`;
              if (!nodesMap.has(targetId) || srcId === targetId) continue;
              primitives.push({
                source: srcId,
                target: targetId,
                type: LinkTypeValues.CALL,
                count,
              });
            }
          }
        }
      }
    }
  }

  /**
   * Level 0 #4 — FUNCTION FILE → CLASS FUNCTION via CallExpression/NewExpression
   * scan of standalone function bodies. NewExpression → INSTANTIATE to the class
   * constructor; member calls on locally instantiated objects (or static class
   * calls) → CALL to the class method.
   */
  private buildFunctionToClassPrimitives(
    funcs: Record<string, Record<string, unknown>>,
    nodesMap: Map<string, GraphNode>,
    classToFilesMap: Map<string, string[]>,
    findClassFile: (className: string) => string | undefined,
    normalize: (name: string) => string,
    primitives: PrimitiveEdge[],
  ): void {
    for (const [file, fnMap] of Object.entries(funcs)) {
      for (const [funcName, details] of Object.entries(fnMap)) {
        const srcId = `${file}::${funcName}`;
        if (!nodesMap.has(srcId)) continue;
        const body = (details as Record<string, unknown>)['body'];

        const localInstances = resolveLocalInstances(body);

        // NewExpression → INSTANTIATE
        const newExprCounts = extractNewExpressionCalleeCounts(body);
        for (const [calleeName, count] of newExprCounts) {
          const targetFiles = classToFilesMap.get(calleeName);
          if (!targetFiles) continue;
          for (const targetFile of targetFiles) {
            const targetClassId = `${targetFile}::${calleeName}`;
            if (srcId === targetClassId) continue;
            if (!nodesMap.has(targetClassId)) continue;
            const ctorId = `${targetClassId}::_constructor`;
            const target = nodesMap.has(ctorId) ? ctorId : targetClassId;
            primitives.push({
              source: srcId,
              target,
              type: LinkTypeValues.INSTANTIATE,
              count,
            });
          }
        }

        // Member calls → CALL to class method (instance or static)
        const memberCalls = collectMemberCallCounts(body);
        for (const [objName, methods] of memberCalls) {
          const targetClassName =
            localInstances.get(objName) ?? (classToFilesMap.has(objName) ? objName : undefined);
          if (!targetClassName) continue;
          const targetFiles = classToFilesMap.get(targetClassName);
          if (!targetFiles) continue;
          for (const targetFile of targetFiles) {
            const targetClassId = `${targetFile}::${targetClassName}`;
            if (!nodesMap.has(targetClassId)) continue;
            for (const [methodName, count] of methods) {
              const targetId = `${targetClassId}::${normalize(methodName)}`;
              if (!nodesMap.has(targetId) || srcId === targetId) continue;
              primitives.push({
                source: srcId,
                target: targetId,
                type: LinkTypeValues.CALL,
                count,
              });
            }
          }
        }

        // Identifier calls → standalone functions are covered by function-coupling (#1).
      }
    }
  }
}
