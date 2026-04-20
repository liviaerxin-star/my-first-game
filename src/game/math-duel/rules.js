import { EXPRESSION_PREVIEW_LIMIT, LEFT, MOVE_TYPES, PLAYERS, RIGHT } from './constants.js';

function getMoveRank(moveType) {
  switch (moveType) {
    case MOVE_TYPES.SHIFT:
      return 0;
    case MOVE_TYPES.HOP:
      return 1;
    case MOVE_TYPES.SINGLE_CROSS:
      return 2;
    case MOVE_TYPES.CHAIN_CROSS:
      return 3;
    default:
      return 9;
  }
}

function createPieceId(owner, digit) {
  return `${owner}-${digit}`;
}

function cloneOccupancy(occupancyByNode) {
  return { ...occupancyByNode };
}

function clonePieces(piecesById) {
  return Object.fromEntries(
    Object.entries(piecesById).map(([pieceId, piece]) => [pieceId, { ...piece }]),
  );
}

function getOtherPlayer(player) {
  return player === LEFT ? RIGHT : LEFT;
}

function getNode(boardSpec, nodeId) {
  return boardSpec.nodesById[nodeId];
}

function getPieceAtNode(state, nodeId) {
  const pieceId = state.occupancyByNode[nodeId];
  return pieceId ? state.piecesById[pieceId] : null;
}

function buildProofGroup(resultRecord) {
  const expressions = resultRecord?.expressions ?? [];

  return {
    totalCount: expressions.length,
    expressions: expressions.slice(0, EXPRESSION_PREVIEW_LIMIT),
    truncatedCount: Math.max(0, expressions.length - EXPRESSION_PREVIEW_LIMIT),
  };
}

function buildSegment(boardSpec, state, fromNodeId, toNodeId, directionKey, crossedNodeIds, resultValue, proofGroup) {
  const crossedPieces = crossedNodeIds.map((nodeId) => state.piecesById[state.occupancyByNode[nodeId]]);

  return {
    fromNodeId,
    toNodeId,
    directionKey,
    crossedNodeIds,
    crossedPieceIds: crossedPieces.map((piece) => piece.id),
    digits: crossedPieces.map((piece) => piece.digit),
    resultValue,
    proofGroup,
    nodeCodes: {
      from: getNode(boardSpec, fromNodeId).code,
      to: getNode(boardSpec, toNodeId).code,
    },
  };
}

function summarizeMove(boardSpec, state, movePreview) {
  const piece = state.piecesById[movePreview.pieceId];
  const fromNode = getNode(boardSpec, movePreview.fromNodeId);
  const toNode = getNode(boardSpec, movePreview.toNodeId);

  return {
    title: `${piece.digit} 号子 · ${movePreview.moveType}`,
    detail: `${fromNode.code} → ${toNode.code}`,
  };
}

export function scoreMathDuelState(boardSpec, state) {
  const playerBreakdowns = {
    [LEFT]: {
      player: LEFT,
      totalScore: 0,
      pieces: [],
    },
    [RIGHT]: {
      player: RIGHT,
      totalScore: 0,
      pieces: [],
    },
  };

  for (const piece of Object.values(state.piecesById)) {
    const node = boardSpec.nodesById[piece.nodeId];
    const hasScoreLabel = Number.isInteger(node.visibleLabel);
    const pieceScore = hasScoreLabel ? Math.abs(piece.digit - node.visibleLabel) : null;
    const breakdown = {
      pieceId: piece.id,
      digit: piece.digit,
      nodeId: piece.nodeId,
      nodeCode: node.code,
      nodeLabel: node.visibleLabel,
      pieceScore,
    };

    playerBreakdowns[piece.owner].pieces.push(breakdown);
    if (pieceScore !== null) {
      playerBreakdowns[piece.owner].totalScore += pieceScore;
    }
  }

  let winner = null;
  if (playerBreakdowns[LEFT].totalScore > playerBreakdowns[RIGHT].totalScore) {
    winner = LEFT;
  } else if (playerBreakdowns[RIGHT].totalScore > playerBreakdowns[LEFT].totalScore) {
    winner = RIGHT;
  }

  return {
    players: playerBreakdowns,
    winner,
  };
}

