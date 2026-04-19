import { AI, DIRECTIONS, EMPTY, HUMAN } from '../core/constants.js';

const WIN_SCORE = 10_000_000;

export function createGomokuRules({ boardSize, winLength }) {
  const cellCount = boardSize * boardSize;
  const center = Math.floor(boardSize / 2);

  function getIndex(x, y) {
    return (y * boardSize) + x;
  }

  function isInBounds(x, y) {
    return x >= 0 && x < boardSize && y >= 0 && y < boardSize;
  }

  function getCell(board, x, y) {
    return board[getIndex(x, y)];
  }

  function getOpponent(player) {
    return player === HUMAN ? AI : HUMAN;
  }

  function createInitialState({ aiStarts = false } = {}) {
    return {
      board: Array.from({ length: cellCount }, () => EMPTY),
      currentPlayer: aiStarts ? AI : HUMAN,
      winner: null,
      winningCells: [],
      draw: false,
      lastMove: null,
      moveCount: 0,
      history: [],
    };
  }

  function isMoveLegal(state, move) {
    if (!move || state.winner || state.draw) {
      return false;
    }

    if (!isInBounds(move.x, move.y)) {
      return false;
    }

    return getCell(state.board, move.x, move.y) === EMPTY;
  }

  function collectLine(board, x, y, dx, dy, player) {
    const cells = [];
    let nextX = x + dx;
    let nextY = y + dy;

    while (isInBounds(nextX, nextY) && getCell(board, nextX, nextY) === player) {
      cells.push({ x: nextX, y: nextY });
      nextX += dx;
      nextY += dy;
    }

    return cells;
  }

  function getWinningCells(board, x, y, player) {
    for (const [dx, dy] of DIRECTIONS) {
      const backward = collectLine(board, x, y, -dx, -dy, player).reverse();
      const forward = collectLine(board, x, y, dx, dy, player);
      const line = [...backward, { x, y }, ...forward];

      if (line.length >= winLength) {
        return line;
      }
    }

    return [];
  }

  function applyMove(state, move) {
    if (!isMoveLegal(state, move)) {
      throw new Error(`Illegal move at ${move.x},${move.y}`);
    }

    const board = state.board.slice();
    const player = state.currentPlayer;
    board[getIndex(move.x, move.y)] = player;

    const winningCells = getWinningCells(board, move.x, move.y, player);
    const winner = winningCells.length > 0 ? player : null;
    const draw = !winner && state.moveCount + 1 >= cellCount;
    const nextPlayer = winner || draw ? player : getOpponent(player);
    const historyEntry = { ...move, player };

    return {
      ...state,
      board,
      currentPlayer: nextPlayer,
      winner,
      winningCells,
      draw,
      lastMove: historyEntry,
      moveCount: state.moveCount + 1,
      history: [...state.history, historyEntry],
    };
  }

  function scorePattern(length, openEnds) {
    if (length >= winLength) {
      return WIN_SCORE;
    }

    if (openEnds === 0) {
      return 0;
    }

    const remaining = winLength - length;

    if (remaining === 1) {
      return openEnds === 2 ? 220_000 : 44_000;
    }

    if (remaining === 2) {
      return openEnds === 2 ? 24_000 : 3_800;
    }

    if (remaining === 3) {
      return openEnds === 2 ? 2_400 : 320;
    }

    return openEnds === 2 ? 140 : 24;
  }

  function measurePlacement(board, x, y, dx, dy, player) {
    let length = 1;
    let openEnds = 0;

    let nextX = x + dx;
    let nextY = y + dy;
    while (isInBounds(nextX, nextY) && getCell(board, nextX, nextY) === player) {
      length += 1;
      nextX += dx;
      nextY += dy;
    }
    if (isInBounds(nextX, nextY) && getCell(board, nextX, nextY) === EMPTY) {
      openEnds += 1;
    }

    nextX = x - dx;
    nextY = y - dy;
    while (isInBounds(nextX, nextY) && getCell(board, nextX, nextY) === player) {
      length += 1;
      nextX -= dx;
      nextY -= dy;
    }
    if (isInBounds(nextX, nextY) && getCell(board, nextX, nextY) === EMPTY) {
      openEnds += 1;
    }

    return { length, openEnds };
  }

  function scorePlacement(board, x, y, player) {
    if (getCell(board, x, y) !== EMPTY) {
      return Number.NEGATIVE_INFINITY;
    }

    let score = 0;

    for (const [dx, dy] of DIRECTIONS) {
      const { length, openEnds } = measurePlacement(board, x, y, dx, dy, player);
      score += scorePattern(length, openEnds);
    }

    const centerDistance = Math.abs(x - center) + Math.abs(y - center);
    score += Math.max(0, 10 - centerDistance);

    return score;
  }

  function scanBoard(board, player) {
    let score = 0;

    for (let y = 0; y < boardSize; y += 1) {
      for (let x = 0; x < boardSize; x += 1) {
        if (getCell(board, x, y) !== player) {
          continue;
        }

        for (const [dx, dy] of DIRECTIONS) {
          const prevX = x - dx;
          const prevY = y - dy;

          if (isInBounds(prevX, prevY) && getCell(board, prevX, prevY) === player) {
            continue;
          }

          let length = 0;
          let nextX = x;
          let nextY = y;

          while (isInBounds(nextX, nextY) && getCell(board, nextX, nextY) === player) {
            length += 1;
            nextX += dx;
            nextY += dy;
          }

          let openEnds = 0;
          if (isInBounds(nextX, nextY) && getCell(board, nextX, nextY) === EMPTY) {
            openEnds += 1;
          }
          if (isInBounds(prevX, prevY) && getCell(board, prevX, prevY) === EMPTY) {
            openEnds += 1;
          }

          score += scorePattern(length, openEnds);
        }
      }
    }

    return score;
  }

  function evaluateState(state, perspectivePlayer) {
    if (state.winner) {
      return state.winner === perspectivePlayer ? WIN_SCORE : -WIN_SCORE;
    }

    if (state.draw) {
      return 0;
    }

    const ownScore = scanBoard(state.board, perspectivePlayer);
    const opponentScore = scanBoard(state.board, getOpponent(perspectivePlayer));

    return ownScore - (opponentScore * 1.08);
  }

  function getCandidateMoves(state, player, limit = 12) {
    if (state.moveCount === 0) {
      return [{ x: center, y: center }];
    }

    const candidates = new Map();

    for (let y = 0; y < boardSize; y += 1) {
      for (let x = 0; x < boardSize; x += 1) {
        if (getCell(state.board, x, y) === EMPTY) {
          continue;
        }

        for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
          for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
            const nextX = x + offsetX;
            const nextY = y + offsetY;

            if (!isInBounds(nextX, nextY) || getCell(state.board, nextX, nextY) !== EMPTY) {
              continue;
            }

            candidates.set(`${nextX}:${nextY}`, { x: nextX, y: nextY });
          }
        }
      }
    }

    const scoredMoves = Array.from(candidates.values())
      .map((move) => {
        const attackScore = scorePlacement(state.board, move.x, move.y, player);
        const defenseScore = scorePlacement(state.board, move.x, move.y, getOpponent(player));

        return {
          ...move,
          score: (attackScore * 1.15) + (defenseScore * 0.92),
        };
      })
      .sort((left, right) => right.score - left.score);

    return scoredMoves.slice(0, limit).map(({ x, y }) => ({ x, y }));
  }

  function serializeState(state) {
    return `${state.currentPlayer}:${state.board.join('')}`;
  }

  return {
    name: 'gomoku',
    boardSize,
    winLength,
    createInitialState,
    isMoveLegal,
    applyMove,
    evaluateState,
    getCandidateMoves,
    getOpponent,
    serializeState,
  };
}
