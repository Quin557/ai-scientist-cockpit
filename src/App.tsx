import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Activity,
  AppWindow,
  Archive,
  Bot,
  Braces,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Download,
  FileJson,
  GitBranch,
  GitCommitVertical,
  LayoutDashboard,
  ListChecks,
  Loader2,
  MessageSquareText,
  PanelRight,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  apiSpecs,
  artifactItems,
  createAgentResponse,
  createInitialContext,
  createInitialStages,
  createReviewRecord,
  createStageInput,
  createVersion,
  feedbackEvents,
  manualGateStages,
  mergeStagePayload,
  seedEvents,
  stageMeta,
  stageOrder,
} from "./mockData";
import type {
  ApiSpec,
  ArtifactItem,
  EventLog,
  ReviewRecord,
  RunMode,
  StageId,
  StageRun,
  SurfaceMode,
  TaskContext,
  VersionRecord,
  ViewId,
} from "./types";

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const statusText: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  validating: "Validating",
  human_review: "Human Review",
  passed: "Passed",
  failed: "Failed",
  retrying: "Retrying",
  created: "Created",
  completed: "Completed",
};

const viewItems: Array<{ id: ViewId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "workbench", label: "工作台", icon: LayoutDashboard },
  { id: "research", label: "科研输出", icon: Sparkles },
  { id: "artifacts", label: "Artifacts", icon: Archive },
  { id: "api", label: "API 契约", icon: Braces },
  { id: "submission", label: "提交视图", icon: Download },
];

type AgentFlowNode = Node<{ stage: StageRun; active: boolean }, "agentNode">;

