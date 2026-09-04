/**
 * Base Graph Component
 * Abstract base class for all D3-based graph visualizations.
 * Manages D3 force simulation lifecycle, node/link/enclosure rendering, zoom, and interaction.
 * Subclasses override physics config, colors, radii, and node filtering via abstract methods.
 */

import {
  Component,
  ElementRef,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import * as d3 from 'd3';
import { D3_CONFIG, D3ColorUtils } from '../config/d3-config';
import { GraphDataService } from '../services/graph-data.service';
import {
  NodeTypeValues,
  NodeType,
  GraphNode,
  GraphLink,
  EdgeMetadata,
  LinkCounts,
  RenderNode,
  RenderLink,
  Enclosure,
  PhysicsConfig,
  linkTotal,
  formatLinkCounts,
} from '../types/graph.types';
import type { NodeMetricData } from '../types/metrics.types';
import { downloadSvg, downloadPng } from './common/component.utils';

/**
 * Abstract base class for D3 force-directed graph visualizations.
 *
 * Forces: charge (repulsion), link (spring), center (gravity), collide (collision),
 *         cluster (group by parent), enclosure (keep children inside parent bubbles).
 *
 * Subclasses MUST implement:
 * - getPhysicsConfig()      -> PhysicsConfig
 * - getColorScheme()        -> Record<string, string>
 * - getRadiusScheme()       -> Record<string, number>
 * - filterNodesAndLinks()   -> void
 */
@Component({
  template: '', // Subclasses must define template
})
export abstract class BaseGraphComponent implements OnInit, OnDestroy, OnChanges {
  protected dataService = inject(GraphDataService);

  @Input({ required: true }) repoId!: string;
  @Input() reloadTrigger = 0;
  @Output() openDetailsModal = new EventEmitter<void>();
  @Output() runScan = new EventEmitter<void>();
  @ViewChild('graphContainer', { static: true }) container!: ElementRef;

  // State signals
  loading = signal(true);
  error = signal<string | null>(null);
  separation = signal(1);
  readonly edgePopup = signal<{
    metadata: EdgeMetadata;
    position: { x: number; y: number };
  } | null>(null);
  private popupLink: RenderLink | null = null;
  expandFlag = signal(false);

  /** Pinned node inspection popup, opened by clicking the lens icon. */
  readonly nodePopup = signal<{
    node: GraphNode;
    position: { x: number; y: number };
  } | null>(null);
  private popupNode: GraphNode | null = null;
  private popupRenderNode: RenderNode | null = null;
  private hoveredNodeId: string | null = null;
  private lensHideTimer: ReturnType<typeof setTimeout> | null = null;

  // Internal state
  protected allNodesMap = new Map<string, GraphNode>();
  allLinks: GraphLink[] = [];

  /** Public accessor for tree modal and other consumers */
  get allNodes(): GraphNode[] {
    return Array.from(this.allNodesMap.values());
  }

  protected nodes: RenderNode[] = [];
  protected links: RenderLink[] = [];
  protected expandedNodes = new Set<string>();
  protected hiddenNodes = signal(new Set<string>());
  protected currentEnclosures: Enclosure[] = [];

  /** When true, enclosure bubbles display the full recursive parent chain path stacked vertically. */
  protected showNodeParentText = false;

  /**
   * Builds a recursive parent chain array for a node ID by walking parentId links.
   * Returns e.g. ["Module", "Folder"] from root to the node's immediate parent.
   */
  protected getNodeParentText(nodeId: string): string[] {
    const chain: string[] = [];
    let curr = this.allNodesMap.get(nodeId);
    while (curr && curr.parentId) {
      const parentData = this.allNodesMap.get(curr.parentId);
      if (parentData) {
        chain.unshift(parentData.label);
      }
      curr = this.allNodesMap.get(curr.parentId);
    }
    return chain;
  }

  // D3 objects
  protected simulation: d3.Simulation<RenderNode, RenderLink> | null = null;

  /** Tracks which original GraphLinks contributed to each rendered aggregated link */
  protected linkToOriginals = new Map<string, GraphLink[]>();
  protected svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  protected width = D3_CONFIG.VIEWPORT.DEFAULT_WIDTH;
  protected height = D3_CONFIG.VIEWPORT.DEFAULT_HEIGHT;

  abstract getPhysicsConfig(): PhysicsConfig;
  abstract getColorScheme(): Record<string, string>;
  abstract getRadiusScheme(): Record<string, number>;

  /**
   * Post-load hook to filter/transform nodes and links before simulation starts.
   * Called once after data is fetched and parsed.
   */
  abstract filterNodesAndLinks(): void;

  ngOnInit() {
    this.loadGraph();
  }

  ngOnDestroy() {
    if (this.lensHideTimer) clearTimeout(this.lensHideTimer);
    if (this.simulation) this.simulation.stop();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['reloadTrigger'] && !changes['reloadTrigger'].firstChange) {
      if (this.simulation) this.simulation.stop();
      this.allNodesMap.clear();
      this.loadGraph();
    }
  }

  /**
   * Fetches hierarchy data, builds nodes/links, then initializes the D3 simulation.
   */
  private loadGraph() {
    this.loading.set(true);
    this.dataService.loadHierarchy(this.repoId).subscribe({
      next: (data) => {
        data.nodes.forEach((n) => this.allNodesMap.set(n.id, n));
        this.allLinks = data.links;

        // Filter/transform nodes and links (subclass-specific)
        this.filterNodesAndLinks();

        // Initialize rendering
        this.initSimulation();
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Error loading graph data');
        this.loading.set(false);
      },
    });
  }

  /**
   * Converts a GraphNode into a RenderNode with computed radius, color, and position.
   */
  protected createRenderNode(n: GraphNode, x = 0, y = 0): RenderNode {
    const radiusScheme = this.getRadiusScheme();
    const colorScheme = this.getColorScheme();

    return {
      id: n.id,
      label: n.label,
      type: n.type,
      parentId: n.parentId,
      data: n,
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      r: radiusScheme[n.type] || 10,
      color: colorScheme[n.type] || '#999',
    };
  }

  /**
   * Sets up SVG with zoom layer, creates D3 force simulation with all forces,
   * and attaches tick handler to re-render nodes/links/enclosures on each frame.
   */
  private initSimulation() {
    const el = this.container.nativeElement;
    this.width = el.clientWidth || D3_CONFIG.VIEWPORT.DEFAULT_WIDTH;
    this.height = el.clientHeight || D3_CONFIG.VIEWPORT.DEFAULT_HEIGHT;

    // Clear previous SVG
    d3.select(el).selectAll('*').remove();

    // Create SVG with viewBox for scaling
    this.svg = d3
      .select(el)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('viewBox', `${-this.width / 2} ${-this.height / 2} ${this.width} ${this.height}`);

    // Create defs for arrow markers
    this.svg.append('defs');

    // Create zoom layer
    const zoomLayer = this.svg.append('g').attr('class', 'zoom-layer');

    // Add zoom behavior
    this.svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([D3_CONFIG.ZOOM.MIN, D3_CONFIG.ZOOM.MAX])
        .on('zoom', (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          zoomLayer.attr('transform', String(e.transform));
          this.updatePopupPosition();
        }),
    );

    // Close popups when clicking on the graph background (svg canvas or zoom layer).
    // Node/link/enclosure clicks bubble here too but target their own elements.
    this.svg.on('click', (e: MouseEvent) => {
      if (e.target === this.svg.node() || e.target === zoomLayer.node()) {
        this.edgePopup.set(null);
        this.popupLink = null;
        this.closeNodePopup();
      }
    });

    // Create rendering layers
    const gEnclosures = zoomLayer.append('g').attr('class', 'enclosures');
    const gLinks = zoomLayer.append('g').attr('class', 'links');
    const gNodes = zoomLayer.append('g').attr('class', 'nodes');

    // Create force simulation
    const config = this.getPhysicsConfig();

    this.simulation = d3
      .forceSimulation(this.nodes)
      .force('charge', d3.forceManyBody().strength(config.chargeStrength))
      .force(
        'link',
        d3
          .forceLink(this.links)
          .id((d) => (d as RenderNode).id)
          .distance(config.linkDistance),
      )
      .force('x', d3.forceX().strength(config.centerStrength))
      .force('y', d3.forceY().strength(config.centerStrength))
      .force(
        'collide',
        d3
          .forceCollide()
          .radius((d) => (d as RenderNode).r + config.collidePadding)
          .iterations(config.collideIterations),
      )
      .force('cluster', this.forceCluster(config.clusterStrength || 0.2))
      .force('enclosure', this.forceEnclosure());

    // Render on every tick
    this.simulation.on('tick', () => {
      this.rebuildLinks();
      this.updateArrowMarkers();
      this.updateLinksForView(gLinks);
      this.updateNodes(gNodes);
      this.drawEnclosures(gEnclosures, this.currentEnclosures);
      this.updatePopupPosition();
    });
  }

  /**
   * Renders/updates link lines with color based on coupling intensity and value labels.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private updateLinksForView(layer: any) {
    const linkGroups = layer
      .selectAll('g.link')
      .data(this.links, (d: RenderLink) => `${d.source.id}-${d.target.id}`);

    const linkEnter = linkGroups.enter().append('g').attr('class', 'link');

    linkEnter.append('line');
    linkEnter
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-4')
      .style('font-size', '9px')
      .style('font-weight', 'bold')
      .style('fill', '#ef4444')
      .style('cursor', 'pointer')
      .style('paint-order', 'stroke')
      .style('stroke', '#ffffff')
      .style('stroke-width', '2px')
      .on('click', (event: MouseEvent, d: RenderLink) => {
        this.handleEdgeClick(event, d);
      })
      .on('mouseover', (e: MouseEvent) => {
        d3.select(e.currentTarget as SVGElement).style('text-decoration', 'underline');
      })
      .on('mouseout', (e: MouseEvent) => {
        d3.select(e.currentTarget as SVGElement).style('text-decoration', 'none');
      });
    const merged = linkGroups.merge(linkEnter);

    merged
      .select('line')
      .attr('stroke', (d: RenderLink) => this.getLinkColor(d.value))
      .attr('stroke-opacity', D3_CONFIG.LINK.OPACITY)
      .attr('marker-end', (d: RenderLink) =>
        d.bidirectional ? null : `url(#arrowhead-${this.getLinkColor(d.value).replace('#', '')})`,
      )
      .attr('x1', (d: RenderLink) => d.source.x)
      .attr('y1', (d: RenderLink) => d.source.y)
      .attr('x2', (d: RenderLink) => this.shortenLine(d.source, d.target).x)
      .attr('y2', (d: RenderLink) => this.shortenLine(d.source, d.target).y);

    merged
      .select('text')
      .text((d: RenderLink) => formatLinkCounts(d.counts))
      .attr('x', (d: RenderLink) => (d.source.x! + d.target.x!) / 2)
      .attr('y', (d: RenderLink) => (d.source.y! + d.target.y!) / 2);

    linkGroups.exit().remove();
  }

  /**
   * Renders/updates node circles with labels, a hover-revealed lens icon, drag behavior,
   * and click handlers.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private updateNodes(layer: any) {
    const nodeSel = layer.selectAll('g.node').data(this.nodes, (d: RenderNode) => d.id);

    const nodeEnter = nodeSel
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag()
          .on('start', (e, d) => {
            const node = d as RenderNode;
            if (!e.active) this.simulation!.alphaTarget(0.3).restart();
            node.fx = node.x;
            node.fy = node.y;
          })
          .on('drag', (e, d) => {
            const node = d as RenderNode;
            node.fx = e.x;
            node.fy = e.y;
          })
          .on('end', (e, d) => {
            const node = d as RenderNode;
            if (!e.active) this.simulation!.alphaTarget(0);
            node.fx = null;
            node.fy = null;
          }),
      )
      .on('click', (e: MouseEvent, d: RenderNode) => this.handleNodeClick(e, d));
    // .on('mouseenter', (e: MouseEvent, d: RenderNode) => {
    //   this.hoveredNodeId = d.id;
    //   this.cancelLensHide();
    //   if (this.hasMetadata(d.data.metadata)) {
    //     d3.select(e.currentTarget as SVGGElement)
    //       .select('g.lens')
    //       .style('display', null);
    //   }
    // })
    // .on('mouseleave', () => this.scheduleLensHide());

    nodeEnter
      .append('circle')
      .attr('r', (d: RenderNode) => d.r)
      .attr('fill', (d: RenderNode) => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', D3_CONFIG.NODE.STROKE_WIDTH);

    nodeEnter
      .append('text')
      .text((d: RenderNode) => d.label)
      .attr('dy', (d: RenderNode) => d.r + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', '#475569')
      .style('font-size', '10px')
      .style('pointer-events', 'all')
      .on('click', (event: MouseEvent, d: RenderNode) => {
        event.stopPropagation();
        this.toggleNodePopup(d);
      })
      .on('mouseover', (e: MouseEvent) => {
        d3.select(e.currentTarget as SVGElement).style('text-decoration', 'underline');
      })
      .on('mouseout', (e: MouseEvent) => {
        d3.select(e.currentTarget as SVGElement).style('text-decoration', 'none');
      });
    // Lens icon shown on hover; click pins the node inspection popup.
    // const lensEnter = nodeEnter
    //   .append('g')
    //   .attr('class', 'lens')
    //   .style('display', 'none')
    //   .style('pointer-events', 'all');

    // lensEnter
    //   .append('circle')
    //   .attr('r', 8)
    //   .attr('fill', '#f8fafc')
    //   .attr('stroke', '#94a3b8')
    //   .attr('stroke-width', 1)
    //   .style('cursor', 'pointer');

    // lensEnter
    //   .append('text')
    //   .text('i')
    //   .attr('text-anchor', 'middle')
    //   .attr('dy', '0.35em')
    //   .attr('font-size', '10px')
    //   .attr('font-weight', 'bold')
    //   .attr('fill', '#475569')
    //   .style('pointer-events', 'none');

    // // Position the lens once next to the label's right edge (static per node).
    // lensEnter.each(function (this: SVGGElement, d: RenderNode) {
    //   const parent = this.parentNode as SVGGElement;
    //   const textEl = parent.querySelector('text') as SVGTextElement | null;
    //   const tw = textEl ? textEl.getComputedTextLength() : 0;
    //   d3.select(this).attr('transform', `translate(${tw / 2 + 8}, ${d.r + 9})`);
    // });

    // lensEnter
    //   .on('mouseenter', () => this.cancelLensHide())
    //   .on('mouseleave', () => this.scheduleLensHide());

    const merged = nodeSel
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .merge(nodeEnter as any)
      .attr('transform', (d: RenderNode) => `translate(${d.x},${d.y})`);

    merged
      .select('g.lens')
      .style('display', (d: RenderNode) =>
        d.id === this.hoveredNodeId && this.hasMetadata(d.data.metadata) ? null : 'none',
      );

    nodeSel.exit().remove();
  }

  /**
   * Custom force: pulls sibling nodes (same parentId) toward their centroid.
   */
  private forceCluster(strength: number) {
    return (alpha: number) => {
      const groups = d3.group(this.nodes, (d) => d.parentId);
      groups.forEach((groupNodes) => {
        if (groupNodes.length <= 1) return;

        let cx = 0,
          cy = 0;
        groupNodes.forEach((n) => {
          cx += n.x!;
          cy += n.y!;
        });
        cx /= groupNodes.length;
        cy /= groupNodes.length;

        const k = strength * alpha;
        groupNodes.forEach((n) => {
          n.vx! -= (n.x! - cx) * k;
          n.vy! -= (n.y! - cy) * k;
        });
      });
    };
  }

  /**
   * Custom force: leash force pulls descendant nodes inside their enclosure bubble;
   * push force pushes non-descendants outside.
   */
  private forceEnclosure() {
    return (alpha: number) => {
      const config = this.getPhysicsConfig();
      this.currentEnclosures = this.calculateEnclosures();

      this.currentEnclosures.forEach((enc) => {
        this.nodes.forEach((node) => {
          const isInside = this.isDescendant(node.id, enc.id);

          const dx = node.x! - enc.x;
          const dy = node.y! - enc.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

          if (isInside) {
            // LEASH FORCE: Keep children inside
            const maxDist = enc.r - node.r - 5;
            if (dist > maxDist) {
              const k = (config.enclosureLeashForce || D3_CONFIG.ENCLOSURE.LEASH_FORCE) * alpha;
              const move = dist - maxDist;
              node.vx! -= (dx / dist) * move * k;
              node.vy! -= (dy / dist) * move * k;
            }
          } else {
            // PUSH FORCE: Keep outsiders out
            const minDist = enc.r + node.r + 10;
            if (dist < minDist) {
              const overlap = minDist - dist;
              const k = (config.enclosurePushForce || D3_CONFIG.ENCLOSURE.PUSH_FORCE) * alpha * 5;
              node.vx! += (dx / dist) * overlap * k;
              node.vy! += (dy / dist) * overlap * k;
            }
          }
        });
      });
    };
  }

  /**
   * Uses d3.packEnclose to compute minimum bounding circles around direct children of expanded nodes.
   */
  protected calculateEnclosures(): Enclosure[] {
    const enclosures: Enclosure[] = [];
    const colorScheme = this.getColorScheme();

    this.expandedNodes.forEach((parentId) => {
      const directChildren = this.nodes.filter((n) => n.parentId === parentId);

      if (directChildren.length > 0) {
        const pData = this.allNodesMap.get(parentId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const circle = d3.packEnclose(directChildren as any);
        if (circle) {
          enclosures.push({
            id: parentId,
            x: circle.x,
            y: circle.y,
            r: circle.r + D3_CONFIG.ENCLOSURE.PADDING,
            label: pData?.label || '',
            color: colorScheme[pData?.type as NodeType] || '#ccc',
          });
        }
      }
    });
    return enclosures;
  }

  /**
   * Walks the parent chain from nodeId upward; returns true if ancestorId is found.
   */
  protected isDescendant(nodeId: string, ancestorId: string): boolean {
    let curr = this.allNodesMap.get(nodeId);
    while (curr && curr.parentId) {
      if (curr.parentId === ancestorId) return true;
      curr = this.allNodesMap.get(curr.parentId);
    }
    return false;
  }

  /**
   * Filters allLinks to only those between visible nodes.
   * If a link endpoint is hidden, walks up to find the nearest visible ancestor.
   * Aggregates parallel links by merging their per-type counts.
   */
  protected rebuildLinks() {
    const visibleNodeIds = new Set(this.nodes.map((n) => n.id));
    const visibleNodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    const newLinks = new Map<string, RenderLink>();
    const minHops = new Map<string, number>();

    this.linkToOriginals = new Map();

    // Determine view level: when only DIRECTORY nodes are visible,
    // show deduplicated module-level links. Once any non-directory
    // (FILE/CLASS/FUNCTION) appears, show file-level links.
    const isModuleView = this.nodes.every((n) => n.type === NodeTypeValues.DIRECTORY);

    // Filter links by aggregation level
    const activeLinks = isModuleView
      ? this.allLinks.filter((l) => l.level === 'module')
      : this.allLinks.filter((l) => !l.level || l.level === 'file');

    const findVisible = (id: string): string | undefined => {
      if (visibleNodeIds.has(id)) return id;
      let curr = this.allNodesMap.get(id);
      while (curr && curr.parentId) {
        if (visibleNodeIds.has(curr.parentId)) return curr.parentId;
        curr = this.allNodesMap.get(curr.parentId);
      }
      return undefined;
    };

    // Hops from an original endpoint up to its resolved visible node.
    // More specific (deeper) edges have fewer hops; aggregated file/class edges
    // are dropped whenever a deeper edge already covers the same rendered pair.
    const ancestorHops = (id: string, resolvedId: string): number => {
      if (id === resolvedId) return 0;
      let hops = 0;
      let curr = this.allNodesMap.get(id);
      while (curr && curr.parentId && curr.id !== resolvedId) {
        hops++;
        curr = this.allNodesMap.get(curr.parentId);
      }
      return hops;
    };

    const mergeCounts = (a: LinkCounts, b: LinkCounts): LinkCounts => {
      const calls = (a.calls ?? 0) + (b.calls ?? 0);
      const instantiates = (a.instantiates ?? 0) + (b.instantiates ?? 0);
      const imports = (a.imports ?? 0) + (b.imports ?? 0);
      const out: LinkCounts = {};
      if (calls > 0) out.calls = calls;
      if (instantiates > 0) out.instantiates = instantiates;
      if (imports > 0) out.imports = imports;
      return out;
    };

    activeLinks.forEach((l) => {
      const sourceId = findVisible(l.source as string);
      const targetId = findVisible(l.target as string);
      if (!sourceId || !targetId || sourceId === targetId) return;

      const key = `${sourceId}-${targetId}`;
      const hops =
        ancestorHops(l.source as string, sourceId) + ancestorHops(l.target as string, targetId);
      const currentMin = minHops.get(key);

      // A coarser edge is already covered by a more specific one — skip it.
      if (currentMin !== undefined && hops > currentMin) return;

      const candidate: RenderLink = {
        source: visibleNodeMap.get(sourceId)!,
        target: visibleNodeMap.get(targetId)!,
        value: linkTotal(l.counts),
        counts: { ...l.counts },
      };

      if (currentMin === undefined || hops < currentMin) {
        minHops.set(key, hops);
        newLinks.set(key, candidate);
        this.linkToOriginals.set(key, [l]);
      } else {
        const existing = newLinks.get(key)!;
        existing.value += linkTotal(l.counts);
        existing.counts = mergeCounts(existing.counts, l.counts);
        this.linkToOriginals.get(key)!.push(l);
      }
    });

    // Merge bidirectional pairs (A→B + B→A) into single rendered edges
    const processedKeys = new Set<string>();
    const mergedLinks: RenderLink[] = [];

    for (const link of newLinks.values()) {
      const key = `${(link.source as RenderNode).id}-${(link.target as RenderNode).id}`;
      if (processedKeys.has(key)) continue;
      processedKeys.add(key);

      const srcId = (link.source as RenderNode).id;
      const tgtId = (link.target as RenderNode).id;
      const reverseKey = `${tgtId}-${srcId}`;

      if (newLinks.has(reverseKey) && key !== reverseKey) {
        processedKeys.add(reverseKey);
        const reverseLink = newLinks.get(reverseKey)!;

        if (srcId < tgtId) {
          link.value += reverseLink.value;
          link.bidirectional = true;
          link.forwardCounts = { ...link.counts };
          link.reverseCounts = { ...reverseLink.counts };
          link.counts = mergeCounts(link.counts, reverseLink.counts);

          const reverseOriginals = this.linkToOriginals.get(reverseKey);
          if (reverseOriginals) {
            const originals = this.linkToOriginals.get(key)!;
            originals.push(...reverseOriginals);
          }

          mergedLinks.push(link);
        } else {
          reverseLink.value += link.value;
          reverseLink.bidirectional = true;
          reverseLink.forwardCounts = { ...reverseLink.counts };
          reverseLink.reverseCounts = { ...link.counts };
          reverseLink.counts = mergeCounts(reverseLink.counts, link.counts);

          const currentOriginals = this.linkToOriginals.get(key);
          if (currentOriginals) {
            const originals = this.linkToOriginals.get(reverseKey)!;
            originals.push(...currentOriginals);
          }

          mergedLinks.push(reverseLink);
        }
      } else {
        mergedLinks.push(link);
      }
    }

    this.links = mergedLinks;
  }

  /**
   * Toggles node visibility from the tree modal. Hides/shows the node and its descendants,
   * then restarts the simulation to re-layout.
   */
  onNodeSelected(nodeId: string): void {
    const hidden = new Set(this.hiddenNodes());
    if (hidden.has(nodeId)) {
      hidden.delete(nodeId);
      const nodeData = this.allNodesMap.get(nodeId);
      if (nodeData && !this.nodes.some((n) => n.id === nodeId)) {
        // Only show root nodes or nodes whose parent is expanded
        if (!nodeData.parentId || this.expandedNodes.has(nodeData.parentId)) {
          this.nodes.push(this.createRenderNode(nodeData));
        }
      }
    } else {
      hidden.add(nodeId);
      // Remove node and its descendants from current visible nodes
      this.nodes = this.nodes.filter((n) => n.id !== nodeId && !this.isDescendant(n.id, nodeId));
      // Also remove from expanded nodes if it was expanded
      this.expandedNodes.delete(nodeId);
    }
    this.hiddenNodes.set(hidden);

    this.updateSimulationState();
  }

  /**
   * Expands a node by replacing it with its children at the same position.
   */
  protected handleNodeClick(event: MouseEvent, node: RenderNode) {
    this.edgePopup.set(null);
    this.popupLink = null;
    this.closeNodePopup();

    const original = this.allNodesMap.get(node.id);
    if (!original || !original.children || original.children.length === 0) return;

    this.expandedNodes.add(node.id);
    this.nodes = this.nodes.filter((n) => n.id !== node.id);

    const children = original.children
      .filter((c) => !this.hiddenNodes().has(c.id))
      .map((c) => this.createRenderNode(c, node.x, node.y));
    this.nodes.push(...children);

    this.updateSimulationState();
  }

  /**
   * Collapses expanded children back into the parent node at the enclosure center.
   */
  protected collapse(parentId: string) {
    this.expandedNodes.delete(parentId);
    this.nodes = this.nodes.filter((n) => !this.isDescendant(n.id, parentId));

    const parentData = this.allNodesMap.get(parentId)!;
    const enc = this.currentEnclosures.find((e) => e.id === parentId);
    const x = enc ? enc.x : 0;
    const y = enc ? enc.y : 0;

    this.nodes.push(this.createRenderNode(parentData, x, y));
    this.updateSimulationState();
  }

  /**
   * Rebuilds links and restarts the simulation with updated node/link data.
   */
  protected updateSimulationState() {
    this.edgePopup.set(null);
    this.popupLink = null;
    this.closeNodePopup();
    this.rebuildLinks();
    this.simulation!.nodes(this.nodes);
    (this.simulation!.force('link') as d3.ForceLink<RenderNode, RenderLink>).links(this.links);
    this.simulation!.alpha(0.8).restart();
  }

  /**
   * Recalculates popup positions from SVG coordinates using the zoom/pan transform.
   * Keeps both the edge popup (link midpoint) and the node popup (node position)
   * anchored while panning, zooming, and during simulation movement.
   */
  private updatePopupPosition(): void {
    const svgEl = this.svg.node() as SVGSVGElement | null;
    const zoomLayerEl = svgEl?.querySelector('.zoom-layer') as SVGGraphicsElement | null;
    if (!svgEl || !zoomLayerEl) return;

    const ctm = zoomLayerEl.getScreenCTM();
    if (!ctm) return;

    const toScreen = (x: number, y: number): { x: number; y: number } => {
      const pt = svgEl.createSVGPoint();
      pt.x = x;
      pt.y = y;
      const screenPt = pt.matrixTransform(ctm);
      return { x: screenPt.x, y: screenPt.y };
    };

    const current = this.edgePopup();
    if (current && this.popupLink) {
      const link = this.popupLink;
      const src = link.source as RenderNode;
      const tgt = link.target as RenderNode;
      const mid = toScreen((src.x! + tgt.x!) / 2, (src.y! + tgt.y!) / 2);
      this.edgePopup.set({
        metadata: current.metadata,
        position: { x: mid.x, y: mid.y - 8 },
      });
    }

    const nodeCur = this.nodePopup();
    if (nodeCur && this.popupRenderNode) {
      const pos = toScreen(this.popupRenderNode.x!, this.popupRenderNode.y!);
      this.nodePopup.set({
        node: nodeCur.node,
        position: { x: pos.x, y: pos.y },
      });
    }
  }

  /** Pins/unpins the node inspection popup for the given rendered node. */
  private toggleNodePopup(node: RenderNode): void {
    const current = this.nodePopup();
    if (current && current.node.id === node.id) {
      this.closeNodePopup();
      return;
    }
    this.popupNode = node.data;
    this.popupRenderNode = node;
    this.nodePopup.set({
      node: node.data,
      position: { x: node.x!, y: node.y! },
    });
    this.updatePopupPosition();
  }

  /** Closes the node inspection popup and clears its anchors. */
  protected closeNodePopup(): void {
    this.nodePopup.set(null);
    this.popupNode = null;
    this.popupRenderNode = null;
  }

  /** True when the node carries any metric metadata worth inspecting. */
  private hasMetadata(meta?: NodeMetricData): boolean {
    if (!meta) return false;
    return (
      !!meta.dependencyCentrality ||
      !!meta.linesPerFile ||
      !!meta.functionLength ||
      !!meta.dependencySummary ||
      !!meta.parameterCount ||
      !!meta.sums ||
      !!meta.averages
    );
  }

  /**
   * Defers lens hiding so the pointer can travel from the node to the lens icon
   * (which sits in empty SVG space beside the label) without it vanishing first.
   */
  private scheduleLensHide(): void {
    if (this.lensHideTimer) clearTimeout(this.lensHideTimer);
    this.lensHideTimer = setTimeout(() => {
      this.lensHideTimer = null;
      if (this.hoveredNodeId !== null) {
        this.hoveredNodeId = null;
        this.applyLensVisibility();
      }
    }, 300);
  }

  private cancelLensHide(): void {
    if (this.lensHideTimer) {
      clearTimeout(this.lensHideTimer);
      this.lensHideTimer = null;
    }
  }

  /** Re-applies lens visibility from hoveredNodeId (used outside simulation ticks). */
  private applyLensVisibility(): void {
    if (!this.svg) return;
    d3.select(this.svg.node())
      .selectAll<SVGGElement, RenderNode>('g.lens')
      .style('display', (d) =>
        d.id === this.hoveredNodeId && this.hasMetadata(d.data.metadata) ? null : 'none',
      );
  }

  /**
   * Handles edge number click — toggles popup with aggregated edge metadata.
   */
  private handleEdgeClick(event: MouseEvent, link: RenderLink): void {
    const key = `${(link.source as RenderNode).id}-${(link.target as RenderNode).id}`;
    const originals = this.linkToOriginals.get(key) || [];

    const sourceNode = this.allNodesMap.get((link.source as RenderNode).id);
    const targetNode = this.allNodesMap.get((link.target as RenderNode).id);

    const metadata: EdgeMetadata = {
      sourceName: sourceNode?.label || (link.source as RenderNode).id,
      targetName: targetNode?.label || (link.target as RenderNode).id,
      counts: link.counts,
      level: originals.find((l) => l.level)?.level,
    };

    if (link.bidirectional) {
      metadata.bidirectional = true;
      metadata.forwardCounts = link.forwardCounts;
      metadata.reverseCounts = link.reverseCounts;
    }

    const current = this.edgePopup();
    if (
      current &&
      current.metadata.sourceName === metadata.sourceName &&
      current.metadata.targetName === metadata.targetName
    ) {
      this.edgePopup.set(null);
      this.popupLink = null;
    } else {
      this.popupLink = link;
      this.edgePopup.set({ metadata, position: { x: event.clientX, y: event.clientY } });
      this.updatePopupPosition();
    }
  }

  /**
   * Truncates the line at the target's edge so the arrowhead doesn't overlap the circle.
   */
  protected shortenLine(source: RenderNode, target: RenderNode) {
    const dx = target.x! - source.x!;
    const dy = target.y! - source.y!;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { x: target.x!, y: target.y! };

    const gap = target.r + 8;
    const t = 1 - gap / dist;

    if (t < 0) return { x: target.x!, y: target.y! };

    return {
      x: source.x! + dx * t,
      y: source.y! + dy * t,
    };
  }

  /**
   * Renders/updates enclosure (parent) bubbles with dashed stroke, label, and collapse-on-click.
   * When showNodeParentText is true, renders the parent chain stacked vertically above the label.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected drawEnclosures(layer: any, enclosures: Enclosure[]) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const sel = layer.selectAll('g.enclosure').data(enclosures, (d: Enclosure) => d.id);

    const enter = sel.enter().append('g').attr('class', 'enclosure');

    enter
      .append('circle')
      .attr('fill', (d: Enclosure) => d.color)
      .attr('fill-opacity', D3_CONFIG.ENCLOSURE.FILL_OPACITY)
      .attr('stroke', (d: Enclosure) => d.color)
      .attr('stroke-opacity', D3_CONFIG.ENCLOSURE.STROKE_OPACITY)
      .attr('stroke-dasharray', '4 2')
      .attr('stroke-width', 1.5)
      .on('click', (e: MouseEvent, d: Enclosure) => this.collapse(d.id));

    enter
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('fill', (d: Enclosure) => d.color)
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .style('pointer-events', 'none');

    const merged = sel.merge(enter);

    merged
      .select('circle')
      .attr('cx', (d: Enclosure) => d.x)
      .attr('cy', (d: Enclosure) => d.y)
      .attr('r', (d: Enclosure) => d.r);

    merged
      .select('text')
      .attr('x', (d: Enclosure) => d.x)
      .attr('y', (d: Enclosure) => {
        const base = d.y - d.r - 8;
        if (self.showNodeParentText) {
          const numParents = self.getNodeParentText(d.id).length;
          return base - numParents * 11;
        }
        return base;
      })
      .text(null)

      .each(function (this: SVGTextElement, d: Enclosure) {
        const textEl = d3.select(this);
        textEl.selectAll('tspan').remove();

        if (self.showNodeParentText) {
          const chain = self.getNodeParentText(d.id);
          const lines = [...chain, d.label];

          lines.forEach((line: string, lineIdx: number) => {
            const isLast = lineIdx === lines.length - 1;
            const tspan = textEl.append('tspan').attr('x', d.x).text(line);

            if (lineIdx === 0) {
              tspan.attr('dy', 0);
            } else {
              tspan.attr('dy', 11);
            }

            if (!isLast) {
              tspan.style('font-size', '8px').style('font-weight', 'normal');
            } else {
              tspan.style('font-size', '11px').style('font-weight', 'bold');
            }
          });
        } else {
          textEl.append('tspan').attr('x', d.x).text(d.label);
        }
      });

    sel.exit().remove();
  }

  /**
   * Blends color from mid to red based on link value (capped at 10).
   */
  protected getLinkColor(value: number): string {
    return D3ColorUtils.blendColors(D3_CONFIG.LINK.COLOR_MID, '#ef4444', Math.min(value / 10, 1));
  }

  /**
   * Creates/updates SVG marker definitions for arrowheads matching link colors.
   */
  private updateArrowMarkers() {
    if (!this.links || this.links.length === 0) return;

    const uniqueColors = new Set(this.links.map((l) => this.getLinkColor(l.value)));

    d3.select(this.svg.node()!.querySelector('defs'))
      .selectAll('marker')
      .data(Array.from(uniqueColors), (d) => d as string)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .join((enter: any) =>
        enter
          .append('marker')
          .attr('id', (d: string) => `arrowhead-${d.replace('#', '')}`)
          .attr('viewBox', '0 -5 10 10')
          .attr('refX', 20)
          .attr('refY', 0)
          .attr('markerWidth', 6)
          .attr('markerHeight', 6)
          .attr('orient', 'auto')
          .append('path')
          .attr('d', 'M0,-5L10,0L0,5')
          .attr('fill', (d: string) => d),
      );
  }

  /**
   * Expands every expandable node in batches (5 per 500ms) for animated reveal.
   */
  expandAll() {
    this.expandFlag.set(true);
    const nodesToExpand: string[] = [];

    this.allNodesMap.forEach((node) => {
      if (node.children && node.children.length > 0) {
        nodesToExpand.push(node.id);
      }
    });

    let delay = 0;
    const batchSize = 5;

    for (let i = 0; i < nodesToExpand.length; i += batchSize) {
      const batch = nodesToExpand.slice(i, i + batchSize);

      setTimeout(() => {
        if (!this.expandFlag()) return;
        batch.forEach((nodeId) => {
          const nodeData = this.allNodesMap.get(nodeId);
          if (!nodeData) return;

          if (!this.expandedNodes.has(nodeId)) {
            this.expandedNodes.add(nodeId);
            const parentIndex = this.nodes.findIndex((n) => n.id === nodeId);
            if (parentIndex !== -1) {
              const parentNode = this.nodes[parentIndex];
              this.nodes.splice(parentIndex, 1);

              if (nodeData.children) {
                const children = nodeData.children
                  .filter((c) => !this.hiddenNodes().has(c.id))
                  .map((c) => this.createRenderNode(c, parentNode.x || 0, parentNode.y || 0));
                this.nodes.push(...children);
              }
            }
          }
        });

        this.updateSimulationState();
      }, delay);

      delay += 500;
    }
  }
  /**
   * Stop the expansion by changing the value of expand signal see expandAll()
   */
  stopExpansion() {
    if (this.expandFlag() == true) {
      this.expandFlag.set(false);
    }
  }

  /**
   * Collapses every expanded node in reverse-depth order (deepest first) in batches.
   */
  collapseAll() {
    const toCollapse = Array.from(this.expandedNodes).sort((a, b) => {
      const depthA = this.getNodeDepth(a);
      const depthB = this.getNodeDepth(b);
      return depthB - depthA;
    });

    let delay = 0;
    const batchSize = 5;

    for (let i = 0; i < toCollapse.length; i += batchSize) {
      const batch = toCollapse.slice(i, i + batchSize);

      setTimeout(() => {
        batch.forEach((nodeId) => {
          if (this.expandedNodes.has(nodeId)) {
            this.collapse(nodeId);
          }
        });
      }, delay);

      delay += 300;
    }
  }

  /**
   * Counts parent chain length from nodeId to root.
   */
  protected getNodeDepth(nodeId: string): number {
    let depth = 0;
    let curr = this.allNodesMap.get(nodeId);
    while (curr && curr.parentId) {
      depth++;
      curr = this.allNodesMap.get(curr.parentId);
    }
    return depth;
  }

  /**
   * Reads a slider value and applies it as the separation multiplier.
   */
  onSeparationChange(event: Event): void {
    const factor = parseFloat((event.target as HTMLInputElement).value);
    this.separation.set(factor);
    this.updateSeparation(factor);
  }

  /**
   * Scales charge, link distance, and collide padding by factor and restarts simulation.
   */
  protected updateSeparation(factor: number): void {
    if (!this.simulation) return;
    const config = this.getPhysicsConfig();
    this.simulation
      .force('charge', d3.forceManyBody().strength(config.chargeStrength * factor))
      .force(
        'link',
        d3
          .forceLink(this.links)
          .id((d) => (d as RenderNode).id)
          .distance(config.linkDistance * factor),
      )
      .force(
        'collide',
        d3
          .forceCollide()
          .radius((d) => (d as RenderNode).r + config.collidePadding * factor)
          .iterations(config.collideIterations),
      );
    this.simulation.alpha(0.5).restart();
  }

  /**
   * Download graph as SVG
   */
  downloadSVG(): void {
    downloadSvg(this.container.nativeElement, 'dependency-graph.svg');
  }

  /**
   * Download graph as PNG
   */
  downloadPNG(): void {
    downloadPng(this.container.nativeElement, this.width, this.height, 'dependency-graph.png');
  }
}
