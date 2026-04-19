import { AI, HUMAN, PLAYER_LABELS } from './constants.js';

export function moveToCoord(move) {
  return `${String.fromCharCode(65 + move.x)}${move.y + 1}`;
}

export function formatPlayer(player) {
  return PLAYER_LABELS[player] ?? '未知';
}

export function formatTurn(state, aiThinking) {
  if (state.winner === HUMAN) {
    return '你赢了';
  }

  if (state.winner === AI) {
    return 'AI 胜';
  }

  if (state.draw) {
    return '平局';
  }

  if (aiThinking) {
    return 'AI 思考中';
  }

  return state.currentPlayer === HUMAN ? '你落子' : 'AI 落子';
}
