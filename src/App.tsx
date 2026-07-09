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
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Globe2,
  HelpCircle,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Paperclip,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
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
import type { AgentResponse, EventLog, ReviewRecord, RunMode, StageId, StageRun, TaskContext, VersionRecord } from "./types";

type Language = "zh" | "en";
type PageId = "workbench" | "docs";
type ReasoningLevel = "low" | "medium" | "high" | "ultra";
type ApprovalMode = "ask" | "assist" | "auto";
type MemoryLevel = "low" | "medium" | "high";

type FlowNode = Node<{ stage: StageRun; active: boolean; lang: Language }, "flowNode">;

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const approvalToRunMode: Record<ApprovalMode, RunMode> = {
  ask: "manual",
  assist: "hybrid",
  auto: "auto",
};

const stageLabel: Record<Language, Record<StageId, string>> = {
  zh: {
    question_understanding: "问题理解",
    knowledge_integration: "知识整合",
    hypothesis_generation: "假设生成",
    evidence_mapping: "证据梳理",
    research_planning: "研究计划",
    final_review: "总控审核",
  },
  en: {
    question_understanding: "Question",
    knowledge_integration: "Knowledge",
    hypothesis_generation: "Hypothesis",
    evidence_mapping: "Evidence",
    research_planning: "Plan",
    final_review: "Review",
  },
};

const statusLabel: Record<Language, Record<string, string>> = {
  zh: {
    queued: "等待",
    running: "运行中",
    validating: "校验中",
    human_review: "待审核",
    passed: "已通过",
    failed: "失败",
    retrying: "重试中",
    created: "待开始",
    completed: "已完成",
  },
  en: {
    queued: "Queued",
    running: "Running",
    validating: "Validating",
    human_review: "Review",
    passed: "Passed",
    failed: "Failed",
    retrying: "Retrying",
    created: "Ready",
    completed: "Done",
  },
};

