import Phaser from 'phaser';
import { LEFT, PLAYER_ACCENTS, SEGMENT_COLORS } from '../math-duel/constants.js';

const SCENE_WIDTH = 1120;
const SCENE_HEIGHT = 960;
const PICK_RADIUS = 22;
const BOARD_PADDING = 76;
const BOARD_WIDTH_SCALE = 0.86;

export class MathDuelScene extends Phaser.Scene {
  constructor({ onNodeSelected }) {
    super('math-duel-scene');
    this.onNodeSelected = onNodeSelected;
    this.viewModel = null;
    this.interactionEnabled = true;
    this.pendingViewModel = null;
  }

  create() {
    this.scale.on('resize', () => this.redraw());
    this.input.on('pointerup', (pointer) => {
      if (!this.interactionEnabled || !this.viewModel) {
        return;
      }

      const node = this.pickNode(pointer.x, pointer.y);
      if (node) {
        this.onNodeSelected(node.id);
      }
    });

    this.baseGraphics = this.add.graphics();
    this.pathGraphics = this.add.graphics();
    this.pieceGraphics = this.add.graphics();
    this.labelLayer = this.add.container(0, 0);
    this.redraw();

    if (this.pendingViewModel) {
      this.setViewModel(this.pendingViewModel);
      this.pendingViewModel = null;
    }
  }

  setInteractionEnabled(enabled) {
    this.interactionEnabled = enabled;
    if (this.game?.canvas) {
      this.game.canvas.style.cursor = enabled ? 'pointer' : 'default';
    }
  }

  setViewModel(viewModel) {
    if (!this.sys.isActive()) {
      this.pendingViewModel = viewModel;
      return;
    }

    this.viewModel = viewModel;
    this.redraw();
  }

  getLayout() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const bounds = this.viewModel?.boardSpec?.bounds ?? {
      minX: 0,
      maxX: 14,
      minY: 0,
      maxY: 20,
    };
    const boardWidth = Math.max(1, bounds.maxY - bounds.minY);
    const boardHeight = Math.max(1, bounds.maxX - bounds.minX);
    const rawSpacingX = (width - (BOARD_PADDING * 2)) / boardWidth;
    const rawSpacingY = (height - (BOARD_PADDING * 2)) / boardHeight;
    const spacingX = rawSpacingX * BOARD_WIDTH_SCALE;
    const spacingY = rawSpacingY;
    const boardPixelWidth = boardWidth * spacingX;
    const boardPixelHeight = boardHeight * spacingY;
    const minStep = Math.min(spacingX, spacingY);

