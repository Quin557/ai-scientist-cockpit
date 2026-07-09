# Source Alignment

This frontend is intentionally aligned with the local planning documents.

## Data Contract

From `数据规范_v0.1.md`:

- The frontend keeps `task_context` as the central object.
- Each stage shows the cropped Agent input and unified Agent response.
- Agent responses are represented as `metadata`, `payload`, and `self_review`.
- The controller only merges payloads after Review Gate validation.

## Orchestrator And Frontend Design

From `总控层与前端设计方案v0.1.md`:

- `Workflow Canvas` maps the explicit state machine.
- `Stage Inspector` shows stage input, raw output, and Review Gate result.
- `Event Console` represents `events/trace.jsonl`.
- `Artifact Browser` represents future filesystem MCP Artifact Service files.
- `Version Timeline` represents `versions/context_vXXX.json`.
- `Submission View` gathers the competition-facing evidence in one page.

## Competition Alignment

From `赛题文档.md`:

- The demo highlights the closed loop from scientific question to research plan.
- It displays evidence cards, hypothesis cards, evidence map, and iteration feedback.
- It reserves API, frontend entry, representative case, report, and source-code delivery surfaces.
