# 人机下棋 Demo

一个基于 `Vite + Phaser` 的单页静态网页 demo，先实现本地五子棋的人机对战。

目标：

- 单页静态应用
- 无后端
- `npm run build` 产出 `dist`
- 可直接部署到 Cloudflare Pages
- 当前规则为五子棋，后续可以替换成自定义规则

## 本地运行

```bash
npm install
npm run dev
```

## 打包

```bash
npm run build
```

Cloudflare Pages 可使用：

- Build command: `npm run build`
- Build output directory: `dist`

## 当前结构

- `src/game/rules/gomoku-rules.js`: 五子棋规则与局面评估
- `src/game/ai/minimax-agent.js`: Minimax + Alpha-Beta 剪枝
- `src/game/rendering/gomoku-scene.js`: Phaser 棋盘渲染
- `src/game/app-controller.js`: 页面 UI 与对局流程控制

## 后续扩展

如果你后面要定义自己的规则，优先替换或新增 `rules` 模块，让它提供：

- 初始状态
- 合法落子判断
- 执行落子
- 候选步生成
- 局面评估

这样 UI 和 Minimax 搜索层可以继续复用。
