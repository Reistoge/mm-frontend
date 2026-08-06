/**
 * Graph-related Type Definitions
 * Defines all types used in graph visualization and data structures
 */

import * as d3 from 'd3';

export const LinkTypeValues = {
  CALL: 'calls',
  INSTANTIATE: 'instantiates',
  IMPORTS: 'imports',
} as const;
export type LinkType = (typeof LinkTypeValues)[keyof typeof LinkTypeValues];

/**
 * Per-dependency-type counts for a link. Types with count 0 are omitted.
 * One link between a pair can carry several dependency types at once
 * (e.g. `{ imports: 2, calls: 2, instantiates: 3 }`).
 */
export type LinkCounts = Partial<Record<LinkType, number>>;

/** Sums all per-type counts into a single weight (for simulation/coloring). */
export function linkTotal(counts: LinkCounts): number {
  return (counts.calls ?? 0) + (counts.instantiates ?? 0) + (counts.imports ?? 0);
}

/** Formats per-type counts for an edge label, e.g. "2 calls · 3 instantiates". */
export function formatLinkCounts(counts: LinkCounts): string {
  const parts: string[] = [];
  if (counts.imports) parts.push(`${counts.imports} import${counts.imports > 1 ? 's' : ''}`);
  if (counts.calls) parts.push(`${counts.calls} call${counts.calls > 1 ? 's' : ''}`);
  if (counts.instantiates)
    parts.push(`${counts.instantiates} instantiate${counts.instantiates > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

export const NodeTypeValues = {
  DIRECTORY: 'DIRECTORY',
  FILE: 'FILE',
  CLASS: 'CLASS',
  FUNCTION: 'FUNCTION',
  METHOD: 'METHOD',
} as const;
export type NodeType = (typeof NodeTypeValues)[keyof typeof NodeTypeValues];

/**
 * Represents a node in the graph
 */
export interface GraphNode {
  /** Unique identifier (path, file::class, etc) */
  id: string;

  /** Display label for the node */
  label: string;

  /** Node type categorization */
  type: NodeType;

  /** Parent node ID for hierarchical relationships */
  parentId?: string;

  /** Child nodes (only populated when needed) */
  children?: GraphNode[];

  /** Lines of code (if applicable) */
  loc?: number;

  /** X position for rendering */
  x?: number;

  /** Y position for rendering */
  y?: number;

  /** Depth in hierarchy */
  depth?: number;

  /** Size/radius for visualization */
  size?: number;

  /** Color for visualization */
  color?: string;
}

/**
 * Represents a link/edge between nodes.
 * Aggregates per-dependency-type counts between a (source, target) pair.
 */
export interface GraphLink {
  /** Source node ID */
  source: string;

  /** Target node ID */
  target: string;

  /** Per-dependency-type counts (types with count 0 are omitted) */
  counts: LinkCounts;

  /** Aggregation level: 'file' (individual entities), 'module' (directory pairs) or 'module-entity' (module to a specific entity) */
  level?: 'file' | 'module' | 'module-entity';
}

/**
 * Edge metadata for popup display
 */
export interface EdgeMetadata {
  sourceName: string;
  targetName: string;
  counts: LinkCounts;
  level?: 'file' | 'module' | 'module-entity';
  bidirectional?: boolean;
  forwardCounts?: LinkCounts;
  reverseCounts?: LinkCounts;
}

/**
 * Complete hierarchical graph data structure
 */
export interface HierarchicalData {
  /** All nodes in the graph */
  nodes: GraphNode[];

  /** All links in the graph */
  links: GraphLink[];
}

/**
 * Render-specific node data (includes D3 simulation data)
 */
export interface RenderNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: NodeType;
  parentId?: string;
  r: number;
  color: string;
  data: GraphNode;
}

/**
 * Render-specific link data
 */
export interface RenderLink extends d3.SimulationLinkDatum<RenderNode> {
  source: RenderNode;
  target: RenderNode;
  /** Combined weight of all counts (for simulation and coloring) */
  value: number;
  /** Per-dependency-type counts */
  counts: LinkCounts;
  bidirectional?: boolean;
  /** Forward/reverse split when the rendered edge is bidirectional */
  forwardCounts?: LinkCounts;
  reverseCounts?: LinkCounts;
}

/**
 * Enclosure bubble for folder visualization
 */
export interface Enclosure {
  /** Folder/parent node ID */
  id: string;

  /** Center X coordinate */
  x: number;

  /** Center Y coordinate */
  y: number;

  /** Radius */
  r: number;

  /** Display label */
  label: string;

  /** Fill color */
  color: string;
}

/**
 * Physics simulation configuration
 */
export interface PhysicsConfig {
  chargeStrength: number;
  linkDistance: number;
  centerStrength: number;
  collidePadding: number;
  collideIterations: number;
  clusterStrength?: number;
  enclosurePushForce?: number;
  enclosureLeashForce?: number;
}

/**
 * Legend item for graph legend
 */
export interface LegendItem {
  colorClass: string;
  label: string;
}

/**
 * Tree view item for hierarchy panel
 */
export interface TreeItem {
  node: GraphNode;
  depth: number;
  hasChildren: boolean;
}

/**
 * Functional node ID alias
 */
export type FNodeId = string;
