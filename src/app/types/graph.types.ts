/**
 * Graph-related Type Definitions
 * Defines all types used in graph visualization and data structures
 */

import * as d3 from 'd3';

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
 * Represents a link/edge between nodes
 */
export interface GraphLink {
  /** Source node ID */
  source: string;

  /** Target node ID */
  target: string;

  /** Link strength/weight for simulation */
  value: number;

  /** Link categorization */
  type: LinkType;

  /** Direction if applicable */
  direction?: LinkDirection;

  /** Actual fan-in count from metrics */
  fanIn?: number;

  /** Actual fan-out count from metrics */
  fanOut?: number;

  /** Aggregation level: 'file' (default, individual imports) or 'module' (deduplicated by directory) */
  level?: 'file' | 'module';
}

/**
 * Edge metadata for popup display
 */
export interface EdgeMetadata {
  sourceName: string;
  targetName: string;
  linkType: LinkType;
  value: number;
  level?: 'file' | 'module';
  bidirectional?: boolean;
  forwardValue?: number;
  reverseValue?: number;
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
  value: number;
  type: string;
  bidirectional?: boolean;
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
