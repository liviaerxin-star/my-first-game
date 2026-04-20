import { LEFT, RIGHT } from './constants.js';

const BOARD_COORDINATES = [
  [0, 10], [1, 9], [1, 11], [2, 8], [2, 10], [2, 12], [3, 7], [3, 9], [3, 11], [3, 13],
  [4, 0], [4, 2], [4, 4], [4, 6], [4, 8], [4, 10], [4, 12], [4, 14], [4, 16], [4, 18], [4, 20],
  [5, 1], [5, 3], [5, 5], [5, 7], [5, 9], [5, 11], [5, 13], [5, 15], [5, 17], [5, 19],
  [6, 2], [6, 4], [6, 6], [6, 8], [6, 10], [6, 12], [6, 14], [6, 16], [6, 18],
  [7, 3], [7, 5], [7, 7], [7, 9], [7, 11], [7, 13], [7, 15], [7, 17],
  [8, 2], [8, 4], [8, 6], [8, 8], [8, 10], [8, 12], [8, 14], [8, 16], [8, 18],
  [9, 1], [9, 3], [9, 5], [9, 7], [9, 9], [9, 11], [9, 13], [9, 15], [9, 17], [9, 19],
  [10, 0], [10, 2], [10, 4], [10, 6], [10, 8], [10, 10], [10, 12], [10, 14], [10, 16], [10, 18], [10, 20],
  [11, 7], [11, 9], [11, 11], [11, 13], [12, 8], [12, 10], [12, 12], [13, 9], [13, 11], [14, 10],
];

const LATTICE_DIRECTIONS = [
  { key: 'north', dx: 0, dy: -2 },
  { key: 'south', dx: 0, dy: 2 },
  { key: 'northEast', dx: 1, dy: -1 },
  { key: 'southEast', dx: 1, dy: 1 },
  { key: 'northWest', dx: -1, dy: -1 },
  { key: 'southWest', dx: -1, dy: 1 },
];

const TOP_CAMP_BY_DIGIT = [
  [0, 10], [3, 7], [3, 11], [3, 9], [3, 13], [2, 12], [2, 10], [2, 8], [1, 9], [1, 11],
];

const BOTTOM_CAMP_BY_DIGIT = [
  [14, 10], [11, 13], [11, 9], [11, 11], [11, 7], [12, 8], [12, 10], [12, 12], [13, 11], [13, 9],
];

const SCORE_LABELS = new Map([
  ['0:10', 0],
  ['1:9', 8],
  ['1:11', 9],
  ['2:8', 7],
  ['2:10', 6],
  ['2:12', 5],
  ['3:7', 1],
  ['3:9', 3],
  ['3:11', 2],
  ['3:13', 4],
  ['11:7', 4],
  ['11:9', 2],
  ['11:11', 3],
  ['11:13', 1],
  ['12:8', 5],
  ['12:10', 6],
  ['12:12', 7],
  ['13:9', 9],
  ['13:11', 8],
  ['14:10', 0],
]);

function getCoordKey(x, y) {
  return `${x}:${y}`;
}

function buildNodes() {
  return BOARD_COORDINATES.map(([latticeX, latticeY], index) => ({
    id: `node-${index}`,
    code: `(${latticeX},${latticeY})`,
    latticeX,
    latticeY,
    visibleLabel: SCORE_LABELS.get(getCoordKey(latticeX, latticeY)) ?? null,
    region: 'public',
    neighborIds: [],
  }));
}

function getCampNodeIds(nodeByCoord, coordinates, region) {
  return coordinates.map(([latticeX, latticeY]) => {
    const node = nodeByCoord.get(getCoordKey(latticeX, latticeY));
    node.region = region;
    return node.id;
  });
}

export function createMathDuelBoardSpec() {
  const nodes = buildNodes();
  const nodeByCoord = new Map(nodes.map((node) => [getCoordKey(node.latticeX, node.latticeY), node]));

  for (const node of nodes) {
    node.neighborIds = LATTICE_DIRECTIONS
      .map(({ dx, dy }) => nodeByCoord.get(getCoordKey(node.latticeX + dx, node.latticeY + dy))?.id)
      .filter(Boolean);
  }

  const leftCampNodeIds = getCampNodeIds(nodeByCoord, TOP_CAMP_BY_DIGIT, LEFT);
  const rightCampNodeIds = getCampNodeIds(nodeByCoord, BOTTOM_CAMP_BY_DIGIT, RIGHT);
  const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const xValues = nodes.map((node) => node.latticeX);
  const yValues = nodes.map((node) => node.latticeY);

  return {
    nodes,
    nodesById,
    nodeByCoord,
    directions: LATTICE_DIRECTIONS,
    leftCampNodeIds,
    rightCampNodeIds,
    leftTipNodeId: nodeByCoord.get(getCoordKey(0, 10)).id,
    rightTipNodeId: nodeByCoord.get(getCoordKey(14, 10)).id,
    bounds: {
      minX: Math.min(...xValues),
      maxX: Math.max(...xValues),
      minY: Math.min(...yValues),
      maxY: Math.max(...yValues),
    },
    coordKeyFor: getCoordKey,
    getNodeAt(latticeX, latticeY) {
      return nodeByCoord.get(getCoordKey(latticeX, latticeY)) ?? null;
    },
    step(nodeId, directionKey) {
      const node = nodesById[nodeId];
      const direction = LATTICE_DIRECTIONS.find((item) => item.key === directionKey);

      if (!node || !direction) {
        return null;
      }

      return nodeByCoord.get(getCoordKey(
        node.latticeX + direction.dx,
        node.latticeY + direction.dy,
      )) ?? null;
    },
    getCampNodeIdsFor(player) {
      return player === LEFT ? leftCampNodeIds : rightCampNodeIds;
    },
    getTargetCampNodeIdsFor(player) {
      return player === LEFT ? rightCampNodeIds : leftCampNodeIds;
    },
  };
}
