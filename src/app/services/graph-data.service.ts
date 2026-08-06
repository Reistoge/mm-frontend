import { Injectable, inject } from '@angular/core';
import { forkJoin, map, Observable, of, catchError } from 'rxjs';
import { MetricsService } from './metrics.service';
import { GraphHierarchyBuilderService } from './graph-hierarchy-builder.service';
import { GraphLinkAggregatorService } from './graph-link-aggregator.service';
import { NodeMetricBuilderService } from './node-metric-builder.service';
import { HierarchicalData } from '../types/graph.types';

// Re-export for backward compatibility
export type { GraphNode, GraphLink, HierarchicalData } from '../types/graph.types';

/**
 * Orchestrates graph data loading and building.
 * Loads 5 metric endpoints in parallel, then delegates to:
 * - GraphHierarchyBuilderService for node hierarchy
 * - GraphLinkAggregatorService for link creation/aggregation
 */
@Injectable({ providedIn: 'root' })
export class GraphDataService {
  private metrics = inject(MetricsService);
  private hierarchyBuilder = inject(GraphHierarchyBuilderService);
  private linkAggregator = inject(GraphLinkAggregatorService);
  private metricBuilder = inject(NodeMetricBuilderService);

  /**
   * Loads all metric data via forkJoin and builds the full graph hierarchy + links.
   * Metric failures are silently caught and default to empty results.
   */
  loadHierarchy(repoId: string): Observable<HierarchicalData> {
    const req = (name: string) =>
      this.metrics.getMetric(repoId, name).pipe(catchError(() => of({ result: {} })));

    return forkJoin({
      files: req('files'),
      classes: req('classes-per-file'),
      classCoupling: req('class-coupling'),
      funcs: req('functions-per-file'),
      funcCoupling: req('function-coupling'),
      fileCoupling: req('file-coupling'),
      dependencyCentrality: req('dependency-centrality'),
      functionLength: req('function-length'),
      functionDependencySummary: req('function-dependency-summary'),
      linesPerFile: req('lines-per-file'),
      parameterCount: req('parameter-count'),
    }).pipe(map((data) => this.buildGraph(data)));
  }

  /**
   * 4-step pipeline: build hierarchy -> class mapping -> function mapping ->
   * build links -> attach per-node metric metadata.
   */
  private buildGraph(data: Record<string, unknown>): HierarchicalData {
    const { nodesMap, classToFilesMap, functionToFileMap } =
      this.hierarchyBuilder.buildHierarchy(data);

    const links = this.linkAggregator.buildAllLinks(
      data,
      nodesMap,
      classToFilesMap,
      functionToFileMap,
      (
        data['fileCoupling'] as
          { result?: Record<string, { fanIn: string[]; fanOut: string[] }> } | undefined
      )?.result,
    );

    this.metricBuilder.attachMetadata(data, nodesMap);

    return { nodes: Array.from(nodesMap.values()), links };
  }
}
