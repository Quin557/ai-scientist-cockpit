# AI Scientist Cockpit

AI Scientist Research Cockpit 是一个面向多智能体科研系统的前端工作台。当前版本是 mock-first demo：不依赖真实后端，也能演示从科学问题到问题理解、知识整合、候选假设、证据梳理、研究计划和总控审核的完整闭环。

## Current Scope

本仓库根据项目目录中的三份文档设计：

- `赛题文档.md`：比赛要求科研闭环、可交互前端、测试 API、技术报告和源码。
- `数据规范_v0.1.md`：定义 `task_context`、5 个 Agent 的输入输出、统一响应格式 `metadata/payload/self_review`。
- `总控层与前端设计方案v0.1.md`：定义科研工作台、Workflow Canvas、Stage Inspector、Review Gate、Artifact Browser、Version Timeline 和 Submission View。

## Demo Features

- Focused Codex-like workflow: side rail, central command composer, controller settings, compact state tree, and stage summary.
- Apple-inspired visual style: restrained panels, soft translucency, compact controls, smooth hover states, responsive layout.
- Browser-first product direction. The app shell is intentionally deferred until the web UX is stable.
- Chinese / English UI toggle.
- Concise in-app guide page.
- File attachment affordance in the composer, matching the Codex-style `+` entry point.
- Controller settings for reasoning level, access mode, and memory level.
- Mock orchestrator flow: `question_understanding -> knowledge_integration -> hypothesis_generation -> evidence_mapping -> research_planning -> final_review`.
- Human-in-the-loop gates for `hybrid` mode.
- Compact side state tree with hover emphasis and a full visual state tree modal.
- Stage output preview plus optional JSON details.

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

## Product Path

Short term:

- Deploy as a responsive web app through Vercel, Netlify, or GitHub Pages.
- Keep the workflow, language switch, controller settings, file attachments, and state tree polished in the browser.

Mid term:

- Connect to the real backend orchestrator, Artifact Service, and SSE event stream.
- Replace mock Agent outputs with real Agent adapters.

Long term:

- Only after the web UX is stable, wrap the same frontend with Tauri or Electron if a desktop app is still useful.
- Add JSON diff, report export, and submission bundle download.