    return {
      width,
      height,
      bounds,
      spacingX,
      spacingY,
      offsetX: (width - boardPixelWidth) / 2,
      offsetY: (height - boardPixelHeight) / 2,
      pieceRadius: Math.max(20, minStep * 0.7),
      nodeRadius: Math.max(11, minStep * 0.36),
    };
  }

  getWorldPoint(layout, node) {
    return {
      x: layout.offsetX + ((node.latticeY - layout.bounds.minY) * layout.spacingX),
      y: layout.offsetY + ((node.latticeX - layout.bounds.minX) * layout.spacingY),
    };
  }

  clearLabels() {
    this.labelLayer.removeAll(true);
  }

  drawBoard(layout) {
    this.baseGraphics.clear();
    this.baseGraphics.fillStyle(0xf7efd8, 1);
    this.baseGraphics.fillRoundedRect(26, 26, layout.width - 52, layout.height - 52, 28);

    const { boardSpec, state } = this.viewModel;
    const edgeKeys = new Set();

    for (const nodeId of boardSpec.leftCampNodeIds) {
      const node = boardSpec.nodesById[nodeId];
      const point = this.getWorldPoint(layout, node);
      this.baseGraphics.fillStyle(0x2d86ff, 0.08);
      this.baseGraphics.fillCircle(point.x, point.y, layout.nodeRadius * 2.7);
    }

    for (const nodeId of boardSpec.rightCampNodeIds) {
      const node = boardSpec.nodesById[nodeId];
      const point = this.getWorldPoint(layout, node);
      this.baseGraphics.fillStyle(0xde5540, 0.08);
      this.baseGraphics.fillCircle(point.x, point.y, layout.nodeRadius * 2.7);
    }

    this.baseGraphics.lineStyle(1.1, 0x7a6854, 0.1);
    for (const node of boardSpec.nodes) {
      const fromPoint = this.getWorldPoint(layout, node);

      for (const neighborId of node.neighborIds) {
        const edgeKey = [node.id, neighborId].sort().join(':');
        if (edgeKeys.has(edgeKey)) {
          continue;
        }
        edgeKeys.add(edgeKey);

        const neighbor = boardSpec.nodesById[neighborId];
        const toPoint = this.getWorldPoint(layout, neighbor);
        this.baseGraphics.beginPath();
        this.baseGraphics.moveTo(fromPoint.x, fromPoint.y);
        this.baseGraphics.lineTo(toPoint.x, toPoint.y);
        this.baseGraphics.strokePath();
      }
    }

    for (const node of boardSpec.nodes) {
      const point = this.getWorldPoint(layout, node);
      const occupyingPieceId = state.occupancyByNode[node.id];
      const fillColor = 0xe4e1da;

      this.baseGraphics.fillStyle(fillColor, 1);
      this.baseGraphics.fillCircle(point.x, point.y, layout.nodeRadius);
      this.baseGraphics.lineStyle(1.2, 0xaaa399, 0.95);
      this.baseGraphics.strokeCircle(point.x, point.y, layout.nodeRadius);

      if (node.visibleLabel !== null && !occupyingPieceId) {
        const label = this.add.text(
          point.x,
          point.y,
          `${node.visibleLabel}`,
          {
            fontFamily: '"Avenir Next", "PingFang SC", sans-serif',
            fontSize: `${Math.max(12, layout.nodeRadius * 1.05)}px`,
            color: '#5d5650',
            fontStyle: '700',
          },
        ).setOrigin(0.5);

        this.labelLayer.add(label);
      }
    }

    if (state.selectedPieceId) {
      const selectedPiece = state.piecesById[state.selectedPieceId];
      const selectedNode = boardSpec.nodesById[selectedPiece.nodeId];
      const selectedPoint = this.getWorldPoint(layout, selectedNode);
      this.baseGraphics.lineStyle(5, PLAYER_ACCENTS[selectedPiece.owner], 0.94);
      this.baseGraphics.strokeCircle(selectedPoint.x, selectedPoint.y, layout.pieceRadius + 7);
    }

    const previewsByDestination = new Map();
    for (const preview of state.legalActionPreviews) {
      if (!previewsByDestination.has(preview.toNodeId)) {
        previewsByDestination.set(preview.toNodeId, []);
      }
      previewsByDestination.get(preview.toNodeId).push(preview);
    }

    for (const [nodeId, previews] of previewsByDestination.entries()) {
      const node = boardSpec.nodesById[nodeId];
      const point = this.getWorldPoint(layout, node);
      this.baseGraphics.lineStyle(3, 0xf7a531, 0.86);
      this.baseGraphics.strokeCircle(point.x, point.y, layout.nodeRadius + 8);

      if (previews.length > 1) {
        const badge = this.add.text(
          point.x + (layout.nodeRadius * 1.4),
          point.y - (layout.nodeRadius * 1.6),
          `${previews.length}`,
          {
            fontFamily: '"Avenir Next", "PingFang SC", sans-serif',
            fontSize: `${Math.max(11, layout.spacingX * 0.32)}px`,
            color: '#ffffff',
            backgroundColor: '#c8701a',
            padding: {
              left: 5,
              right: 5,
              top: 2,
              bottom: 2,
            },
          },
        ).setOrigin(0.5);

        this.labelLayer.add(badge);
      }
    }
  }

  drawPreviewPath(layout) {
    this.pathGraphics.clear();
    const activePreview = this.viewModel.activePreview;

    if (!activePreview) {
      return;
    }

    activePreview.segments.forEach((segment, index) => {
      const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
      const points = [
        this.viewModel.boardSpec.nodesById[segment.fromNodeId],
        ...segment.crossedNodeIds.map((nodeId) => this.viewModel.boardSpec.nodesById[nodeId]),
        this.viewModel.boardSpec.nodesById[segment.toNodeId],
      ].map((node) => this.getWorldPoint(layout, node));

      this.pathGraphics.lineStyle(7, color, 0.48);
      this.pathGraphics.beginPath();
      this.pathGraphics.moveTo(points[0].x, points[0].y);
      for (let indexPoint = 1; indexPoint < points.length; indexPoint += 1) {
        this.pathGraphics.lineTo(points[indexPoint].x, points[indexPoint].y);
      }
      this.pathGraphics.strokePath();

      const landingPoint = points[points.length - 1];
      this.pathGraphics.fillStyle(color, 0.85);
      this.pathGraphics.fillCircle(landingPoint.x, landingPoint.y, layout.nodeRadius + 4);
    });
  }

  drawPieces(layout) {
    this.pieceGraphics.clear();
    const { boardSpec, state } = this.viewModel;

    for (const piece of Object.values(state.piecesById)) {
      const node = boardSpec.nodesById[piece.nodeId];
      const point = this.getWorldPoint(layout, node);
      const fillColor = piece.owner === LEFT ? 0x2d86ff : 0xde5540;
      const textColor = piece.owner === LEFT ? '#f8fbff' : '#fff6f2';

      this.pieceGraphics.fillStyle(fillColor, 1);
      this.pieceGraphics.fillCircle(point.x, point.y, layout.pieceRadius);
      this.pieceGraphics.lineStyle(3, 0x203040, 0.24);
      this.pieceGraphics.strokeCircle(point.x, point.y, layout.pieceRadius);

      const digitLabel = this.add.text(
        point.x,
        point.y,
        `${piece.digit}`,
        {
          fontFamily: '"Avenir Next Condensed", "PingFang SC", sans-serif',
          fontSize: `${Math.max(18, layout.spacingX * 0.66)}px`,
          color: textColor,
          fontStyle: '700',
        },
      ).setOrigin(0.5, 0.5);

      this.labelLayer.add(digitLabel);
    }
  }

  pickNode(worldX, worldY) {
    const layout = this.getLayout();
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const node of this.viewModel.boardSpec.nodes) {
      const point = this.getWorldPoint(layout, node);
      const distance = Phaser.Math.Distance.Between(point.x, point.y, worldX, worldY);

      if (distance < bestDistance && distance <= PICK_RADIUS + layout.nodeRadius) {
        best = node;
        bestDistance = distance;
      }
    }

    return best;
  }

  redraw() {
    if (!this.viewModel) {
      return;
    }

    this.clearLabels();
    const layout = this.getLayout();
    this.cameras.main.setBackgroundColor(0xf4ebd8);
    this.drawBoard(layout);
    this.drawPreviewPath(layout);
    this.drawPieces(layout);
  }
}

export function createPhaserConfig(parent) {
  return {
    type: Phaser.AUTO,
    parent,
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    backgroundColor: '#f4ebd8',
    scene: [],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: SCENE_WIDTH,
      height: SCENE_HEIGHT,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
  };
}