export function getCallStopAvailability(boardSpec, state) {
  return PLAYERS.filter((player) => {
    const targetCampNodeIds = new Set(boardSpec.getTargetCampNodeIdsFor(player));

    return Object.values(state.piecesById)
      .filter((piece) => piece.owner === player)
      .every((piece) => targetCampNodeIds.has(piece.nodeId));
  });
}

function sortMovePreviews(boardSpec, movePreviews) {
  return movePreviews.slice().sort((left, right) => {
    const leftNode = boardSpec.nodesById[left.toNodeId];
    const rightNode = boardSpec.nodesById[right.toNodeId];

    return (getMoveRank(left.moveType) - getMoveRank(right.moveType))
      || leftNode.code.localeCompare(rightNode.code)
      || (left.segments.length - right.segments.length)
      || left.id.localeCompare(right.id);
  });
}

function materializePreview(boardSpec, state, pieceId, moveType, segments, commonResult = null) {
  const piece = state.piecesById[pieceId];
  const lastSegment = segments[segments.length - 1];
  const firstSegment = segments[0];
  const previewId = `${pieceId}:${moveType}:${segments.map((segment) => `${segment.fromNodeId}->${segment.toNodeId}:${segment.resultValue}`).join('|')}`;
  const summary = summarizeMove(boardSpec, state, {
    pieceId,
    moveType,
    fromNodeId: firstSegment.fromNodeId,
    toNodeId: lastSegment.toNodeId,
    segments,
  });

  return {
    id: previewId,
    pieceId,
    fromNodeId: firstSegment.fromNodeId,
    toNodeId: lastSegment.toNodeId,
    moveType,
    segments,
    proofGroups: segments.map((segment) => ({
      resultValue: segment.resultValue,
      ...segment.proofGroup,
    })),
    commonResult,
    summary,
    endpointKey: lastSegment.toNodeId,
    displayLabel: `${summary.title} · ${summary.detail}`,
    destinationCode: boardSpec.nodesById[lastSegment.toNodeId].code,
  };
}

function getRayNodeIds(boardSpec, fromNodeId, directionKey) {
  const nodeIds = [];
  let currentNode = boardSpec.step(fromNodeId, directionKey);

  while (currentNode) {
    nodeIds.push(currentNode.id);
    currentNode = boardSpec.step(currentNode.id, directionKey);
  }

  return nodeIds;
}

function getSingleDirectionSegments(boardSpec, state, fromNodeId, directionKey, excludedPieceIds = new Set()) {
  const rayNodeIds = getRayNodeIds(boardSpec, fromNodeId, directionKey);
  const segments = [];
  let firstOccupiedIndex = null;
  const crossedNodeIds = [];

  for (let index = 0; index < rayNodeIds.length; index += 1) {
    const nodeId = rayNodeIds[index];
    const piece = getPieceAtNode(state, nodeId);

    if (piece && excludedPieceIds.has(piece.id)) {
      return segments;
    }

    if (piece) {
      if (firstOccupiedIndex === null) {
        firstOccupiedIndex = index;
      }

      crossedNodeIds.push(nodeId);
      continue;
    }

    if (firstOccupiedIndex === null) {
      continue;
    }

    if (index > 0 && rayNodeIds[index - 1]) {
      const priorNodeId = rayNodeIds[index - 1];
      const priorPiece = getPieceAtNode(state, priorNodeId);

      if (priorPiece && crossedNodeIds.length > 0) {
        segments.push({
          fromNodeId,
          toNodeId: nodeId,
          directionKey,
          crossedNodeIds: crossedNodeIds.slice(),
          digits: crossedNodeIds.map((crossedNodeId) => state.piecesById[state.occupancyByNode[crossedNodeId]].digit),
          crossedPieceIds: crossedNodeIds.map((crossedNodeId) => state.occupancyByNode[crossedNodeId]),
        });
      }
    }
  }

  return segments;
}

