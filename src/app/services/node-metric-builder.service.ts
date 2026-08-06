import { Injectable } from '@angular/core';
import { GraphNode, NodeTypeValues } from '../types/graph.types';
import {
  DependencyCentralityMetric,
  FunctionDependencySummary,
  FunctionLengthMetric,
  LinesPerFileMetric,
  NodeMetricAverages,
  NodeMetricSums,
  ParameterCountMetric,
} from '../types/metrics.types';

/** Extracts the `result` payload from a metric API response, defaulting to {}. */
function resultOf<T>(entry: unknown): T {
  const e = entry as { result?: T } | undefined;
  return (e?.result ?? {}) as T;
}

/**
 * Attaches per-node metric metadata to the graph hierarchy.
 *
 * - FILE nodes: `dependency-centrality` + `lines-per-file`
 * - FUNCTION/METHOD nodes: `function-length` + `function-dependency-summary` + `parameter-count`
 * - CLASS nodes: aggregates from their child methods
 * - DIRECTORY nodes: aggregates from their descendant files (sums + per-file averages)
 *
 * Runs once at graph build time; nodes are static afterward.
 */
@Injectable({ providedIn: 'root' })
export class NodeMetricBuilderService {
  attachMetadata(data: Record<string, unknown>, nodesMap: Map<string, GraphNode>): void {
    const centrality = resultOf<Record<string, DependencyCentralityMetric>>(
      data['dependencyCentrality'],
    );
    const linesPerFile = resultOf<Record<string, LinesPerFileMetric>>(data['linesPerFile']);
    const functionLength = resultOf<Record<string, Record<string, FunctionLengthMetric>>>(
      data['functionLength'],
    );
    const dependencySummary = resultOf<Record<string, Record<string, FunctionDependencySummary>>>(
      data['functionDependencySummary'],
    );
    const parameterCount = resultOf<Record<string, Record<string, ParameterCountMetric>>>(
      data['parameterCount'],
    );

    const lengthLookup = this.indexFunctions(functionLength);
    const summaryLookup = this.indexFunctions(dependencySummary);
    const paramLookup = this.indexFunctions(parameterCount);

    nodesMap.forEach((node) => {
      if (node.type === NodeTypeValues.FILE) {
        node.metadata = {
          ...node.metadata,
          dependencyCentrality: centrality[node.id],
          linesPerFile: linesPerFile[node.id],
        };
        return;
      }

      if (node.type === NodeTypeValues.FUNCTION) {
        const file = this.nearestFileId(node, nodesMap);
        if (!file) return;
        node.metadata = {
          ...node.metadata,
          functionLength: this.lookupFunctionMetric(lengthLookup, file, node),
          dependencySummary: this.lookupFunctionMetric(summaryLookup, file, node),
          parameterCount: this.lookupFunctionMetric(paramLookup, file, node),
        };
      }
    });

    nodesMap.forEach((node) => {
      if (node.type === NodeTypeValues.CLASS) this.aggregateClass(node);
      if (node.type === NodeTypeValues.DIRECTORY) this.aggregateDirectory(node);
    });
  }

  /** Indexes a `file -> { functionName -> value }` map by lowercased function names. */
  private indexFunctions<T>(map: Record<string, Record<string, T>>): Map<string, Map<string, T>> {
    const indexed = new Map<string, Map<string, T>>();
    for (const [file, fnMap] of Object.entries(map)) {
      const fileMap = new Map<string, T>();
      for (const [name, value] of Object.entries(fnMap)) {
        fileMap.set(name.toLowerCase(), value);
      }
      indexed.set(file, fileMap);
    }
    return indexed;
  }

  /** Nearest FILE ancestor of a node (the node itself when it is a file). */
  private nearestFileId(node: GraphNode, nodesMap: Map<string, GraphNode>): string | undefined {
    let cur: GraphNode | undefined = node;
    while (cur && cur.type !== NodeTypeValues.FILE) {
      if (!cur.parentId) return undefined;
      cur = nodesMap.get(cur.parentId);
    }
    return cur?.type === NodeTypeValues.FILE ? cur.id : undefined;
  }

  /**
   * Candidate function-name keys for a FUNCTION node within its file.
   * Covers bare names, `Class.method` and `file::Class::method` styles.
   */
  private candidateKeys(node: GraphNode, file: string): string[] {
    const suffix = node.id.startsWith(`${file}::`) ? node.id.slice(file.length + 2) : node.id;
    const keys = [suffix, node.label];
    const parts = suffix.split('::');
    if (parts.length === 2) {
      const [cls, method] = parts;
      keys.push(method, `${cls}.${method}`, `${cls}::${method}`);
    }
    return keys;
  }

