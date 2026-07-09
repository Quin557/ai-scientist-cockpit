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

- The compact side state tree maps the explicit state machine without overwhelming the initial screen.
- The full visual state tree modal shows the complete workflow on demand.
- The stage summary panel shows current input/output/review status without making JSON the first thing users see.
- The JSON modal represents the future debug/detail mode.
- The event summary represents `events/trace.jsonl`.
- Future Artifact Browser and Version Timeline features remain aligned with `versions/context_vXXX.json`.
- `Submission View` gathers the competition-facing evidence in one page.

## Competition Alignment

From `赛题文档.md`:

- The demo highlights the closed loop from scientific question to research plan.
- It displays evidence cards, hypothesis cards, evidence map, and iteration feedback.
- It reserves API, frontend entry, representative case, report, and source-code delivery surfaces.
- It now prioritizes a clear user path: ask a question, configure the controller, run, review, inspect output.
