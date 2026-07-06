/**
 * Metrics-related Type Definitions
 * Defines all types for metrics data from the backend
 */

/**
 * Generic metric data structure (can be nested)
 */
export type MetricData = Record<string, number | Record<string, unknown> | unknown[]>;

/**
 * File-level coupling metrics
 * Backend returns arrays of file paths per file-dependency relationship
 */
export type FileCouplingData = Record<
  string,
  {
    fanIn: string[];
    fanOut: string[];
  }
>;

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
  [key: string]: MetricData | undefined;
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
