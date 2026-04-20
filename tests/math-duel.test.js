import test from 'node:test';
import assert from 'node:assert/strict';

import { createMathDuelBoardSpec } from '../src/game/math-duel/board-spec.js';
import { LEFT, MOVE_TYPES, RIGHT } from '../src/game/math-duel/constants.js';
import { createExpressionSolver } from '../src/game/math-duel/expression-solver.js';
import {
  applyPreview,
  createMathDuelInitialState,
  getCallStopAvailability,
  scoreMathDuelState,
  selectPiece,
} from '../src/game/math-duel/rules.js';

function createEmptyState(boardSpec) {
  return {
    piecesById: {},
    occupancyByNode: Object.fromEntries(boardSpec.nodes.map((node) => [node.id, null])),
    currentPlayer: LEFT,
    selectedPieceId: null,
    activePreviewId: null,
    legalActionPreviews: [],
    callStopAvailableFor: [],
    isScored: false,
    scoreBreakdown: scoreMathDuelState(boardSpec, {
      piecesById: {},
      occupancyByNode: Object.fromEntries(boardSpec.nodes.map((node) => [node.id, null])),
    }),
    moveCount: 0,
    moveHistory: [],
  };
}

function placePiece(state, owner, digit, nodeId, suffix = '') {
  const pieceId = `${owner}-${digit}${suffix}`;
  state.piecesById[pieceId] = {
    id: pieceId,
    owner,
    digit,
    nodeId,
  };
  state.occupancyByNode[nodeId] = pieceId;
  return pieceId;
}

test('initial state places both camps in fixed 0-9 order', () => {
  const boardSpec = createMathDuelBoardSpec();
  const state = createMathDuelInitialState(boardSpec);

  assert.equal(boardSpec.leftCampNodeIds.length, 10);
  assert.equal(boardSpec.rightCampNodeIds.length, 10);
  assert.equal(state.piecesById['left-0'].nodeId, boardSpec.getNodeAt(0, 10).id);
  assert.equal(state.piecesById['left-9'].nodeId, boardSpec.getNodeAt(1, 11).id);
  assert.equal(state.piecesById['right-0'].nodeId, boardSpec.getNodeAt(14, 10).id);
  assert.equal(state.piecesById['right-9'].nodeId, boardSpec.getNodeAt(13, 9).id);
});

test('expression solver keeps only non-negative integer results', () => {
  const solver = createExpressionSolver();
  const solved = solver.solveDigits([2, 3]);

  assert.deepEqual(solved.get(5)?.expressions, ['(2 + 3)']);
  assert.deepEqual(solved.get(6)?.expressions, ['(2 * 3)']);
  assert.equal(solved.get(1.5), undefined);
  assert.equal(solved.get(-1), undefined);
});

test('single cross requires all crossed digits and can be applied', () => {
  const boardSpec = createMathDuelBoardSpec();
  const solver = createExpressionSolver();
  const state = createEmptyState(boardSpec);
  const startNode = boardSpec.getNodeAt(4, 8);
  const firstCrossedNode = boardSpec.getNodeAt(5, 9);
  const secondCrossedNode = boardSpec.getNodeAt(6, 10);
  const landingNode = boardSpec.getNodeAt(7, 11);

  placePiece(state, LEFT, 5, startNode.id);
  placePiece(state, RIGHT, 2, firstCrossedNode.id, '-a');
  placePiece(state, RIGHT, 3, secondCrossedNode.id, '-b');
  state.scoreBreakdown = scoreMathDuelState(boardSpec, state);

  const selected = selectPiece(boardSpec, solver, state, 'left-5');
  const singleCross = selected.legalActionPreviews.find(
    (preview) => preview.moveType === MOVE_TYPES.SINGLE_CROSS && preview.toNodeId === landingNode.id,
  );

  assert.ok(singleCross, 'expected a single cross preview');
  assert.equal(singleCross.segments.length, 1);
  assert.deepEqual(singleCross.segments[0].digits, [2, 3]);
  assert.ok(singleCross.segments[0].proofGroup.expressions.includes('(2 + 3)'));

  const executed = applyPreview(boardSpec, {
    ...selected,
    activePreviewId: singleCross.id,
  });

  assert.equal(executed.piecesById['left-5'].nodeId, landingNode.id);
  assert.equal(executed.currentPlayer, RIGHT);
});

test('chain cross can reuse a common result across multiple segments', () => {
  const boardSpec = createMathDuelBoardSpec();
  const solver = createExpressionSolver();
  const state = createEmptyState(boardSpec);

  placePiece(state, LEFT, 9, boardSpec.getNodeAt(4, 8).id);
  placePiece(state, RIGHT, 2, boardSpec.getNodeAt(5, 9).id, '-a');
  placePiece(state, RIGHT, 3, boardSpec.getNodeAt(6, 10).id, '-b');
  placePiece(state, RIGHT, 1, boardSpec.getNodeAt(8, 12).id, '-c');
  placePiece(state, RIGHT, 4, boardSpec.getNodeAt(9, 13).id, '-d');
  state.scoreBreakdown = scoreMathDuelState(boardSpec, state);

  const selected = selectPiece(boardSpec, solver, state, 'left-9');
  const chainCross = selected.legalActionPreviews.find(
    (preview) => preview.moveType === MOVE_TYPES.CHAIN_CROSS && preview.toNodeId === boardSpec.getNodeAt(10, 14).id,
  );

  assert.ok(chainCross, 'expected a chain cross preview');
  assert.equal(chainCross.commonResult, 5);
  assert.equal(chainCross.segments.length, 2);
  assert.deepEqual(chainCross.segments.map((segment) => segment.resultValue), [5, 5]);
});

test('call stop becomes available when all ten pieces occupy the target camp', () => {
  const boardSpec = createMathDuelBoardSpec();
  const state = createEmptyState(boardSpec);
  const publicNodeIds = boardSpec.nodes
    .filter((node) => node.region === 'public')
    .slice(0, 10)
    .map((node) => node.id);

  boardSpec.rightCampNodeIds.forEach((nodeId, digit) => {
    placePiece(state, LEFT, digit, nodeId);
  });
  publicNodeIds.forEach((nodeId, digit) => {
    placePiece(state, RIGHT, digit, nodeId);
  });

  const availability = getCallStopAvailability(boardSpec, state);
  const scores = scoreMathDuelState(boardSpec, state);

  assert.deepEqual(availability, [LEFT]);
  assert.equal(scores.players[LEFT].totalScore, 0);
});
