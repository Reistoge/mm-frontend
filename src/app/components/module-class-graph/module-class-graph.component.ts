import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';
import { BaseGraphComponent } from '../base-graph.component';
import { D3_CONFIG } from '../../config/d3-config';
import { NodeType, PhysicsConfig, Enclosure, LegendItem } from '../../types/graph.types';
import { graphs, colors } from '../../design-system';
import { GraphWrapperComponent } from '../graph-wrapper/graph-wrapper.component';

@Component({
  selector: 'app-module-class-graph',
  standalone: true,
  imports: [CommonModule, GraphWrapperComponent],
  templateUrl: './module-class-graph.component.html',
  styleUrls: ['./module-class-graph.component.css'],
})
export class ModuleClassGraphComponent extends BaseGraphComponent {
  graphs = graphs;
  colors = colors;
  showTreeModal = signal(false);

  legendItems: LegendItem[] = [
    { colorClass: graphs.node.folder, label: 'Folder' },
    { colorClass: graphs.node.file, label: 'File' },
    { colorClass: graphs.node.class, label: 'Class' },
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

    this.expandedNodes.forEach((parentId) => {
      const descendants = this.nodes.filter((n) => this.isDescendant(n.id, parentId));

      if (descendants.length > 0) {
        const pData = this.allNodesMap.get(parentId);
        const circle = d3.packEnclose(descendants as d3.PackCircle[]);
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
}