const copy = {
  zh: {
    appName: "AI 科研总控台",
    appSub: "多智能体科研闭环",
    workbench: "工作台",
    docs: "使用文档",
    newTask: "新任务",
    language: "中文",
    heroTitle: "从一个科学问题开始，让总控把任务分发给多个 Agent。",
    heroHint: "输入问题，选择总控策略，然后启动。状态树和详细 JSON 都在旁边，不打断主流程。",
    questionPlaceholder: "请输入科学问题，例如：阿尔茨海默病的关键致病机制是什么？",
    addFile: "添加文件等内容",
    start: "开始总控",
    running: "运行中",
    approve: "批准继续",
    reset: "重新开始",
    settings: "总控设置",
    reasoning: "推理强度",
    approval: "访问权限",
    memory: "记忆能力",
    low: "低",
    medium: "中",
    high: "高",
    ultra: "超高",
    ask: "请求批准",
    assist: "替我审批",
    auto: "完全自动",
    currentStage: "当前阶段",
    progress: "进度",
    iteration: "轮次",
    uploaded: "已添加文件",
    noFiles: "还没有添加文件",
    stateTree: "状态树",
    clickTree: "点击任一节点查看完整状态树",
    fullTree: "完整可视化状态树",
    close: "退出",
    details: "阶段摘要",
    outputPreview: "输出预览",
    eventLog: "事件",
    resultReady: "结果区",
    docsTitle: "如何使用这个 Demo",
    docsLead: "这是一个前端优先的科研多 Agent 工作台。当前使用 mock 数据，后续可替换为真实后端和 Agent 接口。",
    step1: "1. 在主输入框写科学问题，可用左下角 + 添加文件。",
    step2: "2. 选择推理强度、访问权限和记忆能力。",
    step3: "3. 点击开始总控，观察侧边状态树。",
    step4: "4. 需要审核时点击批准继续；完成后查看输出预览。",
    docBackend: "后续接入后端时，把 mock 调度替换成 POST /api/tasks、/start、/reviews 和 SSE 事件流即可。",
    reviewTitle: "人工审核",
    reviewBody: "总控已完成本阶段校验。确认方向、字段和下游可用性后继续。",
    retry: "重试本阶段",
    continue: "批准并继续",
  },
  en: {
    appName: "AI Scientist Control",
    appSub: "Multi-agent research loop",
    workbench: "Workbench",
    docs: "Guide",
    newTask: "New task",
    language: "English",
    heroTitle: "Start with a scientific question. The controller routes work to specialist agents.",
    heroHint: "Write the question, choose controller settings, then run. State details stay aside until needed.",
    questionPlaceholder: "Enter a scientific question, e.g. What drives Alzheimer's disease progression?",
    addFile: "Add files or context",
    start: "Start controller",
    running: "Running",
    approve: "Approve",
    reset: "Reset",
    settings: "Controller settings",
    reasoning: "Reasoning",
    approval: "Access",
    memory: "Memory",
    low: "Low",
    medium: "Medium",
    high: "High",
    ultra: "Ultra",
    ask: "Ask approval",
    assist: "Approve for me",
    auto: "Full auto",
    currentStage: "Current stage",
    progress: "Progress",
    iteration: "Round",
    uploaded: "Attached files",
    noFiles: "No files attached",
    stateTree: "State tree",
    clickTree: "Click a node to open the full state map",
    fullTree: "Full visual state tree",
    close: "Close",
    details: "Stage summary",
    outputPreview: "Output preview",
    eventLog: "Events",
    resultReady: "Results",
    docsTitle: "How to use this demo",
    docsLead: "This is a frontend-first multi-agent research cockpit. It uses mock data now and can later connect to real agents.",
    step1: "1. Write a scientific question in the main input. Use + to attach files.",
    step2: "2. Choose reasoning level, access mode, and memory level.",
    step3: "3. Start the controller and watch the side state tree.",
    step4: "4. Approve when a review gate pauses the run. Then inspect the output preview.",
    docBackend: "For backend integration, replace the mock runner with POST /api/tasks, /start, /reviews and SSE events.",
    reviewTitle: "Human review",
    reviewBody: "The controller has validated this stage. Confirm direction, fields, and downstream readiness to continue.",
    retry: "Retry stage",
    continue: "Approve and continue",
  },
};

