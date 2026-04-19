const WIN_SCORE = 10_000_000;

export function createMinimaxAgent({
  rules,
  aiPlayer,
  depth = 2,
  maxCandidates = 10,
}) {
  const opponent = rules.getOpponent(aiPlayer);

  function evaluateTerminal(state, depthRemaining) {
    if (state.winner === aiPlayer) {
      return WIN_SCORE + (depthRemaining * 10_000);
    }

    if (state.winner === opponent) {
      return -WIN_SCORE - (depthRemaining * 10_000);
    }

    if (state.draw) {
      return 0;
    }

    return null;
  }

  function orderMoves(state, player, limit) {
    return rules.getCandidateMoves(state, player, limit);
  }

  function findForcedMove(state) {
    const attackMoves = orderMoves(state, aiPlayer, maxCandidates + 2);

    for (const move of attackMoves) {
      const preview = rules.applyMove(state, move);
      if (preview.winner === aiPlayer) {
        return move;
      }
    }

    const defenseState = {
      ...state,
      currentPlayer: opponent,
    };

    const defenseMoves = orderMoves(defenseState, opponent, maxCandidates + 4);
    const blockingMoves = [];

    for (const move of defenseMoves) {
      if (!rules.isMoveLegal(defenseState, move)) {
        continue;
      }

      const threatPreview = rules.applyMove(defenseState, move);
      if (threatPreview.winner === opponent) {
        blockingMoves.push(move);
      }
    }

    if (blockingMoves.length === 0) {
      return null;
    }

    blockingMoves.sort((left, right) => {
      const rightScore = rules.evaluateState(rules.applyMove(state, right), aiPlayer);
      const leftScore = rules.evaluateState(rules.applyMove(state, left), aiPlayer);
      return rightScore - leftScore;
    });

    return blockingMoves[0];
  }

  function alphaBeta(state, depthRemaining, alpha, beta, cache) {
    const terminalScore = evaluateTerminal(state, depthRemaining);
    if (terminalScore !== null) {
      return terminalScore;
    }

    if (depthRemaining === 0) {
      return rules.evaluateState(state, aiPlayer);
    }

    const cacheKey = `${rules.serializeState(state)}:${depthRemaining}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const maximizing = state.currentPlayer === aiPlayer;
    const currentPlayer = state.currentPlayer;
    const moves = orderMoves(state, currentPlayer, maxCandidates);

    if (moves.length === 0) {
      return rules.evaluateState(state, aiPlayer);
    }

    let bestScore = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

    for (const move of moves) {
      const nextState = rules.applyMove(state, move);
      const score = alphaBeta(nextState, depthRemaining - 1, alpha, beta, cache);

      if (maximizing) {
        bestScore = Math.max(bestScore, score);
        alpha = Math.max(alpha, bestScore);
      } else {
        bestScore = Math.min(bestScore, score);
        beta = Math.min(beta, bestScore);
      }

      if (beta <= alpha) {
        break;
      }
    }

    cache.set(cacheKey, bestScore);
    return bestScore;
  }

  function chooseMove(state) {
    const forcedMove = findForcedMove(state);
    if (forcedMove) {
      return forcedMove;
    }

    const candidates = orderMoves(state, aiPlayer, maxCandidates + 2);
    if (candidates.length === 0) {
      return null;
    }

    const cache = new Map();
    let bestMove = candidates[0];
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const move of candidates) {
      const nextState = rules.applyMove(state, move);
      const score = alphaBeta(
        nextState,
        depth - 1,
        Number.NEGATIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        cache,
      );

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  return {
    chooseMove,
  };
}
