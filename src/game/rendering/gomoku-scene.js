import Phaser from 'phaser';
import { AI, EMPTY, HUMAN } from '../core/constants.js';

const BOARD_SIZE = 960;

export class GomokuScene extends Phaser.Scene {
  constructor({ onCellSelected }) {
    super('gomoku-scene');
    this.onCellSelected = onCellSelected;
    this.viewModel = null;
    this.interactionEnabled = true;
    this.isReady = false;
  }

  create() {
    this.surfaceGraphics = this.add.graphics();
    this.gridGraphics = this.add.graphics();
    this.markerGraphics = this.add.graphics();
    this.stoneGraphics = this.add.graphics();
    this.labelContainer = this.add.container(0, 0);

    this.input.on('pointerup', (pointer) => {
      if (!this.interactionEnabled || !this.viewModel) {
        return;
      }

      const move = this.pickCell(pointer.x, pointer.y);
      if (move) {
        this.onCellSelected(move);
      }
    });

    this.scale.on('resize', () => {
      this.redraw();
    });

    this.isReady = true;
    this.applyCursor();

    if (this.pendingViewModel) {
      this.setViewModel(this.pendingViewModel);
      this.pendingViewModel = null;
    }
  }

  setViewModel(viewModel) {
    if (!this.isReady) {
      this.pendingViewModel = viewModel;
      return;
    }

    this.viewModel = viewModel;
    this.redraw();
  }

  setInteractionEnabled(enabled) {
    this.interactionEnabled = enabled;
    this.applyCursor();
  }

  applyCursor() {
    if (this.game?.canvas) {
      this.game.canvas.style.cursor = this.interactionEnabled ? 'pointer' : 'default';
    }
  }

  computeLayout() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const boardSize = this.viewModel.boardSize;
    const margin = 90;
    const boardPixels = Math.min(width, height) - (margin * 2);
    const cellSize = boardPixels / (boardSize - 1);
    const originX = (width - boardPixels) / 2;
    const originY = (height - boardPixels) / 2;

