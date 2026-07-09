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
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileJson,
  Globe2,
  HelpCircle,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Paperclip,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  createAgentResponse,
  createInitialContext,
  createInitialStages,
  createReviewRecord,
  createStageInput,
  createVersion,
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
type MessageKind = "user" | "agent" | "controller";
type MenuId = "reasoning" | "approval" | "memory" | null;

type FlowNode = Node<{ stage: StageRun; active: boolean; lang: Language }, "flowNode">;

interface ThreadMessage {
  id: string;
  kind: MessageKind;
  stage?: StageId;
  body?: string;
  response?: AgentResponse | null;
  review?: ReviewRecord | null;
  status?: StageRun["status"];
  needsApproval?: boolean;
  revisionNote?: string;
  createdAt: string;
}

interface PickerOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const makeMessageId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

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
    final_review: "总控最终输出",
  },
  en: {
    question_understanding: "Question",
    knowledge_integration: "Knowledge",
    hypothesis_generation: "Hypothesis",
    evidence_mapping: "Evidence",
    research_planning: "Plan",
    final_review: "Final output",
  },
};

const stagePurpose: Record<Language, Record<StageId, string>> = {
  zh: {
    question_understanding: "把原始问题转成可检索、可验证、可迭代的 question_card。",
    knowledge_integration: "整理文献卡片、证据卡片和知识空白。",
    hypothesis_generation: "基于证据和知识空白生成候选科学假设。",
    evidence_mapping: "把候选假设和支持、反对、不确定证据绑定。",
    research_planning: "输出变量、数据、方法、指标、失败判据和反馈任务。",
    final_review: "总控检查完整 task_context，给出最终可交付结果。",
  },
  en: {
    question_understanding: "Turns the raw question into a searchable and testable question card.",
    knowledge_integration: "Builds literature cards, evidence cards, and knowledge gaps.",
    hypothesis_generation: "Generates candidate scientific hypotheses from evidence and gaps.",
    evidence_mapping: "Binds each hypothesis to supporting, opposing, and uncertain evidence.",
    research_planning: "Creates variables, data, methods, metrics, falsification criteria, and feedback tasks.",
    final_review: "Checks the full task context and produces the final controller result.",
  },
};

const statusLabel: Record<Language, Record<string, string>> = {
  zh: {
    queued: "等待",
    running: "运行中",
    validating: "校验中",
    human_review: "待审批",
    passed: "已通过",
    failed: "失败",
    retrying: "重跑中",
    created: "待开始",
    completed: "已完成",
  },
  en: {
    queued: "Queued",
    running: "Running",
    validating: "Validating",
    human_review: "Needs approval",
    passed: "Passed",
    failed: "Failed",
    retrying: "Retrying",
    created: "Ready",
    completed: "Done",
  },
};

