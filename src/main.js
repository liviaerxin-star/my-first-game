import './style.css';
import { AppController } from './game/app-controller.js';

const root = document.querySelector('#app');

root.innerHTML = `
  <div class="page-shell">
    <section class="hero reveal">
      <p class="eyebrow">Cloudflare Pages / Static Demo</p>
      <h1>人机下棋 Demo</h1>
      <p class="hero-copy">
        先用五子棋验证规则抽象、回合流和本地 AI。后面你改成自己的规则时，优先替换 rules 模块，不需要重写整套界面。
      </p>
    </section>

    <section class="app-layout">
      <div class="board-card reveal">
        <div class="board-toolbar">
          <div>
            <p class="board-label">Local Match</p>
            <h2>Gomoku Sandbox</h2>
          </div>
          <div id="turn-pill" class="turn-pill">准备开始</div>
        </div>

        <div id="phaser-host" class="phaser-host" aria-label="五子棋棋盘"></div>

        <div class="board-footer">
          <p id="status-text" class="status-text"></p>
          <p id="detail-text" class="detail-text"></p>
        </div>
      </div>

      <aside class="sidebar">
        <section class="panel reveal">
          <div class="panel-head">
            <h2>对局设置</h2>
            <p>最小可用 demo，保持纯前端部署。</p>
          </div>

          <div class="field-grid">
            <label class="field">
              <span>棋盘尺寸</span>
              <select id="board-size">
                <option value="9">9 x 9</option>
                <option value="11">11 x 11</option>
                <option value="13">13 x 13</option>
              </select>
            </label>

            <label class="field">
              <span>连子条件</span>
              <select id="win-length">
                <option value="4">连 4</option>
                <option value="5" selected>连 5</option>
              </select>
            </label>

            <label class="field">
              <span>搜索深度</span>
              <select id="search-depth">
                <option value="1">1 层</option>
                <option value="2" selected>2 层</option>
                <option value="3">3 层</option>
              </select>
            </label>

            <label class="field field-toggle">
              <span>AI 先手</span>
              <input id="ai-starts" type="checkbox" />
            </label>
          </div>

          <div class="button-row">
            <button id="restart-button" type="button">重新开始</button>
            <button id="swap-order-button" type="button" class="button-secondary">交换先后</button>
          </div>
        </section>

        <section class="panel reveal">
          <div class="panel-head">
            <h2>对局状态</h2>
            <p>规则层与搜索层已拆开，方便后续替换。</p>
          </div>

          <div class="summary-grid">
            <article class="metric-card">
              <span>规则</span>
              <strong id="metric-rule"></strong>
            </article>
            <article class="metric-card">
              <span>轮到</span>
              <strong id="metric-turn"></strong>
            </article>
            <article class="metric-card">
              <span>搜索</span>
              <strong id="metric-search"></strong>
            </article>
            <article class="metric-card">
              <span>总手数</span>
              <strong id="metric-moves"></strong>
            </article>
          </div>

          <p class="note">
            当前 AI 使用 Minimax + Alpha-Beta 剪枝，并只扩展局部高价值候选点。对五子棋这是近似搜索，不是全局穷举。
          </p>
        </section>

        <section class="panel reveal">
          <div class="panel-head">
            <h2>最近落子</h2>
            <p>方便你观察最后几手的决策结果。</p>
          </div>

          <ol id="move-list" class="move-list"></ol>
        </section>
      </aside>
    </section>
  </div>
`;

new AppController(root);