function generateShiftAndHopMoves(boardSpec, state, pieceId) {
  const piece = state.piecesById[pieceId];
  const movePreviews = [];

  for (const direction of boardSpec.directions) {
    const adjacentNode = boardSpec.step(piece.nodeId, direction.key);
    if (!adjacentNode) {
      continue;
    }

    if (!state.occupancyByNode[adjacentNode.id]) {
      movePreviews.push(materializePreview(
        boardSpec,
        state,
        pieceId,
        MOVE_TYPES.SHIFT,
        [
          buildSegment(
            boardSpec,
            state,
            piece.nodeId,
            adjacentNode.id,
            direction.key,
            [],
            null,
            { totalCount: 0, expressions: [], truncatedCount: 0 },
          ),
        ],
      ));
      continue;
    }

    const landingNode = boardSpec.step(adjacentNode.id, direction.key);
    if (!landingNode || state.occupancyByNode[landingNode.id]) {
      continue;
    }

    movePreviews.push(materializePreview(
      boardSpec,
      state,
      pieceId,
      MOVE_TYPES.HOP,
      [
        buildSegment(
          boardSpec,
          state,
          piece.nodeId,
          landingNode.id,
          direction.key,
          [adjacentNode.id],
          null,
          { totalCount: 0, expressions: [], truncatedCount: 0 },
        ),
      ],
    ));
  }

  return movePreviews;
}

function generateCrossMoves(boardSpec, solver, state, pieceId) {
  // Only arithmetic cross segments may chain. Plain hops remain single-step moves.
  const piece = state.piecesById[pieceId];
  const singleCrossPreviews = [];
  const chainCrossPreviews = [];
  const segmentCandidatesByStart = new Map();

  function getSegmentsFrom(startNodeId, excludedPieceIds = new Set()) {
    const cacheKey = `${startNodeId}:${Array.from(excludedPieceIds).sort().join(',')}`;
    if (segmentCandidatesByStart.has(cacheKey)) {
      return segmentCandidatesByStart.get(cacheKey);
    }

    const candidates = [];

    for (const direction of boardSpec.directions) {
      const directionSegments = getSingleDirectionSegments(
        boardSpec,
        state,
        startNodeId,
        direction.key,
        excludedPieceIds,
      );

      for (const rawSegment of directionSegments) {
        if (rawSegment.crossedNodeIds.length === 0) {
          continue;
        }

        const solvedValues = solver.solveDigits(rawSegment.digits);
        if (solvedValues.size === 0) {
          continue;
        }

        candidates.push({
          ...rawSegment,
          solvedValues,
        });
      }
    }

    segmentCandidatesByStart.set(cacheKey, candidates);
    return candidates;
  }

  for (const segment of getSegmentsFrom(piece.nodeId)) {
    const singleResult = segment.solvedValues.get(piece.digit);

    if (singleResult) {
      singleCrossPreviews.push(materializePreview(
        boardSpec,
        state,
        pieceId,
        MOVE_TYPES.SINGLE_CROSS,
        [
          buildSegment(
            boardSpec,
            state,
            piece.nodeId,
            segment.toNodeId,
            segment.directionKey,
            segment.crossedNodeIds,
            piece.digit,
            buildProofGroup(singleResult),
          ),
        ],
        piece.digit,
      ));
    }
  }

  function exploreChain(startNodeId, commonResult, builtSegments, usedLandingNodeIds, usedPieceIds) {
    for (const segment of getSegmentsFrom(startNodeId, usedPieceIds)) {
      if (usedLandingNodeIds.has(segment.toNodeId) || !segment.solvedValues.has(commonResult)) {
        continue;
      }

      const nextUsedPieces = new Set(usedPieceIds);
      segment.crossedPieceIds.forEach((pieceRefId) => nextUsedPieces.add(pieceRefId));

      const nextBuiltSegments = [
        ...builtSegments,
        buildSegment(
          boardSpec,
          state,
          startNodeId,
          segment.toNodeId,
          segment.directionKey,
          segment.crossedNodeIds,
          commonResult,
          buildProofGroup(segment.solvedValues.get(commonResult)),
        ),
      ];
      const nextLandingNodeIds = new Set(usedLandingNodeIds);
      nextLandingNodeIds.add(segment.toNodeId);

      if (nextBuiltSegments.length >= 2) {
        chainCrossPreviews.push(materializePreview(
          boardSpec,
          state,
          pieceId,
          MOVE_TYPES.CHAIN_CROSS,
          nextBuiltSegments,
          commonResult,
        ));
      }

      exploreChain(
        segment.toNodeId,
        commonResult,
        nextBuiltSegments,
        nextLandingNodeIds,
        nextUsedPieces,
      );
    }
  }

  for (const firstSegment of getSegmentsFrom(piece.nodeId)) {
    for (const commonResult of firstSegment.solvedValues.keys()) {
      const builtSegment = buildSegment(
        boardSpec,
        state,
        piece.nodeId,
        firstSegment.toNodeId,
        firstSegment.directionKey,
        firstSegment.crossedNodeIds,
        commonResult,
        buildProofGroup(firstSegment.solvedValues.get(commonResult)),
      );
      const usedLandingNodeIds = new Set([piece.nodeId, firstSegment.toNodeId]);
      const usedPieceIds = new Set(firstSegment.crossedPieceIds);

      exploreChain(
        firstSegment.toNodeId,
        commonResult,
        [builtSegment],
        usedLandingNodeIds,
        usedPieceIds,
      );
    }
  }

  return {
    singleCrossPreviews,
    chainCrossPreviews,
  };
}

