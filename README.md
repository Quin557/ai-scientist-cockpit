# EurekaLoop · 灵光闭环

EurekaLoop 是一个面向“AI agent for scientist”的前端 demo。当前版本是 mock-first：暂时不依赖真实后端，也能演示从科学问题到多 Agent 输出、人工审批、反馈重跑、总控最终输出的完整科研闭环。

## Current Scope

本仓库根据项目目录中的三份文档设计：

- `赛题文档.md`：要求展示可交互前端、测试入口、代表性案例，以及“科学问题 → 假设/计划 → 反馈迭代”的科研闭环。
- `数据规范_v0.1.md`：定义 `task_context`、5 个 Agent 的输入输出、统一响应格式 `metadata/payload/self_review`。
- `总控层与前端设计方案v0.1.md`：要求总控负责状态管理、调度、校验、Review Gate、Artifact/版本/事件追踪，前端负责可观察和可干预。

## Demo Features

- Codex-like conversation thread: user question, every Agent output, revision feedback, and final controller output are all shown as chat records.
- Inline Review Gate: approval and rerun controls appear at the end of the related module message, not in a separate popup.
- Message index rail: the thin left rail indexes each input/output and can jump back to a message.
- Controller controls: reasoning level, access permission, and memory level use Codex-style dropdown controls.
- File attachment affordance: the composer keeps a `+` button with the tooltip “添加文件等内容”.
- Side state tree: compact branch tree stays in the side rail; clicking a node opens the full visual React Flow state tree.
- Chinese / English switch and a concise in-app guide page.
- Browser-first direction. Desktop wrapping is deferred until the web experience and backend contract are stable.

## Mock Workflow

```text
用户输入
-> 问题理解
-> 知识整合
-> 候选假设生成
-> 证据梳理
-> 研究计划输出
-> 总控最终审核
```

Each module returns the planned unified response shape:

```text
metadata + payload + self_review
```

The controller only writes the payload into `task_context` after validation or approval.

## Tech Stack

- React
- Vite
- TypeScript
- React Flow
- lucide-react

## Local Run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Build

```bash
npm run build
npm run preview
```

Preview:

```text
http://localhost:4173
```

## Backend Integration Path

The current mock layer can later be replaced by these routes:

```text
POST /api/tasks
POST /api/tasks/{task_id}/start
GET  /api/tasks/{task_id}/context
GET  /api/tasks/{task_id}/stages/{stage}
POST /api/tasks/{task_id}/reviews
POST /api/tasks/{task_id}/feedback
GET  /api/tasks/{task_id}/events/stream
POST /api/tasks/{task_id}/export
```

Recommended landing path:

1. Keep this React/Vite web app as the first deployable surface.
2. Connect the real orchestrator, Agent adapters, Review Gate, Artifact Service, and SSE event stream.
3. Deploy the web version through Vercel, Netlify, or GitHub Pages.
4. Only after the browser experience is stable, wrap the same frontend with Tauri or Electron if a desktop app is still necessary.