function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const [page, setPage] = useState<PageId>("workbench");
  const [reasoning, setReasoning] = useState<ReasoningLevel>("high");
  const [approval, setApproval] = useState<ApprovalMode>("assist");
  const [memory, setMemory] = useState<MemoryLevel>("medium");
  const [context, setContext] = useState<TaskContext>(() => createInitialContext("hybrid"));
  const [stages, setStages] = useState<StageRun[]>(() => createInitialStages(createInitialContext("hybrid")));
  const [events, setEvents] = useState<EventLog[]>(seedEvents);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [activeStage, setActiveStage] = useState<StageId>("question_understanding");
  const [running, setRunning] = useState(false);
  const [reviewStage, setReviewStage] = useState<StageId | null>(null);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [questionDraft, setQuestionDraft] = useState(context.user_input.original_question);
  const [files, setFiles] = useState<string[]>([]);

  const t = copy[language];
  const runMode = approvalToRunMode[approval];
  const activeStageRun = stages.find((stage) => stage.id === activeStage) ?? stages[0];
  const completedCount = stages.filter((stage) => stage.status === "passed").length;
  const finished = context.current_stage === "completed";
  const progress = Math.round((completedCount / stages.length) * 100);

  const appendEvent = useCallback(
    (type: string, messageZh: string, messageEn: string, stage?: StageId | "final_review" | "feedback_revision") => {
      setEvents((current) => [
        {
          event_id: `evt_${String(current.length + 1).padStart(3, "0")}`,
          task_id: "task_001",
          type,
          stage,
          message: language === "zh" ? messageZh : messageEn,
          created_at: new Date().toISOString(),
        },
        ...current,
      ]);
    },
    [language],
  );

  const updateStage = useCallback((stageId: StageId, patch: Partial<StageRun>) => {
    setStages((current) => current.map((stage) => (stage.id === stageId ? { ...stage, ...patch } : stage)));
  }, []);

  const setFreshTask = useCallback(() => {
    const fresh = {
      ...createInitialContext(runMode),
      user_input: {
        ...createInitialContext(runMode).user_input,
        original_question: questionDraft.trim() || createInitialContext(runMode).user_input.original_question,
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
        message: language === "zh" ? "任务已创建，等待启动总控。" : "Task created. Controller is ready.",
        created_at: new Date().toISOString(),
      },
    ]);
    setActiveStage("question_understanding");
    setReviewStage(null);
    setPendingIndex(null);
    return fresh;
  }, [language, questionDraft, runMode]);

  const continueFrom = useCallback(
    async (startIndex: number, inputContext: TaskContext, inputVersions: VersionRecord[]) => {
      let workingContext = inputContext;
      let workingVersions = inputVersions;

      for (let index = startIndex; index < stageOrder.length; index += 1) {
        const stage = stageOrder[index];
        const input = createStageInput(stage, workingContext);
        const startTime = performance.now();

        setActiveStage(stage);
        setContext((current) => ({ ...current, current_stage: stage }));
        updateStage(stage, { status: "running", input, output: null, review: null, duration: "0.0s" });
        appendEvent("stage_started", `${stageLabel.zh[stage]}开始执行。`, `${stageLabel.en[stage]} started.`, stage);
        await delay(420);

        const response = createAgentResponse(stage, workingContext.task_id);
        updateStage(stage, {
          status: "validating",
          output: response,
          duration: `${((performance.now() - startTime) / 1000).toFixed(1)}s`,
        });
        appendEvent(
          "agent_output_received",
          `${stageLabel.zh[stage]}返回统一响应。`,
          `${stageLabel.en[stage]} returned a structured response.`,
          stage,
        );
        await delay(360);

        const needsHuman = runMode === "manual" || (runMode === "hybrid" && manualGateStages.includes(stage));
        const review = createReviewRecord(stage, needsHuman ? "human_review" : "accept");
        updateStage(stage, { status: needsHuman ? "human_review" : "passed", review });
        appendEvent(
          needsHuman ? "human_review_requested" : "review_gate_passed",
          needsHuman ? `${stageLabel.zh[stage]}需要人工确认。` : `${stageLabel.zh[stage]}通过 Review Gate。`,
          needsHuman ? `${stageLabel.en[stage]} needs approval.` : `${stageLabel.en[stage]} passed the Review Gate.`,
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
        workingContext = { ...workingContext, reviews: [...workingContext.reviews, review] };
        const version = createVersion(stage, workingVersions.length);
        workingVersions = [...workingVersions, version];
        workingContext = { ...workingContext, versions: workingVersions };
        setVersions(workingVersions);
        setContext(workingContext);
        appendEvent(
          "context_snapshot_created",
          `${version.version_id} 已保存。`,
          `${version.version_id} snapshot saved.`,
          stage,
        );
        await delay(260);
      }

      setRunning(false);
      appendEvent("task_completed", "总控审核通过，闭环完成。", "Final review passed. Loop completed.", "final_review");
    },
    [appendEvent, runMode, updateStage],
  );

  const startDemo = useCallback(async () => {
    if (running) return;
    const fresh = setFreshTask();
    setRunning(true);
    appendEvent(
      "task_started",
      `总控已启动：推理 ${reasoning}，权限 ${approval}，记忆 ${memory}。`,
      `Controller started: reasoning ${reasoning}, access ${approval}, memory ${memory}.`,
    );
    await continueFrom(0, fresh, []);
  }, [appendEvent, approval, continueFrom, memory, reasoning, running, setFreshTask]);

  const resetDemo = useCallback(() => {
    setRunning(false);
    setFreshTask();
  }, [setFreshTask]);

  const approveReview = useCallback(async () => {
    if (!reviewStage || pendingIndex === null || running) return;
    const stage = reviewStage;
    const stageRun = stages.find((item) => item.id === stage);
    if (!stageRun?.output) return;

    const approvedReview: ReviewRecord = {
      ...createReviewRecord(stage, "accept"),
      operator: "human",
      comment: language === "zh" ? "人工审核通过，继续进入下一阶段。" : "Human approval granted. Continue.",
    };

    updateStage(stage, { status: "passed", review: approvedReview });
    setReviewStage(null);
    setPendingIndex(null);
    appendEvent("human_review_approved", `${stageLabel.zh[stage]}已批准。`, `${stageLabel.en[stage]} approved.`, stage);

    let nextContext = mergeStagePayload(context, stage, stageRun.output);
    nextContext = { ...nextContext, reviews: [...nextContext.reviews, approvedReview] };
    const nextVersion = createVersion(stage, versions.length);
    const nextVersions = [...versions, nextVersion];
    nextContext = { ...nextContext, versions: nextVersions };
    setContext(nextContext);
    setVersions(nextVersions);

    setRunning(true);
    await delay(260);
    await continueFrom(pendingIndex + 1, nextContext, nextVersions);
  }, [appendEvent, context, continueFrom, language, pendingIndex, reviewStage, running, stages, updateStage, versions]);

  const retryReviewStage = useCallback(async () => {
    if (!reviewStage || pendingIndex === null || running) return;
    const stage = reviewStage;
    setReviewStage(null);
    setPendingIndex(null);
    updateStage(stage, { status: "retrying", review: createReviewRecord(stage, "retry") });
    appendEvent("stage_retry_requested", `${stageLabel.zh[stage]}重试。`, `${stageLabel.en[stage]} retry requested.`, stage);
    setRunning(true);
    await delay(360);
    await continueFrom(pendingIndex, context, versions);
  }, [appendEvent, context, continueFrom, pendingIndex, reviewStage, running, updateStage, versions]);

  const applyFeedback = useCallback(() => {
    const nextVersion: VersionRecord = {
      version_id: `v${String(versions.length + 1).padStart(3, "0")}`,
      iteration: context.iteration + 1,
      stage: "feedback_revision",
      trigger: "human_feedback",
      changed_fields: ["feedback_events", "research_plan", "evidence_map"],
      summary: language === "zh" ? "人工反馈触发轻量修订。" : "Human feedback triggered a light revision.",
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
    appendEvent("feedback_revision_applied", "反馈已写入下一轮。", "Feedback was saved for the next round.", "feedback_revision");
  }, [appendEvent, context.iteration, language, versions.length]);

  const uploadedLabel = files.length ? files.join(", ") : t.noFiles;

  return (
    <div className="app-shell">
      <aside className="side-rail">
        <div className="brand-row">
          <span className="brand-mark">
            <Bot size={18} />
          </span>
          <div>
            <strong>{t.appName}</strong>
            <small>{t.appSub}</small>
          </div>
        </div>

        <nav className="rail-nav" aria-label="Primary">
          <button className={page === "workbench" ? "active" : ""} type="button" onClick={() => setPage("workbench")}>
            <MessageSquareText size={16} />
            {t.workbench}
          </button>
          <button className={page === "docs" ? "active" : ""} type="button" onClick={() => setPage("docs")}>
            <HelpCircle size={16} />
            {t.docs}
          </button>
        </nav>

        <button className="language-button" type="button" onClick={() => setLanguage(language === "zh" ? "en" : "zh")}>
          <Globe2 size={15} />
          {language === "zh" ? "EN" : "中文"}
        </button>

        <section className="branch-panel">
          <div className="section-title">
            <span>{t.stateTree}</span>
            <small>{completedCount}/{stages.length}</small>
          </div>
          <div className="branch-tree" aria-label={t.stateTree}>
            {stages.map((stage, index) => (
              <button
                className={`branch-node ${stage.status} ${stage.id === activeStage ? "active" : ""}`}
                key={stage.id}
                type="button"
                onClick={() => {
                  setActiveStage(stage.id);
                  setTreeOpen(true);
                }}
              >
                <i />
                <span>{stageLabel[language][stage.id]}</span>
                <small>{statusLabel[language][stage.status]}</small>
                {index < stages.length - 1 ? <b /> : null}
              </button>
            ))}
          </div>
          <p className="hint-text">{t.clickTree}</p>
        </section>
      </aside>

      <main className="main-area">
        <header className="top-strip">
          <div>
            <p>{t.currentStage}</p>
            <h1>{finished ? statusLabel[language].completed : stageLabel[language][activeStage]}</h1>
          </div>
          <div className="top-stats">
            <StatusMetric label={t.progress} value={`${progress}%`} />
            <StatusMetric label={t.iteration} value={`R${context.iteration}`} />
            <button className="ghost-button" type="button" onClick={resetDemo}>
              <RotateCcw size={15} />
              {t.reset}
            </button>
          </div>
        </header>

        {page === "workbench" ? (
          <section className="focus-layout">
            <section className="conversation-card">
              <div className="hero-copy">
                <p>{t.heroTitle}</p>
                <span>{t.heroHint}</span>
              </div>

              <div className="composer">
                <textarea
                  aria-label={t.questionPlaceholder}
                  value={questionDraft}
                  onChange={(event) => setQuestionDraft(event.target.value)}
                  placeholder={t.questionPlaceholder}
                />
                <div className="composer-footer">
                  <label className="attach-button">
                    <input
                      multiple
                      type="file"
                      onChange={(event) => {
                        const nextFiles = Array.from(event.target.files ?? []).map((file) => file.name);
                        setFiles(nextFiles);
                      }}
                    />
                    <Plus size={17} />
                    <span className="tooltip">{t.addFile}</span>
                  </label>
                  <span className="file-hint">
                    <Paperclip size={14} />
                    {uploadedLabel}
                  </span>
                  <button
                    className="main-action"
                    disabled={running}
                    type="button"
                    onClick={context.current_stage === "human_review" ? approveReview : startDemo}
                  >
                    {running ? <Loader2 className="spin" size={17} /> : context.current_stage === "human_review" ? <CheckCircle2 size={17} /> : <Play size={17} />}
                    {running ? t.running : context.current_stage === "human_review" ? t.approve : t.start}
                  </button>
                </div>
              </div>

              <ControllerSettings
                approval={approval}
                language={language}
                memory={memory}
                reasoning={reasoning}
                setApproval={setApproval}
                setMemory={setMemory}
                setReasoning={setReasoning}
                t={t}
              />
            </section>

            <aside className="stage-panel">
              <div className="panel-head">
                <div>
                  <p>{t.details}</p>
                  <h2>{stageLabel[language][activeStageRun.id]}</h2>
                </div>
                <span className={`state-chip ${activeStageRun.status}`}>{statusLabel[language][activeStageRun.status]}</span>
              </div>

              <div className="output-card">
                <strong>{t.outputPreview}</strong>
                <OutputPreview language={language} response={activeStageRun.output} stage={activeStageRun.id} />
                <button className="text-button" type="button" onClick={() => setJsonOpen(true)}>
                  <FileText size={15} />
                  JSON
                </button>
              </div>

              <div className="event-card">
                <strong>{t.eventLog}</strong>
                {events.slice(0, 5).map((event) => (
                  <p key={event.event_id}>
                    <Clock3 size={13} />
                    {event.message}
                  </p>
                ))}
              </div>

              <div className="result-card">
                <strong>{t.resultReady}</strong>
                <button className="text-button" type="button" onClick={applyFeedback}>
                  <Sparkles size={15} />
                  {language === "zh" ? "写入一次反馈迭代" : "Apply feedback revision"}
                </button>
              </div>
            </aside>
          </section>
        ) : (
          <DocsPage language={language} t={t} />
        )}
      </main>

      {treeOpen ? (
        <StateTreeModal
          activeStage={activeStage}
          language={language}
          onClose={() => setTreeOpen(false)}
          setActiveStage={setActiveStage}
          stages={stages}
          t={t}
        />
      ) : null}

      {reviewStage ? (
        <ReviewModal
          language={language}
          onApprove={approveReview}
          onClose={() => setReviewStage(null)}
          onRetry={retryReviewStage}
          stage={stages.find((item) => item.id === reviewStage) ?? activeStageRun}
          t={t}
        />
      ) : null}

      {jsonOpen ? (
        <JsonModal
          data={{
            stage: activeStageRun.id,
            input: activeStageRun.input,
            output: activeStageRun.output,
            review: activeStageRun.review,
            task_context_summary: context,
          }}
          onClose={() => setJsonOpen(false)}
          title={language === "zh" ? "阶段 JSON 详情" : "Stage JSON details"}
        />
      ) : null}
    </div>
  );
}

function ControllerSettings({
  approval,
  language,
  memory,
  reasoning,
  setApproval,
  setMemory,
  setReasoning,
  t,
}: {
  approval: ApprovalMode;
  language: Language;
  memory: MemoryLevel;
  reasoning: ReasoningLevel;
  setApproval: (value: ApprovalMode) => void;
  setMemory: (value: MemoryLevel) => void;
  setReasoning: (value: ReasoningLevel) => void;
  t: (typeof copy)[Language];
}) {
  return (
    <div className="settings-grid">
      <SegmentedControl
        icon={<Brain size={15} />}
        label={t.reasoning}
        options={[
          ["low", t.low],
          ["medium", t.medium],
          ["high", t.high],
          ["ultra", t.ultra],
        ]}
        value={reasoning}
        onChange={(value) => setReasoning(value as ReasoningLevel)}
      />
      <SegmentedControl
        icon={<LockKeyhole size={15} />}
        label={t.approval}
        options={[
          ["ask", t.ask],
          ["assist", t.assist],
          ["auto", t.auto],
        ]}
        value={approval}
        onChange={(value) => setApproval(value as ApprovalMode)}
      />
      <SegmentedControl
        icon={<Sparkles size={15} />}
        label={t.memory}
        options={[
          ["low", t.low],
          ["medium", t.medium],
          ["high", t.high],
        ]}
        value={memory}
        onChange={(value) => setMemory(value as MemoryLevel)}
      />
      <div className="settings-note">
        {language === "zh"
          ? "这些设置暂时影响 mock 总控策略，后续会映射到真实 Agent 参数。"
          : "These controls currently shape the mock controller and will map to real agent parameters later."}
      </div>
    </div>
  );
}

function SegmentedControl({
  icon,
  label,
  onChange,
  options,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
}) {
  return (
    <div className="setting-row">
      <div className="setting-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="segmented-control">
        {options.map(([id, text]) => (
          <button className={value === id ? "active" : ""} key={id} type="button" onClick={() => onChange(id)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OutputPreview({
  language,
  response,
  stage,
}: {
  language: Language;
  response: AgentResponse | null;
  stage: StageId;
}) {
  if (!response) {
    return <p className="muted">{language === "zh" ? "等待该阶段输出。" : "Waiting for this stage output."}</p>;
  }

  const payload = response.payload as Record<string, unknown>;
  const keys = Object.keys(payload);
  return (
    <div className="preview-list">
      <p>
        {language === "zh" ? "阶段" : "Stage"}：{stageLabel[language][stage]}
      </p>
      <p>
        {language === "zh" ? "自评分" : "Self score"}：{Math.round(response.self_review.overall_score * 100)}%
      </p>
      <p>
        {language === "zh" ? "写入字段" : "Written fields"}：{keys.join(", ")}
      </p>
    </div>
  );
}

function StateTreeModal({
  activeStage,
  language,
  onClose,
  setActiveStage,
  stages,
  t,
}: {
  activeStage: StageId;
  language: Language;
  onClose: () => void;
  setActiveStage: (stage: StageId) => void;
  stages: StageRun[];
  t: (typeof copy)[Language];
}) {
  const nodes = useMemo<FlowNode[]>(
    () =>
      stages.map((stage, index) => ({
        id: stage.id,
        type: "flowNode",
        position: { x: (index % 3) * 300, y: Math.floor(index / 3) * 210 + 70 },
        data: { stage, active: stage.id === activeStage, lang: language },
      })),
    [activeStage, language, stages],
  );

  const edges = useMemo<Edge[]>(
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

  return (
    <div className="modal-backdrop">
      <section className="tree-modal">
        <div className="modal-titlebar">
          <div>
            <p>{t.stateTree}</p>
            <h2>{t.fullTree}</h2>
          </div>
          <button className="close-button" type="button" onClick={onClose}>
            <X size={18} />
            {t.close}
          </button>
        </div>
        <div className="tree-canvas">
          <ReactFlow
            edges={edges}
            fitView
            maxZoom={1.1}
            minZoom={0.42}
            nodes={nodes}
            nodeTypes={flowNodeTypes}
            nodesDraggable={false}
            onNodeClick={(_, node) => setActiveStage(node.id as StageId)}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#d8dee7" gap={22} size={1} />
            <Controls position="bottom-right" showInteractive={false} />
          </ReactFlow>
        </div>
      </section>
    </div>
  );
}

function FlowNodeCard({ data }: NodeProps<FlowNode>) {
  const { active, lang, stage } = data;
  return (
    <button className={`flow-node ${stage.status} ${active ? "active" : ""}`} type="button">
      <Handle className="node-handle" position={Position.Left} type="target" />
      <span>{statusLabel[lang][stage.status]}</span>
      <strong>{stageLabel[lang][stage.id]}</strong>
      <small>{stageMeta[stage.id].allowedWrites.join(", ")}</small>
      <Handle className="node-handle" position={Position.Right} type="source" />
    </button>
  );
}

const flowNodeTypes = { flowNode: FlowNodeCard };

function ReviewModal({
  language,
  onApprove,
  onClose,
  onRetry,
  stage,
  t,
}: {
  language: Language;
  onApprove: () => void;
  onClose: () => void;
  onRetry: () => void;
  stage: StageRun;
  t: (typeof copy)[Language];
}) {
  return (
    <div className="modal-backdrop">
      <section className="review-modal">
        <div className="modal-titlebar">
          <div>
            <p>{t.reviewTitle}</p>
            <h2>{stageLabel[language][stage.id]}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="review-content">
          <p>{t.reviewBody}</p>
          <div className="review-score">
            <span>Self {stage.output ? Math.round(stage.output.self_review.overall_score * 100) : "--"}%</span>
            <span>Gate {stage.review ? Math.round(stage.review.overall_score * 100) : "--"}%</span>
          </div>
        </div>
        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onRetry}>
            {t.retry}
          </button>
          <button className="main-action" type="button" onClick={onApprove}>
            <CheckCircle2 size={17} />
            {t.continue}
          </button>
        </div>
      </section>
    </div>
  );
}

function JsonModal({ data, onClose, title }: { data: unknown; onClose: () => void; title: string }) {
  return (
    <div className="modal-backdrop">
      <section className="json-modal">
        <div className="modal-titlebar">
          <h2>{title}</h2>
          <button className="close-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <pre className="json-block">
          <code>{JSON.stringify(data, null, 2)}</code>
        </pre>
      </section>
    </div>
  );
}

function DocsPage({ language, t }: { language: Language; t: (typeof copy)[Language] }) {
  const items = [t.step1, t.step2, t.step3, t.step4];
  return (
    <section className="docs-page">
      <div className="docs-hero">
        <p>{t.docs}</p>
        <h2>{t.docsTitle}</h2>
        <span>{t.docsLead}</span>
      </div>
      <div className="docs-grid">
        {items.map((item) => (
          <article key={item}>
            <ChevronRight size={16} />
            <p>{item}</p>
          </article>
        ))}
      </div>
      <article className="docs-note">
        <Upload size={18} />
        <div>
          <strong>{language === "zh" ? "后端落地说明" : "Backend integration"}</strong>
          <p>{t.docBackend}</p>
        </div>
      </article>
    </section>
  );
}

export default App;