export function createMathDuelInitialState(boardSpec) {
  const piecesById = {};
  const occupancyByNode = Object.fromEntries(boardSpec.nodes.map((node) => [node.id, null]));

  boardSpec.leftCampNodeIds.forEach((nodeId, digit) => {
    const pieceId = createPieceId(LEFT, digit);
    piecesById[pieceId] = {
      id: pieceId,
      owner: LEFT,
      digit,
      nodeId,
    };
    occupancyByNode[nodeId] = pieceId;
  });

  boardSpec.rightCampNodeIds.forEach((nodeId, digit) => {
    const pieceId = createPieceId(RIGHT, digit);
    piecesById[pieceId] = {
      id: pieceId,
      owner: RIGHT,
      digit,
      nodeId,
    };
    occupancyByNode[nodeId] = pieceId;
  });

  const baseState = {
    piecesById,
    occupancyByNode,
    currentPlayer: LEFT,
    selectedPieceId: null,
    activePreviewId: null,
    legalActionPreviews: [],
    callStopAvailableFor: [],
    isScored: false,
    scoreBreakdown: scoreMathDuelState(boardSpec, {
      piecesById,
      occupancyByNode,
    }),
    moveCount: 0,
    moveHistory: [],
  };

  return {
    ...baseState,
    callStopAvailableFor: getCallStopAvailability(boardSpec, baseState),
  };
}

export function getSelectablePieceIds(state) {
  return Object.values(state.piecesById)
    .filter((piece) => piece.owner === state.currentPlayer)
    .map((piece) => piece.id);
}

export function getActivePreview(state) {
  return state.legalActionPreviews.find((preview) => preview.id === state.activePreviewId) ?? null;
}

export function clearSelection(boardSpec, state) {
  return {
    ...state,
    selectedPieceId: null,
    activePreviewId: null,
    legalActionPreviews: [],
    scoreBreakdown: scoreMathDuelState(boardSpec, state),
  };
}

export function selectPiece(boardSpec, solver, state, pieceId) {
  if (state.isScored) {
    return state;
  }

  const piece = state.piecesById[pieceId];
  if (!piece || piece.owner !== state.currentPlayer) {
    return state;
  }

  if (state.selectedPieceId === pieceId) {
    return clearSelection(boardSpec, state);
  }

  const legalActionPreviews = getLegalActionPreviewsForPiece(boardSpec, solver, state, pieceId);

  return {
    ...state,
    selectedPieceId: pieceId,
    legalActionPreviews,
    activePreviewId: legalActionPreviews[0]?.id ?? null,
    scoreBreakdown: scoreMathDuelState(boardSpec, state),
  };
}

