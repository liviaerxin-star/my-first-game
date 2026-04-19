import Phaser from 'phaser';
import { AI, HUMAN } from './core/constants.js';
import { formatPlayer, formatTurn, moveToCoord } from './core/formatters.js';
import { createMinimaxAgent } from './ai/minimax-agent.js';
import { createGomokuRules } from './rules/gomoku-rules.js';
import { createPhaserConfig, GomokuScene } from './rendering/gomoku-scene.js';

const DEFAULT_CONFIG = {
  boardSize: 9,
  winLength: 5,
  searchDepth: 2,
  aiStarts: false,
};

export class AppController {
  constructor(root) {
    this.root = root;
    this.config = { ...DEFAULT_CONFIG };
    this.aiThinking = false;
    this.aiTimer = null;

    this.cacheElements();
    this.createBoard();
    this.bindEvents();
    this.startNewGame();
  }

  cacheElements() {
    this.elements = {
      boardSize: this.root.querySelector('#board-size'),
      winLength: this.root.querySelector('#win-length'),
      searchDepth: this.root.querySelector('#search-depth'),
      aiStarts: this.root.querySelector('#ai-starts'),
      restartButton: this.root.querySelector('#restart-button'),
      swapOrderButton: this.root.querySelector('#swap-order-button'),
      turnPill: this.root.querySelector('#turn-pill'),
      statusText: this.root.querySelector('#status-text'),
      detailText: this.root.querySelector('#detail-text'),
      metricRule: this.root.querySelector('#metric-rule'),
      metricTurn: this.root.querySelector('#metric-turn'),
      metricSearch: this.root.querySelector('#metric-search'),
      metricMoves: this.root.querySelector('#metric-moves'),
      moveList: this.root.querySelector('#move-list'),
      phaserHost: this.root.querySelector('#phaser-host'),
    };
  }

  createBoard() {
    this.scene = new GomokuScene({
      onCellSelected: (move) => this.handleHumanMove(move),
    });

    const config = createPhaserConfig(this.elements.phaserHost);
    config.scene = [this.scene];
    this.game = new Phaser.Game(config);
  }

  bindEvents() {
    const restartFromControls = () => {
      this.startNewGame(this.readConfigFromControls());
    };

    this.elements.boardSize.addEventListener('change', restartFromControls);
    this.elements.winLength.addEventListener('change', restartFromControls);
    this.elements.searchDepth.addEventListener('change', restartFromControls);
    this.elements.aiStarts.addEventListener('change', restartFromControls);

    this.elements.restartButton.addEventListener('click', () => {
      this.startNewGame();
    });

    this.elements.swapOrderButton.addEventListener('click', () => {
      this.startNewGame({
        aiStarts: !this.config.aiStarts,
      });
    });
  }

  readConfigFromControls() {
    return {
      boardSize: Number(this.elements.boardSize.value),
      winLength: Number(this.elements.winLength.value),
      searchDepth: Number(this.elements.searchDepth.value),
      aiStarts: this.elements.aiStarts.checked,
    };
  }

  syncControls() {
    this.elements.boardSize.value = String(this.config.boardSize);
    this.elements.winLength.value = String(this.config.winLength);
    this.elements.searchDepth.value = String(this.config.searchDepth);
    this.elements.aiStarts.checked = this.config.aiStarts;
  }

  getCandidateLimit() {
    if (this.config.searchDepth >= 3) {
      return this.config.boardSize >= 13 ? 7 : 9;
    }

    if (this.config.boardSize >= 13) {
      return 8;
    }

    return 12;
  }

  buildGameModules() {
    this.rules = createGomokuRules({
      boardSize: this.config.boardSize,
      winLength: this.config.winLength,
    });

    this.agent = createMinimaxAgent({
      rules: this.rules,
      aiPlayer: AI,
      depth: this.config.searchDepth,
      maxCandidates: this.getCandidateLimit(),
    });
  }