const copy = {
  zh: {
    appName: "灵光闭环",
    appSub: "EurekaLoop",
    productHint: "多智能体科研总控",
    workbench: "工作台",
    docs: "使用文档",
    language: "中文",
    questionPlaceholder: "从一个科学问题开始",
    addFile: "添加文件等内容",
    noFiles: "未添加文件",
    start: "启动总控",
    running: "运行中",
    newTask: "新任务",
    stateTree: "状态树",
    fullTree: "完整可视化状态树",
    close: "退出",
    progress: "进度",
    iteration: "轮次",
    currentStage: "当前阶段",
    reasoning: "推理",
    approval: "访问权限",
    memory: "记忆",
    low: "低",
    medium: "中",
    high: "高",
    ultra: "超高",
    ask: "请求批准",
    assist: "替我审批",
    auto: "完全访问",
    approveContinue: "批准继续",
    revise: "提交修改并重跑",
    revisePlaceholder: "写下你不满意的地方，系统会把这段意见交给当前模块重新输出。",
    json: "查看 JSON",
    gatePassed: "总控校验通过，已写回 task_context。",
    gateWaiting: "总控需要你确认后再进入下一阶段。",
    retryQueued: "已收到修改意见，正在重跑当前模块。",
    userQuestion: "科学问题",
    userRevision: "修改建议",
    controllerStarted: "总控已创建任务，并按当前策略调度各模块。",
    emptyThread: "等待新的科研问题。",
    docsTitle: "EurekaLoop 使用文档",
    docsLead: "这个 demo 先做前端闭环：输入问题、选择总控策略、查看每个 Agent 输出、在消息尾部审批或要求重跑，最后得到总控最终输出。",
    doc1: "输入一个科学问题，左下角 + 可以附加文件或背景材料。",
    doc2: "在输入框下方选择推理强度、访问权限和记忆能力。",
    doc3: "启动后，每个模块都会在对话记录中输出自己的结果。",
    doc4: "需要审批时，按钮出现在对应模块消息的结尾；不满意就写修改意见并重跑。",
    doc5: "总控最终输出会作为最后一条控制器消息出现，可打开 JSON 追踪完整结构。",
    backendTitle: "后端落地",
    backendText: "后续把 mock 调度替换为 POST /api/tasks、/start、/reviews、/feedback 与 SSE 事件流即可；Artifact Service 继续负责文件、快照和日志。",
  },
  en: {
    appName: "EurekaLoop",
    appSub: "灵光闭环",
    productHint: "Multi-agent research controller",
    workbench: "Workbench",
    docs: "Guide",
    language: "English",
    questionPlaceholder: "Start with a scientific question",
    addFile: "Add files or context",
    noFiles: "No files attached",
    start: "Start controller",
    running: "Running",
    newTask: "New task",
    stateTree: "State tree",
    fullTree: "Full visual state tree",
    close: "Close",
    progress: "Progress",
    iteration: "Round",
    currentStage: "Current stage",
    reasoning: "Reasoning",
    approval: "Access",
    memory: "Memory",
    low: "Low",
    medium: "Medium",
    high: "High",
    ultra: "Ultra",
    ask: "Ask approval",
    assist: "Approve for me",
    auto: "Full access",
    approveContinue: "Approve and continue",
    revise: "Revise and rerun",
    revisePlaceholder: "Describe what should improve. The current module will rerun with this feedback.",
    json: "View JSON",
    gatePassed: "Controller validation passed and wrote the payload into task_context.",
    gateWaiting: "The controller needs your approval before moving on.",
    retryQueued: "Feedback received. The current module is rerunning.",
    userQuestion: "Scientific question",
    userRevision: "Revision note",
    controllerStarted: "The controller created a task and started routing modules with the selected policy.",
    emptyThread: "Waiting for a scientific question.",
    docsTitle: "EurekaLoop Guide",
    docsLead: "This demo focuses on the frontend loop: ask a question, choose controller policy, inspect every Agent output, approve or rerun inside the message, and finish with the controller output.",
    doc1: "Enter a scientific question. Use + to attach files or background context.",
    doc2: "Choose reasoning, access, and memory from the controls below the composer.",
    doc3: "After start, every module writes its output into the conversation thread.",
    doc4: "Approval buttons appear at the end of the related module message; add feedback and rerun if needed.",
    doc5: "The final controller output appears as the last controller message, with JSON available for tracing.",
    backendTitle: "Backend path",
    backendText: "Later, replace the mock runner with POST /api/tasks, /start, /reviews, /feedback and an SSE event stream; Artifact Service keeps handling files, snapshots, and logs.",
  },
};