export function getLegalActionPreviewsForPiece(boardSpec, solver, state, pieceId) {
  const piece = state.piecesById[pieceId];
  if (!piece) {
    return [];
  }

  const shiftAndHopPreviews = generateShiftAndHopMoves(boardSpec, state, pieceId);
  const crossPreviews = generateCrossMoves(boardSpec, solver, state, pieceId);

  return sortMovePreviews(boardSpec, [
    ...shiftAndHopPreviews,
    ...crossPreviews.singleCrossPreviews,
    ...crossPreviews.chainCrossPreviews,
  ]);
}

export function getLegalActionPreviewsForPlayer(boardSpec, solver, state, player = state.currentPlayer) {
  return Object.values(state.piecesById)
    .filter((piece) => piece.owner === player)
    .flatMap((piece) => getLegalActionPreviewsForPiece(boardSpec, solver, state, piece.id));
}

export function selectPreview(boardSpec, state, previewId) {
  const preview = state.legalActionPreviews.find((item) => item.id === previewId);
  if (!preview) {
    return state;
  }

  return {
    ...state,
    activePreviewId: preview.id,
    scoreBreakdown: scoreMathDuelState(boardSpec, state),
  };
}

export function cyclePreviewForDestination(boardSpec, state) {
  const activePreview = getActivePreview(state);
  if (!activePreview) {
    return state;
  }

  const sameDestination = state.legalActionPreviews.filter((preview) => preview.toNodeId === activePreview.toNodeId);
  if (sameDestination.length <= 1) {
    return state;
  }

  const currentIndex = sameDestination.findIndex((preview) => preview.id === activePreview.id);
  const nextPreview = sameDestination[(currentIndex + 1) % sameDestination.length];

  return selectPreview(boardSpec, state, nextPreview.id);
}

export function choosePreviewByNode(boardSpec, state, nodeId) {
  const matchingPreviews = state.legalActionPreviews.filter((preview) => preview.toNodeId === nodeId);
  if (matchingPreviews.length === 0) {
    return state;
  }

  return selectPreview(boardSpec, state, matchingPreviews[0].id);
}

export function applyPreview(boardSpec, state) {
  const activePreview = getActivePreview(state);
  if (!activePreview || state.isScored) {
    return state;
  }

  const piecesById = clonePieces(state.piecesById);
  const occupancyByNode = cloneOccupancy(state.occupancyByNode);
  const piece = piecesById[activePreview.pieceId];
  const fromNode = boardSpec.nodesById[piece.nodeId];
  const toNode = boardSpec.nodesById[activePreview.toNodeId];

  occupancyByNode[piece.nodeId] = null;
  piece.nodeId = activePreview.toNodeId;
  occupancyByNode[activePreview.toNodeId] = piece.id;

  const nextState = {
    piecesById,
    occupancyByNode,
    currentPlayer: getOtherPlayer(state.currentPlayer),
    selectedPieceId: null,
    activePreviewId: null,
    legalActionPreviews: [],
    moveCount: state.moveCount + 1,
    moveHistory: [
      {
        turn: state.moveCount + 1,
        player: state.currentPlayer,
        pieceId: piece.id,
        digit: piece.digit,
        moveType: activePreview.moveType,
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
        fromCode: fromNode.code,
        toCode: toNode.code,
        segmentCount: activePreview.segments.length,
        commonResult: activePreview.commonResult,
      },
      ...state.moveHistory,
    ].slice(0, 12),
    isScored: false,
  };

  const scoreBreakdown = scoreMathDuelState(boardSpec, nextState);
  const callStopAvailableFor = getCallStopAvailability(boardSpec, nextState);

  return {
    ...nextState,
    scoreBreakdown,
    callStopAvailableFor,
  };
}

export function callStop(boardSpec, state) {
  if (state.callStopAvailableFor.length === 0) {
    return state;
  }

  return {
    ...state,
    isScored: true,
    selectedPieceId: null,
    activePreviewId: null,
    legalActionPreviews: [],
    scoreBreakdown: scoreMathDuelState(boardSpec, state),
  };
}
