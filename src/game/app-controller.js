import Phaser from 'phaser';
import { LEFT, RIGHT } from './math-duel/constants.js';
import { createExpressionSolver } from './math-duel/expression-solver.js';
import { createI18n, DEFAULT_LANGUAGE } from './i18n.js';
import { createMathDuelBoardSpec } from './math-duel/board-spec.js';
import { getRankedActionPlans } from './math-duel/strategy.js';
import {
  applyPreview,
  callStop,
  choosePreviewByNode,
  clearSelection,
  createMathDuelInitialState,
  cyclePreviewForDestination,
  getActivePreview,
  selectPiece,
  selectPreview,
} from './math-duel/rules.js';
import { createPhaserConfig, MathDuelScene } from './rendering/math-duel-scene.js';

function escapeHtml(value) {
  return `${value}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatScoreValue(score) {
  return score === null ? '-' : `${score}`;
}

export class AppController {
  constructor(root) {
    this.root = root;
    this.language = DEFAULT_LANGUAGE;
    this.i18n = createI18n(this.language);
    this.boardSpec = createMathDuelBoardSpec();
    this.solver = createExpressionSolver();
    this.aiThinking = false;
    this.aiTimer = null;
    this.recommendedPlans = [];
    this.recommendedPlanById = new Map();
    this.lastComputerPlan = null;

    this.cacheElements();
    this.renderStaticText();
    this.createBoard();
    this.bindEvents();
    this.restartGame();
  }

  cacheElements() {
    this.elements = {
      heroEyebrow: this.root.querySelector('#hero-eyebrow'),
      heroTitle: this.root.querySelector('#hero-title'),
      heroCopy: this.root.querySelector('#hero-copy'),
      boardLabel: this.root.querySelector('#board-label'),
      boardTitle: this.root.querySelector('#board-title'),
      overviewTitle: this.root.querySelector('#overview-title'),
      overviewBody: this.root.querySelector('#overview-body'),
      metricTurnLabel: this.root.querySelector('#metric-turn-label'),
      metricMovesLabel: this.root.querySelector('#metric-moves-label'),
      metricLeftScoreLabel: this.root.querySelector('#metric-left-score-label'),
      metricRightScoreLabel: this.root.querySelector('#metric-right-score-label'),
      suggestionTitle: this.root.querySelector('#suggestion-title'),
      suggestionBody: this.root.querySelector('#suggestion-body'),
      historyTitle: this.root.querySelector('#history-title'),
      historyBody: this.root.querySelector('#history-body'),
      scoreTitle: this.root.querySelector('#score-title'),
      scoreBody: this.root.querySelector('#score-body'),
      languagePicker: this.root.querySelector('#language-picker'),
      languageButtons: Array.from(this.root.querySelectorAll('[data-language]')),
      turnPill: this.root.querySelector('#turn-pill'),
      statusText: this.root.querySelector('#status-text'),
      detailText: this.root.querySelector('#detail-text'),
      metricTurn: this.root.querySelector('#metric-turn'),
      metricMoves: this.root.querySelector('#metric-moves'),
      metricLeftScore: this.root.querySelector('#metric-left-score'),
      metricRightScore: this.root.querySelector('#metric-right-score'),
      selectionSummary: this.root.querySelector('#selection-summary'),
      previewList: this.root.querySelector('#preview-list'),
      previewDetail: this.root.querySelector('#preview-detail'),
      moveList: this.root.querySelector('#move-list'),
      scoreboard: this.root.querySelector('#scoreboard'),
      restartButton: this.root.querySelector('#restart-button'),
      clearSelectionButton: this.root.querySelector('#clear-selection-button'),
      executeButton: this.root.querySelector('#execute-button'),
      cyclePreviewButton: this.root.querySelector('#cycle-preview-button'),
      callStopButton: this.root.querySelector('#call-stop-button'),
      phaserHost: this.root.querySelector('#phaser-host'),
    };
  }

  createBoard() {
    this.scene = new MathDuelScene({
      onNodeSelected: (nodeId) => this.handleNodeSelection(nodeId),
    });

    const config = createPhaserConfig(this.elements.phaserHost);
    config.scene = [this.scene];
    this.game = new Phaser.Game(config);
  }

  bindEvents() {
    this.elements.restartButton.addEventListener('click', () => this.restartGame());
    this.elements.clearSelectionButton.addEventListener('click', () => {
      this.state = clearSelection(this.boardSpec, this.state);
      this.refreshView();
    });
    this.elements.executeButton.addEventListener('click', () => {
      this.state = applyPreview(this.boardSpec, this.state);
      this.refreshView();
    });
    this.elements.cyclePreviewButton.addEventListener('click', () => {
      this.state = cyclePreviewForDestination(this.boardSpec, this.state);
      this.refreshView();
    });
    this.elements.callStopButton.addEventListener('click', () => {
      this.state = callStop(this.boardSpec, this.state);
      this.refreshView();
    });
    this.elements.previewList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-preview-id]');
      if (!button) {
        return;
      }
      this.handlePreviewSelection(button.dataset.previewId);
    });
    this.elements.languageButtons.forEach((button) => {
      button.addEventListener('click', () => this.setLanguage(button.dataset.language));
    });
  }

  setLanguage(language) {
    if (language === this.language) {
      return;
    }

    this.language = language;
    this.i18n = createI18n(language);
    if (this.aiThinking) {
      this.lastComputerPlan = this.getComputerPlanPreview();
    }
    this.renderStaticText();
    this.refreshView();
  }

  renderStaticText() {
    const { t } = this.i18n;

    document.title = t('ui.heroTitle');
    this.elements.heroEyebrow.textContent = t('ui.eyebrow');
    this.elements.heroTitle.textContent = t('ui.heroTitle');
    this.elements.heroCopy.textContent = t('ui.heroCopy');
    this.elements.boardLabel.textContent = t('ui.boardLabel');
    this.elements.boardTitle.textContent = t('ui.boardTitle');
    this.elements.overviewTitle.textContent = t('ui.overview.title');
    this.elements.overviewBody.textContent = t('ui.overview.body');
    this.elements.metricTurnLabel.textContent = t('ui.metric.turn');
    this.elements.metricMovesLabel.textContent = t('ui.metric.moves');
    this.elements.metricLeftScoreLabel.textContent = t('ui.metric.blueScore');
    this.elements.metricRightScoreLabel.textContent = t('ui.metric.redScore');
    this.elements.suggestionTitle.textContent = t('ui.suggestion.title');
    this.elements.suggestionBody.textContent = t('ui.suggestion.body');
    this.elements.historyTitle.textContent = t('ui.history.title');
    this.elements.historyBody.textContent = t('ui.history.body');
    this.elements.scoreTitle.textContent = t('ui.score.title');
    this.elements.scoreBody.textContent = t('ui.score.body');
    this.elements.restartButton.textContent = t('ui.button.restart');
    this.elements.clearSelectionButton.textContent = t('ui.button.clear');
    this.elements.executeButton.textContent = t('ui.button.execute');
    this.elements.cyclePreviewButton.textContent = t('ui.button.cycle');
    this.elements.turnPill.textContent = t('ui.turn.ready');
    this.elements.phaserHost.setAttribute('aria-label', t('ui.boardAria'));
    this.elements.languagePicker.setAttribute('aria-label', t('ui.languageAria'));
    this.elements.languageButtons.forEach((button) => {
      const isActive = button.dataset.language === this.language;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', `${isActive}`);
    });
  }

  clearAiTimer() {
    if (this.aiTimer) {
      window.clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
  }

  isComputerTurn() {
    return !this.state.isScored && this.state.currentPlayer === LEFT;
  }

  playerLabel(player) {
    return this.i18n.playerLabel(player);
  }

  moveTypeLabel(moveType) {
    return this.i18n.moveTypeLabel(moveType);
  }

  nodeLabel(label) {
    return this.i18n.nodeLabel(label);
  }

  pieceLabel(digit) {
    return this.i18n.pieceLabel(digit);
  }

  getComputerPlanPreview() {
    const plans = getRankedActionPlans(this.boardSpec, this.solver, this.state, LEFT, this.i18n);
    return plans[0] ?? null;
  }

  getPlanForPreview(previewId) {
    return this.recommendedPlanById.get(previewId) ?? null;
  }

  getPreviewDestinationLabel(preview) {
    return this.nodeLabel(this.boardSpec.nodesById[preview.toNodeId].visibleLabel);
  }

  getPreviewHeadline(preview) {
    const piece = this.state.piecesById[preview.pieceId];
    return `${this.pieceLabel(piece.digit)} · ${this.moveTypeLabel(preview.moveType)}`;
  }

  getPreviewDetail(preview) {
    const plan = this.getPlanForPreview(preview.id);
    const detailParts = [this.getPreviewDestinationLabel(preview)];

    if (preview.commonResult !== null) {
      detailParts.push(this.i18n.t('preview.result', { value: preview.commonResult }));
    }

    if (plan?.reasons?.[0]) {
      detailParts.push(plan.reasons[0]);
    }

    return this.i18n.join(detailParts);
  }

  getDisplayedPreviews() {
    if (this.state.selectedPieceId) {
      return this.state.legalActionPreviews;
    }

    if (this.state.currentPlayer === RIGHT) {
      return this.recommendedPlans.map((plan) => plan.preview);
    }

    return [];
  }

  updateRecommendations() {
    if (this.state.isScored || this.state.currentPlayer !== RIGHT) {
      this.recommendedPlans = [];
      this.recommendedPlanById = new Map();
      return;
    }

    this.recommendedPlans = getRankedActionPlans(this.boardSpec, this.solver, this.state, RIGHT, this.i18n).slice(0, 4);
    this.recommendedPlanById = new Map(this.recommendedPlans.map((plan) => [plan.preview.id, plan]));
  }

  handlePreviewSelection(previewId) {
    const recommendedPlan = this.getPlanForPreview(previewId);
    if (recommendedPlan && !this.state.selectedPieceId) {
      this.state = {
        ...this.state,
        selectedPieceId: recommendedPlan.preview.pieceId,
        legalActionPreviews: this.recommendedPlans.map((plan) => plan.preview),
        activePreviewId: previewId,
      };
      this.refreshView();
      return;
    }

    this.state = selectPreview(this.boardSpec, this.state, previewId);
    this.refreshView();
  }

  queueComputerMove() {
    if (this.aiThinking || !this.isComputerTurn()) {
      return;
    }

    const plans = getRankedActionPlans(this.boardSpec, this.solver, this.state, LEFT, this.i18n);
    if (plans.length === 0) {
      return;
    }

    this.aiThinking = true;
    this.lastComputerPlan = plans[0];
    this.syncView();

    this.aiTimer = window.setTimeout(() => {
      this.aiThinking = false;
      this.aiTimer = null;
      this.state = applyPreview(this.boardSpec, {
        ...this.state,
        selectedPieceId: plans[0].preview.pieceId,
        activePreviewId: plans[0].preview.id,
        legalActionPreviews: [plans[0].preview],
      });
      this.refreshView();
    }, 640);
  }

  syncView() {
    this.updateRecommendations();
    const activePreview = getActivePreview(this.state);
    const scoreBreakdown = this.state.scoreBreakdown;

    this.elements.turnPill.className = 'turn-pill';
    this.elements.turnPill.classList.add(this.state.currentPlayer === LEFT ? 'is-left' : 'is-right');
    if (this.state.isScored) {
      this.elements.turnPill.classList.add('is-ended');
    }
    this.elements.turnPill.textContent = this.state.isScored
      ? this.i18n.t('score.final')
      : this.i18n.t('turn.pill', { player: this.playerLabel(this.state.currentPlayer) });

    this.elements.statusText.textContent = this.getStatusText(activePreview);
    this.elements.detailText.textContent = this.getDetailText();
    this.elements.metricTurn.textContent = this.playerLabel(this.state.currentPlayer);
    this.elements.metricMoves.textContent = this.i18n.t('metric.movesValue', { count: this.state.moveCount });
    this.elements.metricLeftScore.textContent = `${scoreBreakdown.players[LEFT].totalScore}`;
    this.elements.metricRightScore.textContent = `${scoreBreakdown.players[RIGHT].totalScore}`;

    this.renderSelectionSummary(activePreview);
    this.renderPreviewList(activePreview);
    this.renderPreviewDetail(activePreview);
    this.renderMoveList();
    this.renderScoreboard();

    const canExecute = Boolean(activePreview) && !this.state.isScored && !this.aiThinking;
    const canCycle = Boolean(activePreview)
      && this.state.legalActionPreviews.filter((preview) => preview.toNodeId === activePreview.toNodeId).length > 1;

    this.elements.executeButton.disabled = !canExecute;
    this.elements.cyclePreviewButton.disabled = !canCycle || this.aiThinking;
    this.elements.clearSelectionButton.disabled = !this.state.selectedPieceId || this.aiThinking;
    this.elements.callStopButton.disabled = this.state.callStopAvailableFor.length === 0 || this.state.isScored || this.aiThinking;

    if (this.state.callStopAvailableFor.length === 0) {
      this.elements.callStopButton.textContent = this.i18n.t('ui.button.callStop');
    } else if (this.state.callStopAvailableFor.length === 1) {
      this.elements.callStopButton.textContent = this.i18n.t('callStop.single', {
        player: this.playerLabel(this.state.callStopAvailableFor[0]),
      });
    } else {
      this.elements.callStopButton.textContent = this.i18n.t('callStop.any');
    }

    this.scene.setInteractionEnabled(!this.state.isScored && !this.aiThinking && this.state.currentPlayer === RIGHT);
    this.scene.setViewModel({
      boardSpec: this.boardSpec,
      state: this.state,
      activePreview,
    });
  }

  restartGame() {
    this.clearAiTimer();
    this.aiThinking = false;
    this.lastComputerPlan = null;
    this.state = createMathDuelInitialState(this.boardSpec);
    this.refreshView();
  }

  handleNodeSelection(nodeId) {
    if (this.state.isScored || this.aiThinking || this.state.currentPlayer !== RIGHT) {
      return;
    }

    const pieceId = this.state.occupancyByNode[nodeId];
    const piece = pieceId ? this.state.piecesById[pieceId] : null;

    if (piece && piece.owner === this.state.currentPlayer) {
      this.state = selectPiece(this.boardSpec, this.solver, this.state, pieceId);
      this.refreshView();
      return;
    }

    if (!this.state.selectedPieceId) {
      return;
    }

    this.state = choosePreviewByNode(this.boardSpec, this.state, nodeId);
    this.refreshView();
  }

  getStatusText(activePreview) {
    if (this.state.isScored) {
      const winner = this.state.scoreBreakdown.winner;
      return winner
        ? this.i18n.t('status.scoredWinner', { winner: this.playerLabel(winner) })
        : this.i18n.t('status.scoredDraw');
    }

    if (this.aiThinking) {
      return this.i18n.t('status.aiThinking');
    }

    if (activePreview) {
      return this.i18n.t('status.preview', {
        moveType: this.moveTypeLabel(activePreview.moveType),
        execute: this.i18n.t('ui.button.execute'),
      });
    }

    if (this.state.selectedPieceId) {
      if (this.state.legalActionPreviews.length === 0) {
        return this.i18n.t('status.noLegalMoves');
      }

      return this.i18n.t('status.selectedPiece', {
        pieceLabel: this.pieceLabel(this.state.piecesById[this.state.selectedPieceId].digit),
      });
    }

    if (this.state.currentPlayer === RIGHT) {
      return this.i18n.t('status.redSelectSuggestion');
    }

    return this.i18n.t('status.waitBlue');
  }

  getDetailText() {
    if (this.aiThinking && this.lastComputerPlan) {
      return this.i18n.t('detail.aiLogic', {
        reasons: this.i18n.join(this.lastComputerPlan.reasons),
      });
    }

    if (this.state.currentPlayer === RIGHT && this.recommendedPlans.length > 0 && !this.state.selectedPieceId) {
      return this.i18n.t('detail.recommendationPriority', {
        reasons: this.i18n.join(this.recommendedPlans[0].reasons),
      });
    }

    const callers = this.state.callStopAvailableFor;
    if (callers.length === 0) {
      return this.i18n.t('detail.noCallStop');
    }

    if (callers.length === 1) {
      return this.i18n.t('detail.singleCallStop', {
        player: this.playerLabel(callers[0]),
      });
    }

    return this.i18n.t('detail.bothCallStop');
  }

  renderSelectionSummary(activePreview) {
    const selectedPieceId = this.state.selectedPieceId;
    if (!selectedPieceId) {
      if (this.aiThinking && this.lastComputerPlan) {
        this.elements.selectionSummary.innerHTML = `
          <div class="empty-state">
            <strong>${escapeHtml(this.i18n.t('selection.aiHeading'))}</strong>
            <span>${escapeHtml(this.lastComputerPlan.title)}</span>
            <span>${escapeHtml(this.i18n.join(this.lastComputerPlan.reasons, 'semicolon'))}</span>
          </div>
        `;
        return;
      }

      if (this.state.currentPlayer === RIGHT && this.recommendedPlans.length > 0) {
        this.elements.selectionSummary.innerHTML = `
          <div class="selection-card selection-card-right">
            <strong>${escapeHtml(this.i18n.t('selection.redAdviceHeading'))}</strong>
            <span>${escapeHtml(this.i18n.t('selection.redAdviceBody'))}</span>
            <span>${escapeHtml(this.i18n.t('selection.redAdviceTop', {
              title: this.recommendedPlans[0].title,
              summary: this.recommendedPlans[0].summary,
            }))}</span>
          </div>
        `;
        return;
      }

      this.elements.selectionSummary.innerHTML = `
        <div class="empty-state">
          <strong>${escapeHtml(this.i18n.t('selection.waitingHeading'))}</strong>
          <span>${escapeHtml(this.i18n.t('selection.waitingBody'))}</span>
        </div>
      `;
      return;
    }

    const piece = this.state.piecesById[selectedPieceId];
    const node = this.boardSpec.nodesById[piece.nodeId];
    const previewCount = this.state.legalActionPreviews.length;

    this.elements.selectionSummary.innerHTML = `
      <div class="selection-card ${piece.owner === LEFT ? 'selection-card-left' : 'selection-card-right'}">
        <strong>${escapeHtml(this.playerLabel(piece.owner))} ${escapeHtml(this.pieceLabel(piece.digit))}</strong>
        <span>${escapeHtml(this.i18n.t('selection.currentSpot', { spot: this.nodeLabel(node.visibleLabel) }))}</span>
        <span>${escapeHtml(this.i18n.t('selection.legalPaths', {
          count: previewCount,
          activeMoveType: activePreview ? this.moveTypeLabel(activePreview.moveType) : '',
        }))}</span>
      </div>
    `;
  }

  renderPreviewList(activePreview) {
    const displayedPreviews = this.getDisplayedPreviews();

    if (displayedPreviews.length === 0) {
      this.elements.previewList.innerHTML = `
        <div class="empty-state compact">
          <strong>${escapeHtml(this.i18n.t('preview.noAdviceHeading'))}</strong>
          <span>${escapeHtml(this.i18n.t('preview.noAdviceBody'))}</span>
        </div>
      `;
      return;
    }

    this.elements.previewList.innerHTML = displayedPreviews
      .map((preview) => `
        <button
          type="button"
          class="preview-item ${activePreview?.id === preview.id ? 'is-active' : ''}"
          data-preview-id="${preview.id}"
        >
          <strong>${escapeHtml(this.getPreviewHeadline(preview))}</strong>
          <span>${escapeHtml(this.getPreviewDetail(preview))}</span>
          <small>${escapeHtml(this.i18n.t('preview.meta', {
            segments: preview.segments.length,
            commonResult: preview.commonResult,
          }))}</small>
        </button>
      `)
      .join('');
  }

  renderPreviewDetail(activePreview) {
    if (!activePreview) {
      if (this.state.currentPlayer === RIGHT && this.recommendedPlans.length > 0) {
        const adviceItems = this.recommendedPlans
          .map((plan, index) => `<li>${escapeHtml(this.i18n.t('preview.reasonItem', {
            index: index + 1,
            title: plan.title,
            reasons: this.i18n.join(plan.reasons),
          }))}</li>`)
          .join('');

        this.elements.previewDetail.innerHTML = `
          <div class="detail-head">
            <strong>${escapeHtml(this.i18n.t('preview.reasonsHeading'))}</strong>
            <span>${escapeHtml(this.i18n.t('preview.reasonsBody'))}</span>
          </div>
          <article class="segment-card">
            <p>${escapeHtml(this.i18n.t('preview.reasonsIntro'))}</p>
            <ol class="proof-list">${adviceItems}</ol>
          </article>
        `;
        return;
      }

      this.elements.previewDetail.innerHTML = `
        <div class="empty-state compact">
          <strong>${escapeHtml(this.i18n.t('preview.waitHeading'))}</strong>
          <span>${escapeHtml(this.i18n.t('preview.waitBody'))}</span>
        </div>
      `;
      return;
    }

    const segmentMarkup = activePreview.segments
      .map((segment, index) => {
        const proof = segment.proofGroup;
        const proofList = proof.expressions.length > 0
          ? proof.expressions.map((expression) => `<li>${escapeHtml(expression)} = ${segment.resultValue}</li>`).join('')
          : `<li>${escapeHtml(this.i18n.t('preview.noProof'))}</li>`;
        const overflow = proof.truncatedCount > 0
          ? `<p class="overflow-note">${escapeHtml(this.i18n.t('preview.overflow', { count: proof.truncatedCount }))}</p>`
          : '';

        return `
          <article class="segment-card">
            <header>
              <strong>${escapeHtml(this.i18n.t('preview.segmentHeading', { index: index + 1 }))}</strong>
              <span>${escapeHtml(this.i18n.t('preview.segmentLanding', {
                landing: this.nodeLabel(this.boardSpec.nodesById[segment.toNodeId].visibleLabel),
              }))}</span>
            </header>
            <p>${escapeHtml(this.i18n.t('preview.crossedDigits', {
              digits: segment.digits.length > 0
                ? this.i18n.join(segment.digits.map((digit) => `${digit}`))
                : this.i18n.t('preview.noDigits'),
            }))}</p>
            ${segment.resultValue === null ? '' : `<p>${escapeHtml(this.i18n.t('preview.targetValue', { value: segment.resultValue }))}</p>`}
            <ol class="proof-list">${proofList}</ol>
            ${overflow}
          </article>
        `;
      })
      .join('');

    this.elements.previewDetail.innerHTML = `
      <div class="detail-head">
        <strong>${escapeHtml(this.getPreviewHeadline(activePreview))}</strong>
        <span>${escapeHtml(this.getPreviewDetail(activePreview))}</span>
      </div>
      ${segmentMarkup}
    `;
  }

  renderMoveList() {
    if (this.state.moveHistory.length === 0) {
      this.elements.moveList.innerHTML = `<li class="move-item-empty">${escapeHtml(this.i18n.t('history.empty'))}</li>`;
      return;
    }

    this.elements.moveList.innerHTML = this.state.moveHistory
      .map((move) => `
        <li class="move-item">
          ${this.i18n.t('history.item', {
            turn: move.turn,
            player: escapeHtml(this.playerLabel(move.player)),
            digit: move.digit,
            moveType: escapeHtml(this.moveTypeLabel(move.moveType)),
            landing: escapeHtml(this.nodeLabel(this.boardSpec.nodesById[move.toNodeId].visibleLabel)),
          }).split('\n').map((line, index) => index === 0 ? `<strong>${line}</strong>` : `<span>${line}</span>`).join('')}
        </li>
      `)
      .join('');
  }

  renderScoreboard() {
    const { players, winner } = this.state.scoreBreakdown;

    const markup = [LEFT, RIGHT]
      .map((player) => {
        const entry = players[player];
        const pieces = entry.pieces
          .sort((left, right) => left.digit - right.digit)
          .map((piece) => `
            <li>
              <strong>${piece.digit}</strong>
              <span>${escapeHtml(this.i18n.t('score.item', {
                spot: this.nodeLabel(piece.nodeLabel),
                score: formatScoreValue(piece.pieceScore),
              }))}</span>
            </li>
          `)
          .join('');

        return `
          <article class="score-card ${player === LEFT ? 'score-card-left' : 'score-card-right'}">
            <header>
              <strong>${escapeHtml(this.playerLabel(player))}</strong>
              <span>${escapeHtml(this.i18n.t('score.total', { total: entry.totalScore }))}</span>
            </header>
            <ol>${pieces}</ol>
          </article>
        `;
      })
      .join('');

    const summary = winner
      ? this.i18n.t('score.leading', { winner: this.playerLabel(winner) })
      : this.i18n.t('score.tied');

    this.elements.scoreboard.innerHTML = `
      <div class="score-summary ${this.state.isScored ? 'is-final' : ''}">
        <strong>${escapeHtml(this.state.isScored ? this.i18n.t('score.final') : this.i18n.t('score.live'))}</strong>
        <span>${escapeHtml(summary)}</span>
      </div>
      ${markup}
    `;
  }

  refreshView() {
    this.syncView();
    this.queueComputerMove();
  }
}