function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const [page, setPage] = useState<PageId>("workbench");
  const [reasoning, setReasoning] = useState<ReasoningLevel>("ultra");
  const [approval, setApproval] = useState<ApprovalMode>("assist");
  const [memory, setMemory] = useState<MemoryLevel>("medium");
  const [openMenu, setOpenMenu] = useState<MenuId>(null);
  const [context, setContext] = useState<TaskContext>(() => createInitialContext("hybrid"));
  const [stages, setStages] = useState<StageRun[]>(() => createInitialStages(createInitialContext("hybrid")));
  const [events, setEvents] = useState<EventLog[]>(seedEvents);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [activeStage, setActiveStage] = useState<StageId>("question_understanding");
  const [running, setRunning] = useState(false);
  const [reviewStage, setReviewStage] = useState<StageId | null>(null);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState<{ title: string; data: unknown } | null>(null);
  const [questionDraft, setQuestionDraft] = useState("");
  const [hasSubmittedQuestion, setHasSubmittedQuestion] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const t = copy[language];
  const runMode = approvalToRunMode[approval];
  const completedCount = stages.filter((stage) => stage.status === "passed").length;
  const finished = context.current_stage === "completed";
  const progress = Math.round((completedCount / stages.length) * 100);
  const currentStageLabel = finished ? statusLabel[language].completed : stageLabel[language][activeStage];
  const uploadedLabel = files.length ? files.join(", ") : t.noFiles;
  const latestEvent = events[0]?.message;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, running]);

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

  const pushMessage = useCallback((message: Omit<ThreadMessage, "id" | "createdAt">) => {
    const id = makeMessageId(message.kind);
    setMessages((current) => [...current, { ...message, id, createdAt: new Date().toISOString() }]);
    return id;
  }, []);

  const patchMessage = useCallback((id: string, patch: Partial<ThreadMessage>) => {
    setMessages((current) => current.map((message) => (message.id === id ? { ...message, ...patch } : message)));
  }, []);

  const updateStage = useCallback((stageId: StageId, patch: Partial<StageRun>) => {
    setStages((current) => current.map((stage) => (stage.id === stageId ? { ...stage, ...patch } : stage)));
  }, []);

  const buildFreshTask = useCallback(
    (question: string) => {
      const base = createInitialContext(runMode);
      return {
        ...base,
        user_input: {
          ...base.user_input,
          original_question: question,
          user_constraints: {
            ...base.user_input.user_constraints,
            language: language === "zh" ? "zh-CN" : "en-US",
          },
        },
      };
    },
    [language, runMode],
  );

  const resetDemo = useCallback(() => {
    const fresh = createInitialContext(runMode);
    setRunning(false);
    setContext(fresh);
    setStages(createInitialStages(fresh));
    setEvents(seedEvents);
    setVersions([]);
    setMessages([]);
    setQuestionDraft("");
    setHasSubmittedQuestion(false);
    setFiles([]);
    setReviewStage(null);
    setPendingIndex(null);
    setFeedbackDrafts({});
    setActiveStage("question_understanding");
  }, [runMode]);

  const continueFrom = useCallback(
    async (startIndex: number, inputContext: TaskContext, inputVersions: VersionRecord[], revisionNote?: string) => {
      let workingContext = inputContext;
      let workingVersions = inputVersions;

      for (let index = startIndex; index < stageOrder.length; index += 1) {
        const stage = stageOrder[index];
        const input = createStageInput(stage, workingContext);
        const startTime = performance.now();
        const messageId = pushMessage({
          kind: stage === "final_review" ? "controller" : "agent",
          stage,
          status: "running",
          response: null,
          review: null,
          needsApproval: false,
          revisionNote: index === startIndex ? revisionNote : undefined,
        });

        setActiveStage(stage);
        setContext((current) => ({ ...current, current_stage: stage }));
        updateStage(stage, { status: "running", input, output: null, review: null, duration: "0.0s" });
        appendEvent("stage_started", `${stageLabel.zh[stage]}开始执行。`, `${stageLabel.en[stage]} started.`, stage);
        await delay(430);

        const response = createAgentResponse(stage, workingContext.task_id);
        updateStage(stage, {
          status: "validating",
          output: response,
          duration: `${((performance.now() - startTime) / 1000).toFixed(1)}s`,
        });
        patchMessage(messageId, { status: "validating", response });
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
        patchMessage(messageId, {
          status: needsHuman ? "human_review" : "passed",
          review,
          needsApproval: needsHuman,
        });
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
      appendEvent("task_completed", "总控最终审核通过，闭环完成。", "Final controller review passed. Loop completed.", "final_review");
    },
    [appendEvent, patchMessage, pushMessage, runMode, updateStage],
  );

  const startDemo = useCallback(async () => {
    const question = questionDraft.trim();
    if (running || !question) return;

    const fresh = buildFreshTask(question);
    setRunning(true);
    setContext(fresh);
    setStages(createInitialStages(fresh));
    setVersions([]);
    setMessages([]);
    setEvents([
      {
        event_id: "evt_seed_001",
        task_id: "task_001",
        type: "task_created",
        message: language === "zh" ? "任务已创建，等待启动总控。" : "Task created. Controller is ready.",
        created_at: new Date().toISOString(),
      },
    ]);
    setReviewStage(null);
    setPendingIndex(null);
    setActiveStage("question_understanding");
    setHasSubmittedQuestion(true);
    setQuestionDraft("");

    pushMessage({ kind: "user", body: question });
    pushMessage({ kind: "controller", body: t.controllerStarted, status: "passed" });
    appendEvent(
      "task_started",
      `总控已启动：推理 ${reasoning}，权限 ${approval}，记忆 ${memory}。`,
      `Controller started: reasoning ${reasoning}, access ${approval}, memory ${memory}.`,
    );
    await continueFrom(0, fresh, []);
  }, [appendEvent, approval, buildFreshTask, continueFrom, language, memory, pushMessage, questionDraft, reasoning, running, t.controllerStarted]);

  const approveReview = useCallback(async () => {
    if (!reviewStage || pendingIndex === null || running) return;
    const stage = reviewStage;
    const stageRun = stages.find((item) => item.id === stage);
    if (!stageRun?.output) return;

    const approvedReview: ReviewRecord = {
      ...createReviewRecord(stage, "accept"),
      operator: "human",
      comment: language === "zh" ? "人工审批通过，继续进入下一阶段。" : "Human approval granted. Continue.",
    };

    updateStage(stage, { status: "passed", review: approvedReview });
    setMessages((current) =>
      current.map((message) =>
        message.stage === stage && message.needsApproval
          ? { ...message, status: "passed", review: approvedReview, needsApproval: false }
          : message,
      ),
    );
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

  const rerunStageWithFeedback = useCallback(
    async (stage: StageId, sourceMessageId: string) => {
      if (running) return;
      const index = stageOrder.indexOf(stage);
      if (index < 0) return;
      const note = feedbackDrafts[sourceMessageId]?.trim() || (language === "zh" ? "请重新检查并改进这一阶段输出。" : "Please re-check and improve this stage output.");

      pushMessage({ kind: "user", body: note, stage });
      setMessages((current) =>
        current.map((message) =>
          message.stage === stage && message.needsApproval
            ? { ...message, status: "retrying", needsApproval: false, revisionNote: note }
            : message,
        ),
      );
      setFeedbackDrafts((current) => ({ ...current, [sourceMessageId]: "" }));
      setReviewStage(null);
      setPendingIndex(null);
      updateStage(stage, { status: "retrying", review: createReviewRecord(stage, "retry") });
      appendEvent("stage_retry_requested", `${stageLabel.zh[stage]}收到修改意见，准备重跑。`, `${stageLabel.en[stage]} received feedback and will rerun.`, stage);

      setRunning(true);
      await delay(320);
      await continueFrom(index, context, versions, note);
    },
    [appendEvent, context, continueFrom, feedbackDrafts, language, pushMessage, running, updateStage, versions],
  );

  const activeStageRun = stages.find((stage) => stage.id === activeStage) ?? stages[0];

  return (
    <div className="app-shell">
      <MessageIndexRail language={language} messages={messages} />

      <aside className="control-rail">
        <div className="brand-row">
          <span className="brand-mark">
            <Bot size={18} />
          </span>
          <div>
            <strong>{t.appName}</strong>
            <small>{t.appSub} · {t.productHint}</small>
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
          <button className="language-button" type="button" onClick={() => setLanguage(language === "zh" ? "en" : "zh")}>
            <Globe2 size={15} />
            {language === "zh" ? "EN" : "中文"}
          </button>
        </nav>

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
        </section>

        <section className="task-meter" aria-label={language === "zh" ? "任务状态" : "Task status"}>
          <div>
            <span>{t.currentStage}</span>
            <strong>{currentStageLabel}</strong>
          </div>
          <div className="meter-grid">
            <StatusMetric label={t.progress} value={`${progress}%`} />
            <StatusMetric label={t.iteration} value={`R${context.iteration}`} />
          </div>
          {latestEvent ? <p className="latest-event">{latestEvent}</p> : null}
          <button className="ghost-button" type="button" onClick={resetDemo}>
            <RotateCcw size={15} />
            {t.newTask}
          </button>
        </section>
      </aside>

      <main className="thread-shell">
        {page === "workbench" ? (
          <>
            <header className="thread-header">
              <div>
                <p>{t.appSub}</p>
                <h1>{t.appName}</h1>
              </div>
              <span className={`state-chip ${activeStageRun.status}`}>{statusLabel[language][activeStageRun.status]}</span>
            </header>

            <section className="thread-area" aria-label={language === "zh" ? "对话记录" : "Conversation"}>
              {messages.length === 0 ? (
                <div className="empty-thread">
                  <Sparkles size={18} />
                  <span>{t.emptyThread}</span>
                </div>
              ) : null}

              <div className="message-list">
                {messages.map((message) => (
                  <ThreadMessageCard
                    feedbackValue={feedbackDrafts[message.id] ?? ""}
                    key={message.id}
                    language={language}
                    message={message}
                    onApprove={approveReview}
                    onFeedbackChange={(value) => setFeedbackDrafts((current) => ({ ...current, [message.id]: value }))}
                    onOpenJson={(title, data) => setJsonOpen({ title, data })}
                    onRerun={() => message.stage && rerunStageWithFeedback(message.stage, message.id)}
                    onSelectStage={(stage) => setActiveStage(stage)}
                    running={running}
                    t={t}
                  />
                ))}
                <div ref={threadEndRef} />
              </div>
            </section>

            <section className="composer-shell">
              <div className="composer">
                <textarea
                  aria-label={t.questionPlaceholder}
                  disabled={running || context.current_stage === "human_review"}
                  onChange={(event) => setQuestionDraft(event.target.value)}
                  placeholder={!hasSubmittedQuestion ? t.questionPlaceholder : ""}
                  value={questionDraft}
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

                  <span className="file-hint" title={uploadedLabel}>
                    <Paperclip size={14} />
                    {uploadedLabel}
                  </span>

                  <ControllerSettings
                    approval={approval}
                    language={language}
                    memory={memory}
                    openMenu={openMenu}
                    reasoning={reasoning}
                    setApproval={setApproval}
                    setMemory={setMemory}
                    setOpenMenu={setOpenMenu}
                    setReasoning={setReasoning}
                    t={t}
                  />

                  <button
                    className="send-button"
                    disabled={running || context.current_stage === "human_review" || !questionDraft.trim()}
                    type="button"
                    onClick={startDemo}
                    title={t.start}
                  >
                    {running ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
                  </button>
                </div>
              </div>
            </section>
          </>
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

      {jsonOpen ? (
        <JsonModal data={jsonOpen.data} onClose={() => setJsonOpen(null)} title={jsonOpen.title} />
      ) : null}
    </div>
  );
}

function MessageIndexRail({ language, messages }: { language: Language; messages: ThreadMessage[] }) {
  return (
    <aside className="message-index" aria-label={language === "zh" ? "消息索引" : "Message index"}>
      <div className="index-stack">
        {messages.map((message, index) => {
          const label = getMessageTitle(message, language);
          return (
            <button
              aria-label={label}
              className={`index-tick ${message.kind} ${message.status ?? ""}`}
              key={message.id}
              type="button"
              onClick={() => document.getElementById(message.id)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            >
              <span />
              <strong>{String(index + 1).padStart(2, "0")}</strong>
              <em>{label}</em>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function ControllerSettings({
  approval,
  language,
  memory,
  openMenu,
  reasoning,
  setApproval,
  setMemory,
  setOpenMenu,
  setReasoning,
  t,
}: {
  approval: ApprovalMode;
  language: Language;
  memory: MemoryLevel;
  openMenu: MenuId;
  reasoning: ReasoningLevel;
  setApproval: (value: ApprovalMode) => void;
  setMemory: (value: MemoryLevel) => void;
  setOpenMenu: (value: MenuId) => void;
  setReasoning: (value: ReasoningLevel) => void;
  t: (typeof copy)[Language];
}) {
  const reasoningOptions: Array<PickerOption<ReasoningLevel>> = [
    { value: "low", label: t.low },
    { value: "medium", label: t.medium },
    { value: "high", label: t.high },
    { value: "ultra", label: t.ultra },
  ];
  const approvalOptions: Array<PickerOption<ApprovalMode>> = [
    {
      value: "ask",
      label: t.ask,
      description: language === "zh" ? "编辑外部文件和使用互联网时始终询问" : "Always ask before editing external files or using the internet",
    },
    {
      value: "assist",
      label: t.assist,
      description: language === "zh" ? "仅对检测到的风险操作请求批准" : "Ask only for detected risky operations",
    },
    {
      value: "auto",
      label: t.auto,
      description: language === "zh" ? "可不受限制地访问互联网和您电脑上的任何文件" : "Allow unrestricted internet and local file access",
    },
  ];
  const memoryOptions: Array<PickerOption<MemoryLevel>> = [
    { value: "low", label: t.low, description: language === "zh" ? "只保留当前任务必要上下文" : "Keep only essential context" },
    { value: "medium", label: t.medium, description: language === "zh" ? "保留阶段摘要和关键反馈" : "Keep stage summaries and key feedback" },
    { value: "high", label: t.high, description: language === "zh" ? "保留更完整的版本和证据历史" : "Keep fuller version and evidence history" },
  ];

  return (
    <div className="codex-controls">
      <DropdownControl
        className="reasoning-control"
        footerLabel="GPT-5.5"
        icon={<Brain size={15} />}
        id="reasoning"
        label={`${language === "zh" ? "5.5" : "5.5"} ${reasoningOptions.find((option) => option.value === reasoning)?.label ?? ""}`}
        menuLabel={t.reasoning}
        onChange={setReasoning}
        onOpenChange={setOpenMenu}
        open={openMenu === "reasoning"}
        options={reasoningOptions}
        value={reasoning}
      />
      <DropdownControl
        className="memory-control"
        icon={<Sparkles size={15} />}
        id="memory"
        label={`${t.memory} ${memoryOptions.find((option) => option.value === memory)?.label ?? ""}`}
        menuLabel={t.memory}
        onChange={setMemory}
        onOpenChange={setOpenMenu}
        open={openMenu === "memory"}
        options={memoryOptions}
        value={memory}
      />
      <DropdownControl
        className="access-control"
        icon={<LockKeyhole size={15} />}
        id="approval"
        label={approvalOptions.find((option) => option.value === approval)?.label ?? t.approval}
        menuLabel={language === "zh" ? "应如何批准操作？" : "How should operations be approved?"}
        onChange={setApproval}
        onOpenChange={setOpenMenu}
        open={openMenu === "approval"}
        options={approvalOptions}
        value={approval}
      />
    </div>
  );
}

function DropdownControl<T extends string>({
  className,
  footerLabel,
  icon,
  id,
  label,
  menuLabel,
  onChange,
  onOpenChange,
  open,
  options,
  value,
}: {
  className?: string;
  footerLabel?: string;
  icon: ReactNode;
  id: Exclude<MenuId, null>;
  label: string;
  menuLabel: string;
  onChange: (value: T) => void;
  onOpenChange: (value: MenuId) => void;
  open: boolean;
  options: Array<PickerOption<T>>;
  value: T;
}) {
  return (
    <div className={`dropdown-control ${className ?? ""}`}>
      <button className="dropdown-trigger" type="button" onClick={() => onOpenChange(open ? null : id)}>
        {icon}
        <span>{label}</span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="dropdown-menu">
          <p>{menuLabel}</p>
          {options.map((option) => (
            <button
              className={value === option.value ? "selected" : ""}
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                onOpenChange(null);
              }}
            >
              <span>
                <strong>{option.label}</strong>
                {option.description ? <small>{option.description}</small> : null}
              </span>
              {value === option.value ? <Check size={17} /> : null}
            </button>
          ))}
          {footerLabel ? (
            <button className="menu-footer" type="button" onClick={() => onOpenChange(null)}>
              <span>{footerLabel}</span>
              <ChevronRight size={15} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ThreadMessageCard({
  feedbackValue,
  language,
  message,
  onApprove,
  onFeedbackChange,
  onOpenJson,
  onRerun,
  onSelectStage,
  running,
  t,
}: {
  feedbackValue: string;
  language: Language;
  message: ThreadMessage;
  onApprove: () => void;
  onFeedbackChange: (value: string) => void;
  onOpenJson: (title: string, data: unknown) => void;
  onRerun: () => void;
  onSelectStage: (stage: StageId) => void;
  running: boolean;
  t: (typeof copy)[Language];
}) {
  if (message.kind === "user") {
    return (
      <article className="thread-message user-message" id={message.id}>
        <div className="message-avatar">你</div>
        <div className="message-bubble">
          <header>
            <strong>{message.stage ? t.userRevision : t.userQuestion}</strong>
            <time>{formatTime(message.createdAt)}</time>
          </header>
          <p>{message.body}</p>
        </div>
      </article>
    );
  }

  const title = getMessageTitle(message, language);
  const stage = message.stage;

  return (
    <article className={`thread-message ${message.kind}-message ${message.status ?? ""}`} id={message.id}>
      <div className="message-avatar">{message.kind === "controller" ? <Bot size={17} /> : <Sparkles size={17} />}</div>
      <div className="message-bubble">
        <header>
          <div>
            <strong>{title}</strong>
            {stage ? <small>{stageMeta[stage].agent}</small> : null}
          </div>
          <span className={`state-chip ${message.status ?? "queued"}`}>{statusLabel[language][message.status ?? "queued"]}</span>
        </header>

        {message.body ? <p className="message-copy">{message.body}</p> : null}
        {stage && message.revisionNote ? (
          <p className="revision-note">
            {language === "zh" ? "本次重跑依据：" : "Rerun note:"} {message.revisionNote}
          </p>
        ) : null}
        {stage ? (
          <button className="stage-purpose" type="button" onClick={() => onSelectStage(stage)}>
            <Clock3 size={14} />
            {stagePurpose[language][stage]}
          </button>
        ) : null}

        {stage ? <AgentOutput language={language} response={message.response ?? null} stage={stage} /> : null}

        {stage && message.response ? (
          <footer className="message-footer">
            <div className="score-row">
              <span>Self {Math.round(message.response.self_review.overall_score * 100)}%</span>
              <span>Gate {message.review ? Math.round(message.review.overall_score * 100) : "--"}%</span>
              <span>{stageMeta[stage].allowedWrites.join(", ")}</span>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() =>
                onOpenJson(language === "zh" ? `${stageLabel.zh[stage]} JSON` : `${stageLabel.en[stage]} JSON`, {
                  stage,
                  output: message.response,
                  review: message.review,
                })
              }
            >
              <FileJson size={15} />
              {t.json}
            </button>
          </footer>
        ) : null}

        {message.needsApproval && stage ? (
          <section className="inline-review">
            <p>{t.gateWaiting}</p>
            <div className="review-actions">
              <button className="main-action" disabled={running} type="button" onClick={onApprove}>
                <CheckCircle2 size={16} />
                {t.approveContinue}
              </button>
            </div>
            <div className="revision-composer">
              <textarea
                disabled={running}
                onChange={(event) => onFeedbackChange(event.target.value)}
                placeholder={t.revisePlaceholder}
                value={feedbackValue}
              />
              <button className="ghost-button" disabled={running} type="button" onClick={onRerun}>
                {t.revise}
              </button>
            </div>
          </section>
        ) : stage && message.status === "passed" ? (
          <p className="gate-note">{t.gatePassed}</p>
        ) : stage && message.status === "retrying" ? (
          <p className="gate-note">{t.retryQueued}</p>
        ) : null}
      </div>
    </article>
  );
}

function AgentOutput({ language, response, stage }: { language: Language; response: AgentResponse | null; stage: StageId }) {
  if (!response) {
    return (
      <div className="output-skeleton">
        <Loader2 className="spin" size={16} />
        <span>{language === "zh" ? "正在生成模块输出..." : "Generating module output..."}</span>
      </div>
    );
  }

  const payload = response.payload as Record<string, unknown>;

  if (stage === "question_understanding") {
    const card = payload.question_card as Record<string, unknown>;
    return (
      <div className="module-output">
        <KeyValue label={language === "zh" ? "核心问题" : "Core question"} value={stringValue(card.core_question)} />
        <PillList label={language === "zh" ? "研究领域" : "Domains"} values={arrayValue(card.domain)} />
        <PillList label={language === "zh" ? "关键变量" : "Key variables"} values={arrayValue(card.key_variables).map((item) => objectName(item))} />
        <BulletList label={language === "zh" ? "拆解子问题" : "Sub-questions"} values={arrayValue(card.sub_questions).map((item) => objectField(item, "content"))} />
      </div>
    );
  }

  if (stage === "knowledge_integration") {
    return (
      <div className="module-output">
        <BulletList
          label={language === "zh" ? "文献卡片" : "Literature cards"}
          values={arrayValue(payload.literature_cards).map((item) => `${objectField(item, "title")} · ${objectField(item, "year")}`)}
        />
        <BulletList label={language === "zh" ? "证据卡片" : "Evidence cards"} values={arrayValue(payload.evidence_cards).map((item) => objectField(item, "claim"))} />
        <BulletList label={language === "zh" ? "知识空白" : "Knowledge gaps"} values={arrayValue(payload.knowledge_gaps).map((item) => objectField(item, "description"))} />
      </div>
    );
  }

  if (stage === "hypothesis_generation") {
    return (
      <div className="module-output">
        {arrayValue(payload.hypothesis_cards).map((item, index) => (
          <article className="hypothesis-card" key={`${objectField(item, "hypothesis_id")}-${index}`}>
            <strong>{objectField(item, "hypothesis_id")}</strong>
            <p>{objectField(item, "statement")}</p>
            <small>{objectField(item, "validation_idea")}</small>
          </article>
        ))}
      </div>
    );
  }

  if (stage === "evidence_mapping") {
    return (
      <div className="module-output">
        {arrayValue(payload.evidence_map).map((item, index) => (
          <article className="evidence-card" key={`${objectField(item, "hypothesis_id")}-${index}`}>
            <strong>{objectField(item, "hypothesis_id")}</strong>
            <p>{objectField(item, "evidence_summary.support")}</p>
            <div className="evidence-grid">
              <span>{language === "zh" ? "支持" : "Support"} {arrayValue(objectValue(item, "supporting_evidence_ids")).join(", ")}</span>
              <span>{language === "zh" ? "反对" : "Oppose"} {arrayValue(objectValue(item, "opposing_evidence_ids")).join(", ") || "--"}</span>
              <span>{language === "zh" ? "强度" : "Strength"} {Math.round(numberValue(objectValue(item, "evidence_strength_score")) * 100)}%</span>
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (stage === "research_planning") {
    const plan = ((payload.research_plan as Record<string, unknown>)?.plans as Array<Record<string, unknown>> | undefined)?.[0]?.plan as Record<string, unknown> | undefined;
    return (
      <div className="module-output">
        <KeyValue label={language === "zh" ? "研究问题" : "Problem"} value={stringValue(plan?.problem_statement)} />
        <PillList label={language === "zh" ? "方法" : "Methods"} values={arrayValue(objectValue(plan?.technical_details, "required_methods"))} />
        <PillList label={language === "zh" ? "数据字段" : "Data fields"} values={arrayValue((objectValue(plan?.datasets, "target") as Array<Record<string, unknown>> | undefined)?.[0]?.fields)} />
        <BulletList label={language === "zh" ? "失败判据" : "Falsification criteria"} values={arrayValue(objectValue(plan?.results, "falsification_criteria"))} />
        <BulletList label={language === "zh" ? "反馈任务" : "Feedback tasks"} values={arrayValue(plan?.feedback_tasks).map((item) => objectField(item, "objective"))} />
      </div>
    );
  }

  const finalReview = payload.final_review as Record<string, unknown>;
  return (
    <div className="module-output final-output">
      <KeyValue label={language === "zh" ? "总评分" : "Overall score"} value={`${Math.round(numberValue(finalReview.overall_score) * 100)}%`} />
      <BulletList label={language === "zh" ? "优势" : "Strengths"} values={arrayValue(finalReview.strengths)} />
      <BulletList label={language === "zh" ? "不足" : "Weaknesses"} values={arrayValue(finalReview.weaknesses)} />
      <KeyValue label={language === "zh" ? "是否需要修订" : "Revision required"} value={finalReview.revision_required ? "Yes" : language === "zh" ? "否" : "No"} />
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="key-value">
      <span>{label}</span>
      <p>{value || "--"}</p>
    </div>
  );
}

function PillList({ label, values }: { label: string; values: unknown[] }) {
  return (
    <div className="output-section">
      <span>{label}</span>
      <div className="pill-list">
        {values.length ? values.map((value, index) => <b key={`${String(value)}-${index}`}>{String(value)}</b>) : <b>--</b>}
      </div>
    </div>
  );
}

function BulletList({ label, values }: { label: string; values: unknown[] }) {
  return (
    <div className="output-section">
      <span>{label}</span>
      <ul>
        {values.length ? values.map((value, index) => <li key={`${String(value)}-${index}`}>{String(value)}</li>) : <li>--</li>}
      </ul>
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
  const items = [t.doc1, t.doc2, t.doc3, t.doc4, t.doc5];
  return (
    <section className="docs-page">
      <div className="docs-hero">
        <p>{language === "zh" ? "使用文档" : "Guide"}</p>
        <h2>{t.docsTitle}</h2>
        <span>{t.docsLead}</span>
      </div>
      <div className="docs-list">
        {items.map((item, index) => (
          <article key={item}>
            <b>{index + 1}</b>
            <p>{item}</p>
          </article>
        ))}
      </div>
      <article className="docs-note">
        <Upload size={18} />
        <div>
          <strong>{t.backendTitle}</strong>
          <p>{t.backendText}</p>
        </div>
      </article>
    </section>
  );
}

function getMessageTitle(message: ThreadMessage, language: Language) {
  if (message.kind === "user") {
    return message.stage ? copy[language].userRevision : copy[language].userQuestion;
  }
  if (!message.stage) {
    return language === "zh" ? "总控" : "Controller";
  }
  if (message.stage === "final_review") {
    return stageLabel[language].final_review;
  }
  return language === "zh" ? `${stageLabel.zh[message.stage]} Agent 输出` : `${stageLabel.en[message.stage]} Agent output`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function objectValue(source: unknown, key: string): unknown {
  if (!source || typeof source !== "object") return undefined;
  const parts = key.split(".");
  let current: unknown = source;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function objectField(source: unknown, key: string): string {
  return stringValue(objectValue(source, key));
}

function objectName(source: unknown): string {
  return objectField(source, "name") || stringValue(source);
}

export default App;