  private lookupFunctionMetric<T>(
    indexed: Map<string, Map<string, T>>,
    file: string,
    node: GraphNode,
  ): T | undefined {
    const fileMap = indexed.get(file);
    if (!fileMap) return undefined;
    for (const key of this.candidateKeys(node, file)) {
      const hit = fileMap.get(key.toLowerCase());
      if (hit !== undefined) return hit;
    }
    return undefined;
  }

  /** Aggregates CLASS node sums/averages from its child FUNCTION nodes. */
  private aggregateClass(node: GraphNode): void {
    const methods = node.children?.filter((c) => c.type === NodeTypeValues.FUNCTION) ?? [];

    let lineCount = 0;
    let paramCount = 0;
    let summaryCount = 0;
    const sums: NodeMetricSums = {};

    for (const method of methods) {
      const m = method.metadata;
      if (m?.functionLength) {
        sums.functionLines = (sums.functionLines ?? 0) + m.functionLength.lines;
        lineCount++;
      }
      if (m?.parameterCount) {
        sums.params = (sums.params ?? 0) + m.parameterCount.params;
        paramCount++;
      }
      if (m?.dependencySummary) {
        const s = m.dependencySummary;
        sums.fanInCalls = (sums.fanInCalls ?? 0) + s.fanInCalls;
        sums.fanOutCalls = (sums.fanOutCalls ?? 0) + s.fanOutCalls;
        sums.fanInFunctions = (sums.fanInFunctions ?? 0) + s.fanInFunctions;
        sums.fanOutFunctions = (sums.fanOutFunctions ?? 0) + s.fanOutFunctions;
        sums.dependencyScore = (sums.dependencyScore ?? 0) + s.dependencyScore;
        summaryCount++;
      }
    }

    if (lineCount === 0 && paramCount === 0 && summaryCount === 0) return;

    const averages: NodeMetricAverages = {};
    if (lineCount > 0) averages.avgFunctionLength = round(sums.functionLines! / lineCount);
    if (paramCount > 0) averages.avgParams = round(sums.params! / paramCount);
    if (summaryCount > 0) {
      averages.avgFanInCalls = round(sums.fanInCalls! / summaryCount);
      averages.avgFanOutCalls = round(sums.fanOutCalls! / summaryCount);
      averages.avgDependencyScore = round(sums.dependencyScore! / summaryCount);
    }

    node.metadata = {
      ...node.metadata,
      sums,
      averages,
      childCount: methods.length,
    };
  }

  /** Aggregates DIRECTORY node sums/averages from its descendant FILE nodes. */
  private aggregateDirectory(node: GraphNode): void {
    const files: GraphNode[] = [];
    const stack = [...(node.children ?? [])];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (cur.type === NodeTypeValues.FILE) {
        files.push(cur);
      } else {
        stack.push(...(cur.children ?? []));
      }
    }

    if (files.length === 0) return;

    let centralityCount = 0;
    const sums: NodeMetricSums = {};
    const averages: NodeMetricAverages = {};
    const centralitySum = { in: 0, out: 0, total: 0 };

    for (const file of files) {
      const m = file.metadata;
      if (m?.linesPerFile) {
        sums.totalLines = (sums.totalLines ?? 0) + m.linesPerFile.total;
        sums.nonEmptyLines = (sums.nonEmptyLines ?? 0) + m.linesPerFile.nonEmpty;
        sums.blankLines = (sums.blankLines ?? 0) + m.linesPerFile.blank;
      }
      if (m?.dependencyCentrality) {
        const c = m.dependencyCentrality;
        sums.inDegree = (sums.inDegree ?? 0) + c.inDegree;
        sums.outDegree = (sums.outDegree ?? 0) + c.outDegree;
        centralitySum.in += c.inDegreeCentrality;
        centralitySum.out += c.outDegreeCentrality;
        centralitySum.total += c.totalDegreeCentrality;
        centralityCount++;
      }
    }

    if (sums.totalLines !== undefined) {
      averages.avgLinesPerFile = round(sums.totalLines / files.length);
    }
    if (sums.nonEmptyLines !== undefined) {
      averages.avgNonEmptyLinesPerFile = round(sums.nonEmptyLines / files.length);
    }
    if (centralityCount > 0) {
      averages.inDegreeCentrality = round(centralitySum.in / centralityCount);
      averages.outDegreeCentrality = round(centralitySum.out / centralityCount);
      averages.totalDegreeCentrality = round(centralitySum.total / centralityCount);
    }

    node.metadata = {
      ...node.metadata,
      sums,
      averages,
      childCount: files.length,
    };
  }
}

/** Rounds to 2 decimals for display-friendly averages. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
