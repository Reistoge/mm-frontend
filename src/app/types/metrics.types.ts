/**
 * Metrics-related Type Definitions
 * Defines all types for metrics data from the backend
 */

/**
 * Generic metric data structure (can be nested)
 */
export type MetricData = Record<string, number | Record<string, unknown> | unknown[]>;

/**
 * File-level coupling entry
 */
export interface FileCouplingEntry {
  fanIn: string[];
  fanOut: string[];
}

/**
 * File-level coupling metrics
 * Backend returns arrays of file paths per file-dependency relationship
 */
export type FileCouplingData = Record<string, FileCouplingEntry>;

/**
 * File-level coupling result (alias)
 */
export type FileCouplingResult = Record<string, FileCouplingEntry>;

/**
 * Class-level coupling metrics
 */
export type ClassCouplingData = Record<
  string,
  {
    methods?: Record<string, MethodCouplingMetrics>;
    fanIn?: number;
    fanOut?: number;
  }
>;

/**
 * Method/function-level coupling metrics
 */
export interface MethodCouplingMetrics {
  fanIn: number;
  fanOut: number;
  callers?: string[];
  callees?: string[];
}

/**
 * Function-level coupling metrics
 */
export type FunctionCouplingData = Record<string, MethodCouplingMetrics>;

/**
 * Files inventory data
 */
export type FilesMetric = Record<
  string,
  {
    extension: string;
    lines?: number;
    functions?: number;
    classes?: number;
  }
>;

/**
 * Classes per file inventory
 */
export type ClassesPerFileMetric = Record<string, string[]>;

/**
 * Functions per file inventory
 */
export type FunctionsPerFileMetric = Record<string, Record<string, unknown>>;

/**
 * Complete modularity metrics result
 */
export interface ModularityMetrics {
  'file-coupling'?: FileCouplingData;
  'class-coupling'?: ClassCouplingData;
  'function-coupling'?: FunctionCouplingData;
  files?: FilesMetric;
  'classes-per-file'?: ClassesPerFileMetric;
  'functions-per-file'?: FunctionsPerFileMetric;
  errors?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Backend API response wrapper for metrics
 */
export interface MetricsApiResponse<T = MetricData> {
  result: T;
  status?: 'success' | 'error';
  message?: string;
}

/**
 * Complete metrics payload from backend
 */
export interface MetricsPayload {
  files: MetricsApiResponse<FilesMetric>;
  'classes-per-file': MetricsApiResponse<ClassesPerFileMetric>;
  'functions-per-file': MetricsApiResponse<FunctionsPerFileMetric>;
  'file-coupling': MetricsApiResponse<FileCouplingData>;
  'class-coupling': MetricsApiResponse<ClassCouplingData>;
  'function-coupling': MetricsApiResponse<FunctionCouplingData>;
  [key: string]: MetricsApiResponse<unknown>;
}

/**
 * Dependency centrality metric (file-level).
 * Computes in-degree, out-degree, and degree centrality from the file dependency graph.
 */
export interface DependencyCentralityMetric {
  inDegree: number;
  outDegree: number;
  inDegreeCentrality: number;
  outDegreeCentrality: number;
  totalDegreeCentrality: number;
}

/**
 * Lines-per-file metric (file-level).
 */
export interface LinesPerFileMetric {
  total: number;
  nonEmpty: number;
  blank: number;
}

/**
 * Function length metric (function-level).
 */
export interface FunctionLengthMetric {
  lines: number;
}

/**
 * Function dependency summary metric (function-level).
 * Aggregates fan-in and fan-out dependency totals for a named function.
 */
export interface FunctionDependencySummary {
  type: string;
  fanInCalls: number;
  fanOutCalls: number;
  fanInFunctions: number;
  fanOutFunctions: number;
  dependencyScore: number;
}

/**
 * Parameter count metric (function-level).
 */
export interface ParameterCountMetric {
  params: number;
}

/**
 * Aggregated sums for container nodes (DIRECTORY/CLASS).
 * Only fields that had data are present.
 */
export interface NodeMetricSums {
  /** Sum of total lines across descendant files */
  totalLines?: number;
  /** Sum of non-empty lines across descendant files */
  nonEmptyLines?: number;
  /** Sum of blank lines across descendant files */
  blankLines?: number;
  /** Sum of in-degree across descendant files */
  inDegree?: number;
  /** Sum of out-degree across descendant files */
  outDegree?: number;
  /** Sum of function/method lengths */
  functionLines?: number;
  /** Sum of declared parameters */
  params?: number;
  /** Sum of fan-in calls */
  fanInCalls?: number;
  /** Sum of fan-out calls */
  fanOutCalls?: number;
  /** Sum of fan-in functions */
  fanInFunctions?: number;
  /** Sum of fan-out functions */
  fanOutFunctions?: number;
  /** Sum of dependency scores */
  dependencyScore?: number;
}

/**
 * Aggregated averages for container nodes (DIRECTORY/CLASS).
 * Only fields that had data are present.
 */
export interface NodeMetricAverages {
  /** Average total lines per file */
  avgLinesPerFile?: number;
  /** Average non-empty lines per file */
  avgNonEmptyLinesPerFile?: number;
  /** Average in-degree centrality */
  inDegreeCentrality?: number;
  /** Average out-degree centrality */
  outDegreeCentrality?: number;
  /** Average total-degree centrality */
  totalDegreeCentrality?: number;
  /** Average function/method length */
  avgFunctionLength?: number;
  /** Average params per function */
  avgParams?: number;
  /** Average fan-in calls per function */
  avgFanInCalls?: number;
  /** Average fan-out calls per function */
  avgFanOutCalls?: number;
  /** Average dependency score per function */
  avgDependencyScore?: number;
}

/**
 * Per-node metric metadata attached to GraphNode.
 * File-level and function-level metrics apply directly to FILE/FUNCTION nodes;
 * container nodes (DIRECTORY/CLASS) carry aggregates.
 */
export interface NodeMetricData {
  /** File-level dependency centrality (FILE nodes) */
  dependencyCentrality?: DependencyCentralityMetric;
  /** File-level lines-per-file (FILE nodes) */
  linesPerFile?: LinesPerFileMetric;
  /** Function-level length (FUNCTION/METHOD nodes) */
  functionLength?: FunctionLengthMetric;
  /** Function-level dependency summary (FUNCTION/METHOD nodes) */
  dependencySummary?: FunctionDependencySummary;
  /** Function-level parameter count (FUNCTION/METHOD nodes) */
  parameterCount?: ParameterCountMetric;
  /** Aggregated sums for container nodes */
  sums?: NodeMetricSums;
  /** Aggregated averages for container nodes */
  averages?: NodeMetricAverages;
  /** Number of direct children contributing to aggregates */
  childCount?: number;
}

/**
 * Chart data point for rendering
 */
export interface ChartDataPoint {
  name: string;
  value: number;
}

/**
 * Chart data structure for ECharts
 */
export interface ChartData {
  title?: string;
  categories: string[];
  values: number[];
  series: {
    name: string;
    data: ChartDataPoint[];
  }[];
}