    return {
      width,
      height,
      boardPixels,
      boardSize,
      cellSize,
      originX,
      originY,
      stoneRadius: Math.max(15, Math.min(28, cellSize * 0.42)),
    };
  }

  boardToWorld(layout, x, y) {
    return {
      x: layout.originX + (x * layout.cellSize),
      y: layout.originY + (y * layout.cellSize),
    };
  }

  drawSurface(layout) {
    this.surfaceGraphics.clear();
    this.surfaceGraphics.fillStyle(0xf2e3bd, 1);
    this.surfaceGraphics.fillRoundedRect(
      layout.originX - 34,
      layout.originY - 34,
      layout.boardPixels + 68,
      layout.boardPixels + 68,
      32,
    );

    this.surfaceGraphics.fillStyle(0xf7f0da, 0.6);
    this.surfaceGraphics.fillRoundedRect(
      layout.originX - 12,
      layout.originY - 12,
      layout.boardPixels + 24,
      layout.boardPixels + 24,
      20,
    );
  }

  drawGrid(layout) {
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(2, 0x6d5e4a, 0.78);

    for (let index = 0; index < layout.boardSize; index += 1) {
      const offset = index * layout.cellSize;

      this.gridGraphics.beginPath();
      this.gridGraphics.moveTo(layout.originX, layout.originY + offset);
      this.gridGraphics.lineTo(layout.originX + layout.boardPixels, layout.originY + offset);
      this.gridGraphics.strokePath();

      this.gridGraphics.beginPath();
      this.gridGraphics.moveTo(layout.originX + offset, layout.originY);
      this.gridGraphics.lineTo(layout.originX + offset, layout.originY + layout.boardPixels);
      this.gridGraphics.strokePath();
    }

    const starPoints = this.getStarPoints(layout.boardSize);
    this.gridGraphics.fillStyle(0x6d5e4a, 0.82);

    for (const point of starPoints) {
      const world = this.boardToWorld(layout, point.x, point.y);
      this.gridGraphics.fillCircle(world.x, world.y, Math.max(4, layout.cellSize * 0.08));
    }
  }

  drawCoordinates(layout) {
    this.labelContainer.removeAll(true);

    for (let index = 0; index < layout.boardSize; index += 1) {
      const labelX = this.add.text(
        layout.originX + (index * layout.cellSize),
        layout.originY - 38,
        String.fromCharCode(65 + index),
        {
          fontFamily: '"Avenir Next", "PingFang SC", sans-serif',
          fontSize: `${Math.max(16, layout.cellSize * 0.26)}px`,
          color: '#5d5143',
        },
      ).setOrigin(0.5);

      const labelY = this.add.text(
        layout.originX - 36,
        layout.originY + (index * layout.cellSize),
        `${index + 1}`,
        {
          fontFamily: '"Avenir Next", "PingFang SC", sans-serif',
          fontSize: `${Math.max(16, layout.cellSize * 0.26)}px`,
          color: '#5d5143',
        },
      ).setOrigin(0.5);

      this.labelContainer.add([labelX, labelY]);
    }
  }

  getStarPoints(boardSize) {
    if (boardSize <= 9) {
      const mid = Math.floor(boardSize / 2);
      return [
        { x: 2, y: 2 },
        { x: boardSize - 3, y: 2 },
        { x: mid, y: mid },
        { x: 2, y: boardSize - 3 },
        { x: boardSize - 3, y: boardSize - 3 },
      ];
    }

    const mid = Math.floor(boardSize / 2);
    return [
      { x: 3, y: 3 },
      { x: boardSize - 4, y: 3 },
      { x: mid, y: mid },
      { x: 3, y: boardSize - 4 },
      { x: boardSize - 4, y: boardSize - 4 },
    ];
  }

  drawMarkers(layout) {
    this.markerGraphics.clear();

    const winningCells = new Set(
      (this.viewModel.winningCells ?? []).map((cell) => `${cell.x}:${cell.y}`),
    );

    if (this.viewModel.lastMove) {
      const world = this.boardToWorld(layout, this.viewModel.lastMove.x, this.viewModel.lastMove.y);
      this.markerGraphics.lineStyle(4, 0xde6a43, 0.9);
      this.markerGraphics.strokeCircle(world.x, world.y, layout.stoneRadius + 8);
    }

    this.markerGraphics.lineStyle(4, 0x23856d, 0.95);
    for (const key of winningCells) {
      const [x, y] = key.split(':').map(Number);
      const world = this.boardToWorld(layout, x, y);
      this.markerGraphics.strokeCircle(world.x, world.y, layout.stoneRadius + 12);
    }
  }

  drawStones(layout) {
    this.stoneGraphics.clear();

    for (let y = 0; y < layout.boardSize; y += 1) {
      for (let x = 0; x < layout.boardSize; x += 1) {
        const value = this.viewModel.board[(y * layout.boardSize) + x];
        if (value === EMPTY) {
          continue;
        }

        const world = this.boardToWorld(layout, x, y);
        const radius = layout.stoneRadius;

        if (value === HUMAN) {
          this.stoneGraphics.fillStyle(0x182129, 1);
          this.stoneGraphics.fillCircle(world.x, world.y, radius);
          this.stoneGraphics.fillStyle(0xffffff, 0.12);
          this.stoneGraphics.fillCircle(world.x - (radius * 0.28), world.y - (radius * 0.28), radius * 0.34);
        } else if (value === AI) {
          this.stoneGraphics.fillStyle(0xf6f3ea, 1);
          this.stoneGraphics.fillCircle(world.x, world.y, radius);
          this.stoneGraphics.lineStyle(3, 0x3d4349, 0.9);
          this.stoneGraphics.strokeCircle(world.x, world.y, radius);
          this.stoneGraphics.fillStyle(0xf7cb78, 0.34);
          this.stoneGraphics.fillCircle(world.x - (radius * 0.24), world.y - (radius * 0.24), radius * 0.28);
        }
      }
    }
  }

  pickCell(worldX, worldY) {
    const layout = this.computeLayout();
    const rawX = (worldX - layout.originX) / layout.cellSize;
    const rawY = (worldY - layout.originY) / layout.cellSize;
    const x = Math.round(rawX);
    const y = Math.round(rawY);

    if (x < 0 || x >= layout.boardSize || y < 0 || y >= layout.boardSize) {
      return null;
    }

    const snapped = this.boardToWorld(layout, x, y);
    const distance = Phaser.Math.Distance.Between(worldX, worldY, snapped.x, snapped.y);

    if (distance > layout.cellSize * 0.46) {
      return null;
    }

    return { x, y };
  }

  redraw() {
    if (!this.viewModel) {
      return;
    }

    const layout = this.computeLayout();
    this.cameras.main.setBackgroundColor(0xf6efd9);
    this.drawSurface(layout);
    this.drawGrid(layout);
    this.drawCoordinates(layout);
    this.drawMarkers(layout);
    this.drawStones(layout);
  }
}

export function createPhaserConfig(parent) {
  return {
    type: Phaser.AUTO,
    parent,
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    backgroundColor: '#f6efd9',
    scene: [],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: BOARD_SIZE,
      height: BOARD_SIZE,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
  };
}