  clearAiTimer() {
    if (this.aiTimer) {
      window.clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
  }

  startNewGame(overrides = {}) {
    this.clearAiTimer();
    this.aiThinking = false;
    this.config = {
      ...this.config,
      ...this.readConfigFromControls(),
      ...overrides,
    };
    this.syncControls();
    this.buildGameModules();
    this.state = this.rules.createInitialState({
      aiStarts: this.config.aiStarts,
    });
    this.refreshView();

    if (this.state.currentPlayer === AI) {
      this.queueAiMove();
    }
  }

  isGameOver() {
    return Boolean(this.state.winner || this.state.draw);
  }

  handleHumanMove(move) {
    if (this.aiThinking || this.isGameOver() || this.state.currentPlayer !== HUMAN) {
      return;
    }

    if (!this.rules.isMoveLegal(this.state, move)) {
      return;
    }

    this.state = this.rules.applyMove(this.state, move);
    this.refreshView();

    if (!this.isGameOver()) {
      this.queueAiMove();
    }
  }

  queueAiMove() {
    this.clearAiTimer();
    this.aiThinking = true;
    this.refreshView();

    this.aiTimer = window.setTimeout(() => {
      const move = this.agent.chooseMove(this.state);
      this.aiThinking = false;
      this.aiTimer = null;

      if (!move || !this.rules.isMoveLegal(this.state, move)) {
        this.refreshView();
        return;
      }

      this.state = this.rules.applyMove(this.state, move);
      this.refreshView();
    }, 180);
  }

  updateHeader() {
    const pill = this.elements.turnPill;
    pill.className = 'turn-pill';

    if (this.state.winner || this.state.draw) {
      pill.classList.add('is-ended');
    } else if (this.aiThinking || this.state.currentPlayer === AI) {
      pill.classList.add('is-ai');
    } else {
      pill.classList.add('is-human');
    }

    pill.textContent = formatTurn(this.state, this.aiThinking);
  }

  updateSummary() {
    const statusText = this.getStatusText();
    const detailText = `${this.config.boardSize}x${this.config.boardSize} / 连 ${this.config.winLength} / 候选步 ${this.getCandidateLimit()}`;

    this.elements.statusText.textContent = statusText;
    this.elements.detailText.textContent = detailText;
    this.elements.metricRule.textContent = `${this.config.boardSize}x${this.config.boardSize} · 连 ${this.config.winLength}`;
    this.elements.metricTurn.textContent = formatTurn(this.state, this.aiThinking);
    this.elements.metricSearch.textContent = `深度 ${this.config.searchDepth}`;
    this.elements.metricMoves.textContent = `${this.state.moveCount} 手`;
  }

  updateMoveList() {
    const history = this.state.history.slice(-8).reverse();

    if (history.length === 0) {
      this.elements.moveList.innerHTML = '<li class="move-item-empty">等待第一手落子</li>';
      return;
    }

    this.elements.moveList.innerHTML = history
      .map((move, index) => {
        const moveNumber = this.state.history.length - index;
        return `
          <li class="move-item">
            <strong>#${moveNumber} ${formatPlayer(move.player)}</strong>
            <span>${moveToCoord(move)}</span>
          </li>
        `;
      })
      .join('');
  }

  getStatusText() {
    if (this.state.winner === HUMAN) {
      return '你赢了，这一局已经把 AI 压住了。';
    }

    if (this.state.winner === AI) {
      return 'AI 赢了，可以直接复盘最后几手。';
    }

    if (this.state.draw) {
      return '平局，棋盘已经填满。';
    }

    if (this.aiThinking) {
      return 'AI 正在搜索局面，当前会优先检查必胜手和必防手。';
    }

    if (this.state.currentPlayer === HUMAN) {
      return '你的回合，点击棋盘交叉点落子。';
    }

    return 'AI 回合。';
  }

  refreshView() {
    this.updateHeader();
    this.updateSummary();
    this.updateMoveList();

    this.scene.setInteractionEnabled(!this.aiThinking && !this.isGameOver() && this.state.currentPlayer === HUMAN);
    this.scene.setViewModel({
      boardSize: this.config.boardSize,
      board: this.state.board,
      lastMove: this.state.lastMove,
      winningCells: this.state.winningCells,
    });
  }
}