function App() {
  const [surface, setSurface] = useState<SurfaceMode>("web");
  const [runMode, setRunMode] = useState<RunMode>("hybrid");
  const [activeView, setActiveView] = useState<ViewId>("workbench");
  const [context, setContext] = useState<TaskContext>(() => createInitialContext("hybrid"));
  const [stages, setStages] = useState<StageRun[]>(() => createInitialStages(createInitialContext("hybrid")));
  const [events, setEvents] = useState<EventLog[]>(seedEvents);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [activeStage, setActiveStage] = useState<StageId>("question_understanding");
  const [inspectorTab, setInspectorTab] = useState<"input" | "output" | "review">("input");
  const [running, setRunning] = useState(false);
  const [reviewStage, setReviewStage] = useState<StageId | null>(null);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [questionDraft, setQuestionDraft] = useState(context.user_input.original_question);

  const activeStageRun = stages.find((stage) => stage.id === activeStage) ?? stages[0];
  const completedCount = stages.filter((stage) => stage.status === "passed").length;
  const finished = context.current_stage === "completed";

  const appendEvent = useCallback((type: string, message: string, stage?: StageId | "final_review" | "feedback_revision") => {
    setEvents((current) => [
      {
        event_id: `evt_${String(current.length + 1).padStart(3, "0")}`,
        task_id: "task_001",
        type,
        stage,
        message,
        created_at: new Date().toISOString(),
      },
      ...current,
    ]);
  }, []);

  const updateStage = useCallback((stageId: StageId, patch: Partial<StageRun>) => {
    setStages((current) => current.map((stage) => (stage.id === stageId ? { ...stage, ...patch } : stage)));
  }, []);

  const setFreshTask = useCallback(
    (mode: RunMode) => {
      const fresh = {
        ...createInitialContext(mode),
        user_input: {
          ...createInitialContext(mode).user_input,
          original_question: questionDraft.trim() || createInitialContext(mode).user_input.original_question,
        },
      };
      setContext(fresh);
      setStages(createInitialStages(fresh));
      setVersions([]);
      setEvents([
        {
          event_id: "evt_seed_001",
          task_id: "task_001",
          type: "task_created",
          message: "task_context 已初始化，等待启动总控流程。",
          created_at: new Date().toISOString(),
        },
      ]);
      setActiveStage("question_understanding");
      setReviewStage(null);
      setPendingIndex(null);
      return fresh;
    },
    [questionDraft],
  );

  const continueFrom = useCallback(
    async (startIndex: number, inputContext: TaskContext, inputVersions: VersionRecord[]) => {
      let workingContext = inputContext;
      let workingVersions = inputVersions;

      for (let index = startIndex; index < stageOrder.length; index += 1) {
        const stage = stageOrder[index];
        const input = createStageInput(stage, workingContext);
        const startTime = performance.now();

        setActiveStage(stage);
        setInspectorTab("input");
        setContext((current) => ({ ...current, current_stage: stage }));
        updateStage(stage, {
          status: "running",
          input,
          output: null,
          review: null,
          duration: "0.0s",
        });
        appendEvent("stage_started", `${stageMeta[stage].label} 开始执行。`, stage);
        await delay(520);

        const response = createAgentResponse(stage, workingContext.task_id);
        updateStage(stage, {
          status: "validating",
          output: response,
          duration: `${((performance.now() - startTime) / 1000).toFixed(1)}s`,
        });
        setInspectorTab("output");
        appendEvent("agent_output_received", `${stageMeta[stage].agent} 返回统一响应。`, stage);
        await delay(460);

        const needsHuman = runMode === "manual" || (runMode === "hybrid" && manualGateStages.includes(stage));
        const review = createReviewRecord(stage, needsHuman ? "human_review" : "accept");
        updateStage(stage, {
          status: needsHuman ? "human_review" : "passed",
          review,
        });
        setInspectorTab("review");
        appendEvent(
          needsHuman ? "human_review_requested" : "schema_validation_passed",
          needsHuman ? `${stageMeta[stage].label} 命中人工审核门。` : `${stageMeta[stage].label} 通过 Review Gate。`,
          stage,
        );

        if (needsHuman) {
          setReviewStage(stage);
          setPendingIndex(index);
          setContext((current) => ({ ...current, current_stage: "human_review" }));
          setRunning(false);
          return;
        }

        workingContext = mergeStagePayload(workingContext, stage, response);
        workingContext = {
          ...workingContext,
          reviews: [...workingContext.reviews, review],
        };
        const version = createVersion(stage, workingVersions.length);
        workingVersions = [...workingVersions, version];
        workingContext = {
          ...workingContext,
          versions: workingVersions,
        };
        setVersions(workingVersions);
        setContext(workingContext);
        appendEvent("context_snapshot_created", `${version.version_id} 已保存到 ${version.artifact_path}。`, stage);
        await delay(420);
      }

      setRunning(false);
      appendEvent("task_completed", "总控最终审核通过，科研闭环 demo 完成。", "final_review");
    },
    [appendEvent, runMode, updateStage],
  );

  const startDemo = useCallback(async () => {
    if (running) return;
    const fresh = setFreshTask(runMode);
    setRunning(true);
    appendEvent("task_started", `${runMode} 模式启动，多 Agent 总控开始调度。`);
    await continueFrom(0, fresh, []);
  }, [appendEvent, continueFrom, runMode, running, setFreshTask]);

  const resetDemo = useCallback(() => {
    setRunning(false);
    setFreshTask(runMode);
  }, [runMode, setFreshTask]);

  const approveReview = useCallback(async () => {
    if (!reviewStage || pendingIndex === null || running) return;
    const stage = reviewStage;
    const stageRun = stages.find((item) => item.id === stage);
    if (!stageRun?.output) return;

    const approvedReview: ReviewRecord = {
      ...createReviewRecord(stage, "accept"),
      operator: "human",
      comment: "人工审核通过：方向、必填字段和下游可用性已确认。",
    };

    updateStage(stage, {
      status: "passed",
      review: approvedReview,
    });
    setReviewStage(null);
    setPendingIndex(null);
    appendEvent("human_review_approved", `${stageMeta[stage].label} 已人工通过。`, stage);

    let nextContext = mergeStagePayload(context, stage, stageRun.output);
    nextContext = {
      ...nextContext,
      reviews: [...nextContext.reviews, approvedReview],
    };
    const nextVersion = createVersion(stage, versions.length);
    const nextVersions = [...versions, nextVersion];
    nextContext = {
      ...nextContext,
      versions: nextVersions,
    };
    setContext(nextContext);
    setVersions(nextVersions);
    appendEvent("context_snapshot_created", `${nextVersion.version_id} 已保存到 ${nextVersion.artifact_path}。`, stage);
    setRunning(true);
    await delay(360);
    await continueFrom(pendingIndex + 1, nextContext, nextVersions);
  }, [appendEvent, context, continueFrom, pendingIndex, reviewStage, running, stages, updateStage, versions]);

  const retryReviewStage = useCallback(async () => {
    if (!reviewStage || pendingIndex === null || running) return;
    const retryFrom = pendingIndex;
    const stage = reviewStage;
    setReviewStage(null);
    setPendingIndex(null);
    updateStage(stage, {
      status: "retrying",
      review: {
        ...createReviewRecord(stage, "retry"),
        comment: "人工要求同阶段重试，保留当前上下文不合并本次输出。",
      },
    });
    appendEvent("stage_retry_requested", `${stageMeta[stage].label} 已进入重试。`, stage);
    setRunning(true);
    await delay(520);
    await continueFrom(retryFrom, context, versions);
  }, [appendEvent, context, continueFrom, pendingIndex, reviewStage, running, updateStage, versions]);

  const applyFeedback = useCallback(() => {
    const nextVersion: VersionRecord = {
      version_id: `v${String(versions.length + 1).padStart(3, "0")}`,
      iteration: context.iteration + 1,
      stage: "feedback_revision",
      trigger: "human_feedback",
      changed_fields: ["feedback_events", "research_plan", "evidence_map"],
      summary: "人工反馈要求弱化强因果表述，并加入反向因果与失败判据。",
      artifact_path: `versions/context_v${String(versions.length + 1).padStart(3, "0")}.json`,
      created_at: new Date().toISOString(),
    };
    setVersions((current) => [...current, nextVersion]);
    setContext((current) => ({
      ...current,
      iteration: current.iteration + 1,
      feedback_events: feedbackEvents,
      versions: [...current.versions, nextVersion],
    }));
    appendEvent("feedback_revision_applied", "人工反馈已形成一次轻量 iteration_revision。", "feedback_revision");
    setActiveView("research");
  }, [appendEvent, context.iteration, versions.length]);

  const flowNodes = useMemo<AgentFlowNode[]>(
    () =>
      stages.map((stage, index) => ({
        id: stage.id,
        type: "agentNode",
        position: {
          x: (index % 3) * 280,
          y: Math.floor(index / 3) * 190,
        },
        data: {
          stage,
          active: stage.id === activeStage,
        },
      })),
    [activeStage, stages],
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      stageOrder.slice(0, -1).map((stage, index) => ({
        id: `${stage}-${stageOrder[index + 1]}`,
        source: stage,
        target: stageOrder[index + 1],
        animated: stages[index].status === "running" || stages[index].status === "validating",
        className: stages[index].status === "passed" ? "flow-edge-passed" : "flow-edge",
      })),
    [stages],
  );

  const nodeTypes = useMemo(() => ({ agentNode: AgentNode }), []);

  return (
    <div className={`app-root surface-${surface}`}>
      {surface === "app" ? <DesktopTitleBar /> : null}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Bot size={18} />
          </div>
          <div>
            <strong>AI Scientist</strong>
            <span>Research Cockpit</span>
          </div>
        </div>

        <button className="new-task-button" type="button" onClick={resetDemo}>
          <Sparkles size={16} />
          新建科研任务
        </button>

        <div className="search-box">
          <Search size={15} />
          <span>Search tasks, artifacts, schema</span>
        </div>

        <nav className="nav-list" aria-label="Main views">
          {viewItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeView === item.id ? "nav-item active" : "nav-item"}
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-section">
          <p className="sidebar-label">Mode</p>
          <div className="segmented vertical">
            {(["auto", "manual", "hybrid"] as RunMode[]).map((mode) => (
              <button
                className={runMode === mode ? "active" : ""}
                key={mode}
                type="button"
                onClick={() => {
                  setRunMode(mode);
                  setFreshTask(mode);
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="thread-list">
          <p className="sidebar-label">Demo Threads</p>
          <button className="thread-item active" type="button">
            <MessageSquareText size={15} />
            <span>AD 机制闭环</span>
          </button>
          <button className="thread-item" type="button">
            <GitBranch size={15} />
            <span>材料催化占位</span>
          </button>
          <button className="thread-item" type="button">
            <Activity size={15} />
            <span>天文观测占位</span>
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="mini-status">
            <span className="pulse-dot" />
            Mock backend ready
          </div>
          <button className="icon-line-button" type="button">
            <Settings2 size={15} />
            Settings
          </button>
        </div>
      </aside>

      <main className="main-shell">
        <TopBar
          completedCount={completedCount}
          context={context}
          finished={finished}
          onApprove={approveReview}
          onReset={resetDemo}
          onRun={startDemo}
          onSurfaceChange={setSurface}
          running={running}
          surface={surface}
          totalStages={stages.length}
        />

        {activeView === "workbench" ? (
          <section className="workbench-grid">
            <section className="command-panel">
              <div className="panel-heading compact">
                <span>Command</span>
                <span>{context.task_id}</span>
              </div>
              <textarea
                aria-label="Scientific question"
                className="question-input"
                value={questionDraft}
                onChange={(event) => setQuestionDraft(event.target.value)}
              />
              <div className="command-actions">
                <button className="primary-button" disabled={running} type="button" onClick={startDemo}>
                  {running ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
                  Start
                </button>
                <button className="soft-button" type="button" onClick={resetDemo}>
                  <RotateCcw size={16} />
                  Reset
                </button>
              </div>

              <div className="contract-card">
                <p className="card-eyebrow">Data contract</p>
                <h3>task_context</h3>
                <div className="field-stack">
                  {[
                    "user_input",
                    "question_card",
                    "literature_cards",
                    "evidence_cards",
                    "knowledge_gaps",
                    "hypothesis_cards",
                    "evidence_map",
                    "research_plan",
                    "reviews",
                    "versions",
                  ].map((field) => (
                    <span key={field}>{field}</span>
                  ))}
                </div>
              </div>
            </section>

            <section className="canvas-panel">
              <div className="panel-heading">
                <div>
                  <span>Workflow Canvas</span>
                  <strong>总控状态机</strong>
                </div>
                <div className="status-chip neutral">
                  <Clock3 size={14} />
                  {context.current_stage}
                </div>
              </div>
              <div className="flow-wrap">
                <ReactFlow
                  edges={flowEdges}
                  fitView
                  maxZoom={1.15}
                  minZoom={0.52}
                  nodes={flowNodes}
                  nodeTypes={nodeTypes}
                  nodesDraggable={false}
                  nodesFocusable
                  onNodeClick={(_, node) => {
                    setActiveStage(node.id as StageId);
                    setInspectorTab("output");
                  }}
                  panOnScroll
                  proOptions={{ hideAttribution: true }}
                >
                  <Background color="#dfe4ea" gap={22} size={1} />
                  <Controls position="bottom-right" showInteractive={false} />
                </ReactFlow>
              </div>
            </section>

            <StageInspector
              activeStageRun={activeStageRun}
              inspectorTab={inspectorTab}
              onTabChange={setInspectorTab}
            />

            <EventConsole events={events} />
          </section>
        ) : null}

        {activeView === "research" ? (
          <ResearchView context={context} onApplyFeedback={applyFeedback} />
        ) : null}

        {activeView === "artifacts" ? <ArtifactView artifacts={artifactItems} versions={versions} /> : null}

        {activeView === "api" ? <ApiView specs={apiSpecs} /> : null}

        {activeView === "submission" ? (
          <SubmissionView context={context} completedCount={completedCount} totalStages={stages.length} />
        ) : null}
      </main>

      {reviewStage ? (
        <ReviewModal
          onApprove={approveReview}
          onClose={() => setReviewStage(null)}
          onRetry={retryReviewStage}
          stage={stages.find((item) => item.id === reviewStage) ?? activeStageRun}
        />
      ) : null}
    </div>
  );
}

function DesktopTitleBar() {
  return (
    <div className="desktop-titlebar">
      <div className="traffic-lights">
        <span className="red" />
        <span className="yellow" />
        <span className="green" />
      </div>
      <div className="desktop-title">AI Scientist Cockpit</div>
      <div className="desktop-actions">
        <PanelRight size={14} />
      </div>
    </div>
  );
}

function TopBar({
  completedCount,
  context,
  finished,
  onApprove,
  onReset,
  onRun,
  onSurfaceChange,
  running,
  surface,
  totalStages,
}: {
  completedCount: number;
  context: TaskContext;
  finished: boolean;
  onApprove: () => void;
  onReset: () => void;
  onRun: () => void;
  onSurfaceChange: (mode: SurfaceMode) => void;
  running: boolean;
  surface: SurfaceMode;
  totalStages: number;
}) {
  return (
    <header className="topbar">
      <div className="task-title">
        <div className="task-icon">
          <Sparkles size={18} />
        </div>
        <div>
          <p>Research task</p>
          <h1>AD mechanism closed loop</h1>
        </div>
      </div>

      <div className="topbar-metrics">
        <Metric label="Stage" value={`${completedCount}/${totalStages}`} />
        <Metric label="Mode" value={context.mode} />
        <Metric label="Iteration" value={`R${context.iteration}`} />
        <Metric label="Status" value={finished ? "completed" : String(context.current_stage)} />
      </div>

      <div className="topbar-actions">
        <div className="segmented">
          {(["web", "app"] as SurfaceMode[]).map((mode) => (
            <button
              className={surface === mode ? "active" : ""}
              key={mode}
              type="button"
              onClick={() => onSurfaceChange(mode)}
            >
              {mode === "web" ? <LayoutDashboard size={14} /> : <AppWindow size={14} />}
              {mode}
            </button>
          ))}
        </div>
        <button className="soft-button" type="button" onClick={onReset}>
          <RefreshCw size={16} />
          Reset
        </button>
        {context.current_stage === "human_review" ? (
          <button className="primary-button" type="button" onClick={onApprove}>
            <CheckCircle2 size={16} />
            Approve
          </button>
        ) : (
          <button className="primary-button" disabled={running} type="button" onClick={onRun}>
            {running ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Run
          </button>
        )}
      </div>
    </header>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AgentNode({ data }: NodeProps<AgentFlowNode>) {
  const { stage, active } = data;
  return (
    <button className={`agent-node ${stage.status} ${active ? "active" : ""}`} type="button">
      <Handle className="node-handle" position={Position.Left} type="target" />
      <div className="agent-node-top">
        <div className="agent-icon">
          {stage.status === "running" || stage.status === "validating" ? (
            <Loader2 className="spin" size={17} />
          ) : stage.status === "passed" ? (
            <CheckCircle2 size={17} />
          ) : stage.status === "human_review" ? (
            <CircleAlert size={17} />
          ) : (
            <Bot size={17} />
          )}
        </div>
        <span className={`status-pill ${stage.status}`}>{statusText[stage.status]}</span>
      </div>
      <h3>{stage.label}</h3>
      <p>{stage.agent}</p>
      <div className="agent-node-foot">
        <span>{stage.duration}</span>
        <span>{stage.allowedWrites[0]}</span>
      </div>
      <Handle className="node-handle" position={Position.Right} type="source" />
    </button>
  );
}

function StageInspector({
  activeStageRun,
  inspectorTab,
  onTabChange,
}: {
  activeStageRun: StageRun;
  inspectorTab: "input" | "output" | "review";
  onTabChange: (tab: "input" | "output" | "review") => void;
}) {
  const data =
    inspectorTab === "input"
      ? activeStageRun.input
      : inspectorTab === "output"
        ? activeStageRun.output ?? { status: "waiting_for_agent_output" }
        : activeStageRun.review ?? { status: "waiting_for_review_gate" };

  return (
    <aside className="inspector-panel">
      <div className="panel-heading">
        <div>
          <span>Stage Inspector</span>
          <strong>{activeStageRun.label}</strong>
        </div>
        <span className={`status-pill ${activeStageRun.status}`}>{statusText[activeStageRun.status]}</span>
      </div>

      <div className="score-row">
        <ScoreCard label="Self" value={activeStageRun.output?.self_review.overall_score ?? 0} />
        <ScoreCard label="Gate" value={activeStageRun.review?.overall_score ?? 0} />
      </div>

      <div className="inspector-summary">
        <p>{activeStageRun.description}</p>
        <div>
          {activeStageRun.allowedWrites.map((field) => (
            <span key={field}>{field}</span>
          ))}
        </div>
      </div>

      <div className="tabbar">
        {(["input", "output", "review"] as const).map((tab) => (
          <button className={inspectorTab === tab ? "active" : ""} key={tab} type="button" onClick={() => onTabChange(tab)}>
            {tab}
          </button>
        ))}
      </div>

      <JsonBlock data={data} />
    </aside>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-card">
      <span>{label}</span>
      <strong>{value ? `${Math.round(value * 100)}%` : "--"}</strong>
      <div className="score-track">
        <i style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
      </div>
    </div>
  );
}

function EventConsole({ events }: { events: EventLog[] }) {
  return (
    <section className="event-console">
      <div className="panel-heading compact">
        <span>Event Console</span>
        <span>{events.length} events</span>
      </div>
      <div className="event-list">
        {events.map((event) => (
          <div className="event-row" key={event.event_id}>
            <TerminalSquare size={15} />
            <time>{new Date(event.created_at).toLocaleTimeString()}</time>
            <strong>{event.type}</strong>
            <span>{event.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResearchView({ context, onApplyFeedback }: { context: TaskContext; onApplyFeedback: () => void }) {
  const plan = context.research_plan?.plans[0]?.plan;
  const evidenceCount = context.evidence_cards.length;
  const hypothesisCount = context.hypothesis_cards.length;
  const finalScore = context.final_review?.overall_score ?? 0;

  return (
    <section className="research-view">
      <div className="research-hero">
        <div>
          <p className="card-eyebrow">Research Output Panels</p>
          <h2>{context.question_card?.core_question ?? "等待 question_card 写入"}</h2>
        </div>
        <button className="primary-button" type="button" onClick={onApplyFeedback}>
          <GitCommitVertical size={16} />
          Apply Feedback
        </button>
      </div>

      <div className="kpi-grid">
        <MetricCard icon={ListChecks} label="Evidence Cards" value={String(evidenceCount)} tone="green" />
        <MetricCard icon={GitBranch} label="Hypotheses" value={String(hypothesisCount)} tone="blue" />
        <MetricCard icon={ShieldCheck} label="Final Review" value={finalScore ? `${Math.round(finalScore * 100)}%` : "--"} tone="purple" />
        <MetricCard icon={Database} label="Feedback Events" value={String(context.feedback_events.length)} tone="amber" />
      </div>

      <div className="research-grid">
        <section className="content-panel span-2">
          <div className="panel-heading">
            <strong>Question Card</strong>
            <span>question_card</span>
          </div>
          {context.question_card ? (
            <div className="question-card-view">
              <div>
                <p>研究对象</p>
                <strong>{context.question_card.research_object.name}</strong>
              </div>
              <div>
                <p>问题类型</p>
                <strong>{context.question_card.question_type}</strong>
              </div>
              <div>
                <p>关键词</p>
                <div className="tag-wrap">
                  {context.question_card.search_keywords.en.slice(0, 5).map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState text="question_card 尚未生成" />
          )}
        </section>

        <section className="content-panel">
          <div className="panel-heading">
            <strong>Evidence Cards</strong>
            <span>support / oppose</span>
          </div>
          <div className="evidence-list">
            {context.evidence_cards.map((item) => (
              <article className={`evidence-card ${item.support_direction}`} key={item.evidence_id}>
                <span>{item.evidence_id}</span>
                <h3>{item.claim}</h3>
                <p>{item.summary}</p>
                <strong>{Math.round(item.strength_score * 100)}%</strong>
              </article>
            ))}
            {!context.evidence_cards.length ? <EmptyState text="evidence_cards 尚未写入" /> : null}
          </div>
        </section>

        <section className="content-panel">
          <div className="panel-heading">
            <strong>Hypothesis Tournament</strong>
            <span>scoreboard</span>
          </div>
          <div className="hypothesis-table">
            {context.hypothesis_cards.map((item) => (
              <article key={item.hypothesis_id}>
                <div>
                  <strong>{item.hypothesis_id}</strong>
                  <span>{Math.round(item.initial_scores.testability * 100)} testability</span>
                </div>
                <p>{item.statement}</p>
              </article>
            ))}
            {!context.hypothesis_cards.length ? <EmptyState text="hypothesis_cards 尚未生成" /> : null}
          </div>
        </section>

        <section className="content-panel span-2">
          <div className="panel-heading">
            <strong>Evidence Map</strong>
            <span>support / oppose / uncertain</span>
          </div>
          {context.evidence_map.length ? (
            <div className="map-grid">
              {context.evidence_map.map((item) => (
                <article key={item.hypothesis_id}>
                  <div className="map-score">{Math.round(item.evidence_strength_score * 100)}%</div>
                  <h3>{item.hypothesis_id}</h3>
                  <p>{item.evidence_summary.support}</p>
                  <p>{item.evidence_summary.oppose}</p>
                  <div className="tag-wrap">
                    {item.main_limitations.map((limitation) => (
                      <span key={limitation}>{limitation}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState text="evidence_map 尚未生成" />
          )}
        </section>

        <section className="content-panel span-2">
          <div className="panel-heading">
            <strong>Research Plan</strong>
            <span>methods / metrics / falsification</span>
          </div>
          {plan ? (
            <div className="plan-view">
              <h3>{plan.paper_title}</h3>
              <p>{plan.paper_abstract}</p>
              <div className="plan-columns">
                <PlanList title="Methods" items={plan.technical_details.required_methods} />
                <PlanList title="Metrics" items={plan.experiments.metrics.map((metric) => metric.name)} />
                <PlanList title="Falsification" items={plan.results.falsification_criteria} />
              </div>
            </div>
          ) : (
            <EmptyState text="research_plan 尚未输出" />
          )}
        </section>

        <section className="content-panel">
          <div className="panel-heading">
            <strong>Feedback Events</strong>
            <span>iteration_revision</span>
          </div>
          {context.feedback_events.map((event) => (
            <article className="feedback-card" key={event.feedback_id}>
              <strong>{event.controller_action}</strong>
              <p>{event.result_summary}</p>
              <span>{event.revision_suggestion}</span>
            </article>
          ))}
          {!context.feedback_events.length ? <EmptyState text="等待人工反馈或 Feedback Runner" /> : null}
        </section>
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof ListChecks;
  label: string;
  tone: "green" | "blue" | "purple" | "amber";
  value: string;
}) {
  return (
    <div className={`metric-card ${tone}`}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PlanList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="plan-list">
      <strong>{title}</strong>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

function ArtifactView({ artifacts, versions }: { artifacts: ArtifactItem[]; versions: VersionRecord[] }) {
  return (
    <section className="split-view">
      <div className="content-panel">
        <div className="panel-heading">
          <strong>Artifact Browser</strong>
          <span>{artifacts.length} files</span>
        </div>
        <div className="artifact-list">
          {artifacts.map((artifact) => (
            <article key={artifact.artifact_id}>
              <FileJson size={17} />
              <div>
                <strong>{artifact.path}</strong>
                <p>{artifact.description}</p>
              </div>
              <span className={`mini-pill ${artifact.status}`}>{artifact.status}</span>
            </article>
          ))}
        </div>
      </div>
      <VersionTimeline versions={versions} />
    </section>
  );
}

function VersionTimeline({ versions }: { versions: VersionRecord[] }) {
  return (
    <div className="content-panel">
      <div className="panel-heading">
        <strong>Version Timeline</strong>
        <span>{versions.length} snapshots</span>
      </div>
      <div className="timeline">
        {versions.map((version) => (
          <article key={version.version_id}>
            <div className="timeline-dot" />
            <span>{version.version_id}</span>
            <strong>{version.summary}</strong>
            <p>{version.artifact_path}</p>
          </article>
        ))}
        {!versions.length ? <EmptyState text="运行 demo 后会生成 context_v001 等快照" /> : null}
      </div>
    </div>
  );
}

function ApiView({ specs }: { specs: ApiSpec[] }) {
  return (
    <section className="content-panel full-height">
      <div className="panel-heading">
        <strong>Backend API Contract</strong>
        <span>mock-first, backend-ready</span>
      </div>
      <div className="api-table">
        {specs.map((spec) => (
          <article key={`${spec.method}-${spec.path}`}>
            <span className={`method ${spec.method.toLowerCase()}`}>{spec.method}</span>
            <code>{spec.path}</code>
            <p>{spec.description}</p>
            <strong>{spec.owner}</strong>
            <span className={`mini-pill ${spec.status}`}>{spec.status}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function SubmissionView({
  completedCount,
  context,
  totalStages,
}: {
  completedCount: number;
  context: TaskContext;
  totalStages: number;
}) {
  return (
    <section className="submission-view">
      <div className="submission-header">
        <p className="card-eyebrow">Submission View</p>
        <h2>面向比赛提交材料的一页式证据总览</h2>
      </div>
      <div className="submission-grid">
        <SubmissionCard title="可交互前端入口" value="React/Vite demo" icon={LayoutDashboard} />
        <SubmissionCard title="可调用 API" value={`${apiSpecs.length} mocked specs`} icon={Braces} />
        <SubmissionCard title="代表性案例" value="AD mechanism" icon={Activity} />
        <SubmissionCard title="闭环阶段" value={`${completedCount}/${totalStages}`} icon={CheckCircle2} />
      </div>
      <div className="content-panel">
        <div className="panel-heading">
          <strong>Checklist</strong>
          <span>from docs</span>
        </div>
        <div className="checklist">
          {[
            ["question_card", Boolean(context.question_card)],
            ["evidence_cards", context.evidence_cards.length > 0],
            ["hypothesis_cards", context.hypothesis_cards.length > 0],
            ["evidence_map", context.evidence_map.length > 0],
            ["research_plan", Boolean(context.research_plan)],
            ["version_diff", context.versions.length > 1],
            ["final_review", Boolean(context.final_review)],
          ].map(([label, passed]) => (
            <div className={passed ? "passed" : ""} key={String(label)}>
              {passed ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SubmissionCard({
  icon: Icon,
  title,
  value,
}: {
  icon: typeof LayoutDashboard;
  title: string;
  value: string;
}) {
  return (
    <article className="submission-card">
      <Icon size={19} />
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ReviewModal({
  onApprove,
  onClose,
  onRetry,
  stage,
}: {
  onApprove: () => void;
  onClose: () => void;
  onRetry: () => void;
  stage: StageRun;
}) {
  return (
    <div className="modal-backdrop">
      <section className="review-modal">
        <div className="modal-header">
          <div>
            <p className="card-eyebrow">Human-in-the-loop Review Gate</p>
            <h2>{stage.label}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="review-body">
          <ScoreCard label="Self Review" value={stage.output?.self_review.overall_score ?? 0} />
          <ScoreCard label="Controller Gate" value={stage.review?.overall_score ?? 0.78} />
          <p>{stage.review?.comment ?? "Hybrid 模式要求人工确认后继续。"}</p>
          <div className="risk-list">
            <span>字段完整性</span>
            <span>证据追溯</span>
            <span>下游可用性</span>
            <span>版本快照</span>
          </div>
        </div>
        <div className="modal-actions">
          <button className="soft-button" type="button" onClick={onRetry}>
            <RefreshCw size={16} />
            Retry
          </button>
          <button className="primary-button" type="button" onClick={onApprove}>
            <CheckCircle2 size={16} />
            Approve & Continue
          </button>
        </div>
      </section>
    </div>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="json-block">
      <code>{JSON.stringify(data, null, 2)}</code>
    </pre>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <Pause size={16} />
      <span>{text}</span>
    </div>
  );
}

export default App;
