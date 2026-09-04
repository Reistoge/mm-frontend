import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';
import { BaseGraphComponent } from '../base-graph.component';
import { D3_CONFIG } from '../../config/d3-config';
import { NodeType, PhysicsConfig, Enclosure, LegendItem } from '../../types/graph.types';
import { graphs, colors } from '../../design-system';
import { GraphWrapperComponent } from '../graph-wrapper/graph-wrapper.component';

@Component({
  selector: 'app-inclusive-enclosure-graph',
  standalone: true,
  imports: [CommonModule, GraphWrapperComponent],
  templateUrl: './inclusive-enclosure-graph.component.html',
  styleUrls: ['./inclusive-enclosure-graph.component.css'],
})
export class InclusiveEnclosureGraphComponent extends BaseGraphComponent {
  graphs = graphs;
  colors = colors;
  showTreeModal = signal(false);

  legendItems: LegendItem[] = [
    { colorClass: graphs.node.folder, label: 'Folder' },
    { colorClass: graphs.node.file, label: 'File' },
    { colorClass: graphs.node.class, label: 'Class' },
    { colorClass: graphs.node.function, label: 'Function' },
  ];

  override getPhysicsConfig(): PhysicsConfig {
    return {
      chargeStrength: D3_CONFIG.PHYSICS.MODULE_CLASS.CHARGE_STRENGTH,
      linkDistance: D3_CONFIG.PHYSICS.MODULE_CLASS.LINK_DISTANCE,
      centerStrength: D3_CONFIG.PHYSICS.MODULE_CLASS.CENTER_STRENGTH,
      collidePadding: D3_CONFIG.PHYSICS.MODULE_CLASS.COLLIDE_PADDING,
      collideIterations: D3_CONFIG.PHYSICS.MODULE_CLASS.COLLIDE_ITERATIONS,
      clusterStrength: 0.2,
      enclosurePushForce: 0.03,
      enclosureLeashForce: 0.08,
    };
  }

  override getColorScheme(): Record<string, string> {
    return { ...colors.visualizationHex };
  }

  override getRadiusScheme(): Record<string, number> {
    return {
      DIRECTORY: 35,
      FILE: 20,
      CLASS: 12,
      FUNCTION: 6,
    };
  }

  override filterNodesAndLinks(): void {
    const hidden = this.hiddenNodes();
    const rootNodes = Array.from(this.allNodesMap.values()).filter(
      (n) => !n.parentId && !hidden.has(n.id),
    );

    this.nodes = rootNodes.map((n) => this.createRenderNode(n));
    this.rebuildLinks();
  }

  override calculateEnclosures(): Enclosure[] {
    const enclosures: Enclosure[] = [];
    const colorScheme = this.getColorScheme();
    const expandedSet = new Set(this.expandedNodes);

    const encMap = new Map<string, Enclosure>();

    this.expandedNodes.forEach((parentId) => {
      const descendants = this.nodes.filter((n) => this.isDescendant(n.id, parentId));

      if (descendants.length > 0) {
        const pData = this.allNodesMap.get(parentId);
        const circle = d3.packEnclose(descendants as d3.PackCircle[]);
        if (circle) {
          const enc: Enclosure = {
            id: parentId,
            x: circle.x,
            y: circle.y,
            r: circle.r + D3_CONFIG.ENCLOSURE.PADDING,
            label: pData?.label || '',
            color: colorScheme[pData?.type as NodeType] || '#ccc',
          };
          enclosures.push(enc);
          encMap.set(parentId, enc);
        }
      }
    });

    // Second pass: ensure parent enclosures wrap child enclosures, not just raw nodes
    for (const enc of enclosures) {
      const childEnclosures: d3.PackCircle[] = [];
      const nonExpandedDescendants: d3.PackCircle[] = [];

      encMap.forEach((childEnc, childId) => {
        if (childId !== enc.id && expandedSet.has(childId) && this.isDescendant(childId, enc.id)) {
          childEnclosures.push({ x: childEnc.x, y: childEnc.y, r: childEnc.r });
        }
      });

      if (childEnclosures.length > 0) {
        const nonExpanded = this.nodes.filter(
          (n) => this.isDescendant(n.id, enc.id) && !expandedSet.has(n.id),
        );
        nonExpanded.forEach((n) => {
          nonExpandedDescendants.push({ x: n.x!, y: n.y!, r: n.r });
        });

        const allCircles = [...childEnclosures, ...nonExpandedDescendants];
        const newCircle = d3.packEnclose(allCircles as d3.PackCircle[]);
        if (newCircle) {
          enc.x = newCircle.x;
          enc.y = newCircle.y;
          enc.r = newCircle.r + D3_CONFIG.ENCLOSURE.PADDING;
          encMap.set(enc.id, enc);
        }
      }
    }

    return enclosures;
  }
}
