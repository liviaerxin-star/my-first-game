import { LEFT, MOVE_TYPES, RIGHT } from './constants.js';
import { applyPreview, getLegalActionPreviewsForPlayer } from './rules.js';

const MOVE_TYPE_WEIGHTS = {
  [MOVE_TYPES.SHIFT]: 4,
  [MOVE_TYPES.HOP]: 10,
  [MOVE_TYPES.SINGLE_CROSS]: 18,
  [MOVE_TYPES.CHAIN_CROSS]: 28,
};

function getOtherPlayer(player) {
  return player === LEFT ? RIGHT : LEFT;
}

function getProgressDelta(boardSpec, preview, player) {
  const fromNode = boardSpec.nodesById[preview.fromNodeId];
  const toNode = boardSpec.nodesById[preview.toNodeId];
  return player === LEFT
    ? toNode.latticeX - fromNode.latticeX
    : fromNode.latticeX - toNode.latticeX;
}

function countTargetCampPieces(boardSpec, state, player) {
  const targetNodeIds = new Set(boardSpec.getTargetCampNodeIdsFor(player));
  return Object.values(state.piecesById)
    .filter((piece) => piece.owner === player && targetNodeIds.has(piece.nodeId))
    .length;
}

function formatLanding(node, i18n) {
  return i18n.nodeLabel(node.visibleLabel);
}

function buildReasonList(boardSpec, state, preview, nextState, player, i18n) {
  const piece = state.piecesById[preview.pieceId];
  const fromNode = boardSpec.nodesById[preview.fromNodeId];
  const toNode = boardSpec.nodesById[preview.toNodeId];
  const currentScores = state.scoreBreakdown.players;
  const nextScores = nextState.scoreBreakdown.players;
  const otherPlayer = getOtherPlayer(player);
  const progressDelta = getProgressDelta(boardSpec, preview, player);
  const ownScoreGain = nextScores[player].totalScore - currentScores[player].totalScore;
  const otherScoreDelta = nextScores[otherPlayer].totalScore - currentScores[otherPlayer].totalScore;
  const targetGain = countTargetCampPieces(boardSpec, nextState, player) - countTargetCampPieces(boardSpec, state, player);
  const reasons = [];

  if (targetGain > 0) {
    reasons.push(i18n.t('strategy.advanceCamp'));
  }

  if (progressDelta > 0) {
    reasons.push(i18n.t('strategy.advanceLayers', { value: progressDelta }));
  }

  if (ownScoreGain > 0) {
    reasons.push(i18n.t('strategy.ownScoreGain', { value: ownScoreGain }));
  }

  if (otherScoreDelta < 0) {
    reasons.push(i18n.t('strategy.enemyScoreDrop', { value: Math.abs(otherScoreDelta) }));
  }

  if (preview.moveType === MOVE_TYPES.CHAIN_CROSS) {
    reasons.push(i18n.t('strategy.chainResult', { value: preview.commonResult }));
  } else if (preview.moveType === MOVE_TYPES.SINGLE_CROSS) {
    reasons.push(i18n.t('strategy.singleResult', { digit: piece.digit }));
  } else if (preview.moveType === MOVE_TYPES.HOP) {
    reasons.push(i18n.t('strategy.singleHop'));
  } else {
    reasons.push(i18n.t('strategy.openLane'));
  }

  if (Number.isInteger(toNode.visibleLabel)) {
    reasons.push(i18n.t('strategy.landingSpot', { landing: formatLanding(toNode, i18n) }));
  } else if (!Number.isInteger(fromNode.visibleLabel)) {
    reasons.push(i18n.t('strategy.keepFlex'));
  }

  return reasons.slice(0, 3);
}

function scorePlan(boardSpec, state, preview, nextState, player) {
  const currentScores = state.scoreBreakdown.players;
  const nextScores = nextState.scoreBreakdown.players;
  const otherPlayer = getOtherPlayer(player);
  const progressDelta = getProgressDelta(boardSpec, preview, player);
  const ownScoreGain = nextScores[player].totalScore - currentScores[player].totalScore;
  const otherScoreDelta = nextScores[otherPlayer].totalScore - currentScores[otherPlayer].totalScore;
  const targetGain = countTargetCampPieces(boardSpec, nextState, player) - countTargetCampPieces(boardSpec, state, player);

  return (
    (targetGain * 120)
    + (ownScoreGain * 12)
    - (otherScoreDelta * 7)
    + (progressDelta * 9)
    + (MOVE_TYPE_WEIGHTS[preview.moveType] ?? 0)
    + (preview.segments.length * 3)
    + (preview.commonResult ?? 0)
  );
}

export function getRankedActionPlans(boardSpec, solver, state, player = state.currentPlayer, i18n) {
  const previews = getLegalActionPreviewsForPlayer(boardSpec, solver, state, player);

  return previews
    .map((preview) => {
      const nextState = applyPreview(boardSpec, {
        ...state,
        currentPlayer: player,
        selectedPieceId: preview.pieceId,
        activePreviewId: preview.id,
        legalActionPreviews: [preview],
        isScored: false,
      });
      const piece = state.piecesById[preview.pieceId];
      const toNode = boardSpec.nodesById[preview.toNodeId];
      const reasons = buildReasonList(boardSpec, state, preview, nextState, player, i18n);

      return {
        preview,
        piece,
        score: scorePlan(boardSpec, state, preview, nextState, player),
        reasons,
        title: `${i18n.pieceLabel(piece.digit)} · ${i18n.moveTypeLabel(preview.moveType)}`,
        summary: i18n.t('preview.summary', {
          landing: formatLanding(toNode, i18n),
          primaryReason: reasons[0],
        }),
      };
    })
    .sort((left, right) => right.score - left.score || left.preview.id.localeCompare(right.preview.id));
}
