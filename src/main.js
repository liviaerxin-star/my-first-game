import './style.css';
import { AppController } from './game/app-controller.js';
import { createI18n, DEFAULT_LANGUAGE, LANGUAGE_OPTIONS } from './game/i18n.js';

const root = document.querySelector('#app');
const i18n = createI18n(DEFAULT_LANGUAGE);

root.innerHTML = `
  <div class="page-shell">
    <section class="hero reveal">
      <p id="hero-eyebrow" class="eyebrow">${i18n.t('ui.eyebrow')}</p>
      <h1 id="hero-title">${i18n.t('ui.heroTitle')}</h1>
      <p id="hero-copy" class="hero-copy">${i18n.t('ui.heroCopy')}</p>
    </section>

    <section class="app-layout">
      <div class="board-card reveal">
        <div class="board-toolbar">
          <div>
            <p id="board-label" class="board-label">${i18n.t('ui.boardLabel')}</p>
            <h2 id="board-title">${i18n.t('ui.boardTitle')}</h2>
          </div>

          <div class="board-toolbar-actions">
            <div id="language-picker" class="language-picker" role="group" aria-label="${i18n.t('ui.languageAria')}">
              ${LANGUAGE_OPTIONS.map(({ value, label }) => `
                <button
                  type="button"
                  class="language-option ${value === DEFAULT_LANGUAGE ? 'is-active' : ''}"
                  data-language="${value}"
                  aria-pressed="${value === DEFAULT_LANGUAGE}"
                >${label}</button>
              `).join('')}
            </div>
            <div id="turn-pill" class="turn-pill">${i18n.t('ui.turn.ready')}</div>
          </div>
        </div>

        <div id="phaser-host" class="phaser-host" aria-label="${i18n.t('ui.boardAria')}"></div>

        <div class="board-footer">
          <p id="status-text" class="status-text"></p>
          <p id="detail-text" class="detail-text"></p>
        </div>
      </div>

      <aside class="sidebar">
        <section class="panel reveal">
          <div class="panel-head">
            <h2 id="overview-title">${i18n.t('ui.overview.title')}</h2>
            <p id="overview-body">${i18n.t('ui.overview.body')}</p>
          </div>

          <div class="summary-grid">
            <article class="metric-card">
              <span id="metric-turn-label">${i18n.t('ui.metric.turn')}</span>
              <strong id="metric-turn"></strong>
            </article>
            <article class="metric-card">
              <span id="metric-moves-label">${i18n.t('ui.metric.moves')}</span>
              <strong id="metric-moves"></strong>
            </article>
            <article class="metric-card">
              <span id="metric-left-score-label">${i18n.t('ui.metric.blueScore')}</span>
              <strong id="metric-left-score"></strong>
            </article>
            <article class="metric-card">
              <span id="metric-right-score-label">${i18n.t('ui.metric.redScore')}</span>
              <strong id="metric-right-score"></strong>
            </article>
          </div>

          <div class="button-row button-row-stack">
            <button id="restart-button" type="button">${i18n.t('ui.button.restart')}</button>
            <button id="clear-selection-button" type="button" class="button-secondary">${i18n.t('ui.button.clear')}</button>
            <button id="call-stop-button" type="button" class="button-tertiary">${i18n.t('ui.button.callStop')}</button>
          </div>
        </section>

        <section class="panel reveal">
          <div class="panel-head">
            <h2 id="suggestion-title">${i18n.t('ui.suggestion.title')}</h2>
            <p id="suggestion-body">${i18n.t('ui.suggestion.body')}</p>
          </div>

          <div id="selection-summary" class="selection-summary"></div>
          <div id="preview-list" class="preview-list"></div>

          <div id="preview-detail" class="preview-detail"></div>

          <div class="button-row">
            <button id="execute-button" type="button">${i18n.t('ui.button.execute')}</button>
            <button id="cycle-preview-button" type="button" class="button-secondary">${i18n.t('ui.button.cycle')}</button>
          </div>
        </section>

        <section class="panel reveal">
          <div class="panel-head">
            <h2 id="history-title">${i18n.t('ui.history.title')}</h2>
            <p id="history-body">${i18n.t('ui.history.body')}</p>
          </div>

          <ol id="move-list" class="move-list"></ol>
        </section>

        <section class="panel reveal">
          <div class="panel-head">
            <h2 id="score-title">${i18n.t('ui.score.title')}</h2>
            <p id="score-body">${i18n.t('ui.score.body')}</p>
          </div>

          <div id="scoreboard" class="scoreboard"></div>
        </section>
      </aside>
    </section>
  </div>
`;

new AppController(root);
