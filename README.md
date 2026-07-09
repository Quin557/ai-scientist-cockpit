# AI Scientist Cockpit

AI Scientist Research Cockpit 是一个面向多智能体科研系统的前端工作台。当前版本是 mock-first demo：不依赖真实后端，也能演示从科学问题到问题理解、知识整合、候选假设、证据梳理、研究计划和总控审核的完整闭环。

## Current Scope

本仓库根据项目目录中的三份文档设计：

- `赛题文档.md`：比赛要求科研闭环、可交互前端、测试 API、技术报告和源码。
- `数据规范_v0.1.md`：定义 `task_context`、5 个 Agent 的输入输出、统一响应格式 `metadata/payload/self_review`。
- `总控层与前端设计方案v0.1.md`：定义科研工作台、Workflow Canvas、Stage Inspector、Review Gate、Artifact Browser、Version Timeline 和 Submission View。

## Demo Features

- Codex-like workbench layout: left task rail, top action bar, workflow canvas, stage inspector, event console.
- Apple-inspired visual style: restrained panels, soft translucency, compact controls, responsive layout.
- Web and app surface modes: browser-first UI plus desktop-style title bar for future PWA/Tauri/Electron packaging.
- Mock orchestrator flow: `question_understanding -> knowledge_integration -> hypothesis_generation -> evidence_mapping -> research_planning -> final_review`.
- Human-in-the-loop gates for `hybrid` mode.
- `task_context` preview, Agent response preview, Review Gate score, event stream, artifact placeholders.
- Research panels for `question_card`, `evidence_cards`, `hypothesis_cards`, `evidence_map`, `research_plan`, `feedback_events`.
- API contract page reserved for future FastAPI backend integration.
- Submission View reserved for competition evidence collection.

## Tech Stack

- React
- Vite
- TypeScript
- React Flow
- lucide-react
- PWA manifest placeholder

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

## Future Backend Contract

The frontend is prepared for these routes:

```text
POST /api/tasks
POST /api/tasks/{task_id}/start
GET  /api/tasks/{task_id}/context
GET  /api/tasks/{task_id}/stages/{stage}
POST /api/tasks/{task_id}/reviews
GET  /api/tasks/{task_id}/events/stream
POST /api/tasks/{task_id}/feedback
POST /api/tasks/{task_id}/export
```

The current mock layer can later be replaced by a real API client while keeping the UI structure.

## App Packaging Path

Short term:

- Deploy as a responsive web app through Vercel, Netlify, or GitHub Pages.
- Enable browser install experience through PWA manifest and service worker.

Mid term:

- Wrap the same frontend with Tauri for a lightweight desktop app.
- Or use Electron if the team needs Node.js runtime APIs inside the desktop shell.

Long term:

- Connect to the backend orchestrator, Artifact Service, and SSE event stream.
- Replace mock Agent outputs with real Agent adapters.
- Add JSON diff, report export, and submission bundle download.
