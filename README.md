# Math Duel

一个基于 `Vite + Phaser` 的单页静态网页教学沙盘，用来演示六角星数棋 `Math Duel`。

## 当前版本

- 纯前端静态应用
- 无后端
- 本地双人回合制
- 星盘图结构，不使用方格棋盘
- 支持 `移 / 邻 / 单跨 / 连跨`
- 单跨与连跨自动生成四则运算证明
- 支持“叫停”并按差和法结算
- 可直接部署到 Cloudflare Pages

## 本地运行

```bash
npm install
npm run dev
```

## 测试

```bash
npm test
```

## 打包

```bash
npm run build
```

Cloudflare Pages 构建参数：

- Build command: `npm run build`
- Build output directory: `dist`

## 主要结构

- `src/game/math-duel/board-spec.js`: 六角星星盘节点图、阵营、固定编号
- `src/game/math-duel/rules.js`: 状态机、合法步生成、叫停与结算
- `src/game/math-duel/expression-solver.js`: 四则运算整数求解与证明去重
- `src/game/rendering/math-duel-scene.js`: Phaser 星盘渲染与路径高亮
- `src/game/app-controller.js`: 页面 UI、棋盘交互与信息面板同步
