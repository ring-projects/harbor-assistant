# Harbor Assistant Task 前端需求文档（FRD）

## 1. 文档信息

- 文档名称：Task Frontend Requirements Document
- 版本：v1.1
- 日期：2026-03-11
- 范围：项目内 Task 工作台（创建、列表、conversation events、follow-up、取消、重试）
- 依赖文档：
  - `/Users/qiuhao/workspace/harbor-assistant/docs/frd-frontend.md`
  - `/Users/qiuhao/workspace/harbor-assistant/docs/prd-executor-service.md`

---

## 2. 设计目标（Design Goals）

1. **单页面高效操作**
   - 在一个页面完成任务创建、查看、控制，不强制页面跳转。

2. **实时可感知**
   - 用户能快速看到任务是否开始、是否卡住、为什么失败。

3. **稳定可回溯**
   - 任务历史可定位，event stream 可连续查看，失败任务可重试。

4. **TypeScript-first**
   - 任务类型、状态、事件结构全部类型化，避免隐式字段。

5. **渐进演进**
   - v1 固定 `codex`，UI 预留扩展点但不提前复杂化。

---

## 3. 产品决策（已定）

1. Task 工作台采用**单页面结构**（列表 + conversation + diff 同页）。
2. v1 执行器固定为 `codex`，不提供执行器切换。
3. 当前任务列表不提供筛选器，默认按创建时间倒序展示。
4. 设置页默认模型仅做 mock 展示，不做持久化。
5. `followup` 在同一 thread 内继续执行，但**复用当前 task record**，不会新建 task。

---

## 4. 页面信息架构（Single Page IA）

建议在 `/:project_id` 的 task 工作台中采用三段布局：

1. **顶部控制区**
   - Sidebar Trigger
   - Settings 按钮

2. **左侧任务区**
   - 创建任务入口
   - 刷新按钮
   - 任务列表（默认按创建时间倒序）

3. **中间对话区**
   - 当前 task 的统一 conversation / event stream
   - follow-up 输入框
   - thread 标识

4. **右侧 diff 区**
   - 当前 task 的状态信息
   - diff / stdout / stderr 预览

---

## 5. 详细功能需求（Functional Requirements）

## 5.1 任务创建（TFR-001 ~ TFR-004）

### TFR-001 创建表单字段

必须包含：

1. `prompt`（必填，多行）
2. `model`（可选，字符串）
3. `executor`（固定值 `codex`，仅展示，不可切换）

### TFR-002 表单校验

1. prompt 去空后不能为空。
2. 提交中按钮禁用，避免重复提交。
3. 提交失败显示错误文案并保留用户输入。

### TFR-003 创建反馈

1. 创建成功后显示 `taskId` 或可点击任务项反馈。
2. 创建成功后任务列表自动刷新，并定位到新任务（优先）。

### TFR-004 创建埋点

1. `task_create_submitted`
2. `task_create_succeeded`
3. `task_create_failed`

---

## 5.2 任务列表（TFR-005 ~ TFR-008）

### TFR-005 列表项字段

每条任务至少展示：

1. taskId（可截断）
2. prompt 摘要（首行）
3. status
4. createdAt / startedAt / finishedAt（按可用性展示）
5. model（若有）

### TFR-006 列表排序

1. 默认按 `createdAt desc` 展示。
2. 新创建任务成功后应优先定位到该任务。

### TFR-007 列表状态

1. loading：skeleton
2. empty：无数据提示 + 创建引导
3. error：错误提示 + 重试按钮

### TFR-008 列表性能

1. 默认分页，避免一次性加载全部任务。
2. 列表更新不应导致 conversation / diff 区重置（除非当前任务被移除）。

---

## 5.3 Conversation 与详情（TFR-009 ~ TFR-015）

### TFR-009 Conversation 基础信息

conversation 区需展示：

1. taskId
2. threadId（若已存在）
3. 当前 task 的 agent events
4. follow-up 输入框

### TFR-010 Event 展示

1. 原始 agent event 按时间顺序展示。
2. event 需保留 `sequence` 与 `createdAt`。
3. 前端可以基于 eventType 做差异化视觉映射，但不改变原始数据语义。

### TFR-011 实时更新优先级

1. 优先 WebSocket：`/v1/ws/tasks`
2. WebSocket 不可用时回退 `GET /v1/tasks/:taskId/events`

### TFR-012 当前 task 终态识别

终态必须明确标识：

1. completed
2. failed
3. cancelled

并附带终态原因（若有）。

### TFR-013 Diff / 输出区

1. 右侧单独展示当前 task 的状态、退出码、开始/结束时间。
2. 优先提取 diff block。
3. 若无 diff，则回退展示 stdout / stderr 预览。

### TFR-014 Follow-up 交互语义

1. `followup` 继续使用同一 thread。
2. `followup` 不创建新的 task，而是复用当前 task record 继续执行。
3. 当 task 非终态时，不允许 follow-up。

### TFR-015 详情埋点

1. `task_detail_opened`
2. `task_log_stream_connected`
3. `task_log_stream_disconnected`

---

## 5.4 任务控制（TFR-016 ~ TFR-020）

### TFR-016 Break 当前 Turn

1. 仅 `running` 状态显示 `Break` 按钮。
2. `Break` 语义为“终止当前 turn”，不是销毁 task / thread。
3. 调用 break 接口后立即展示 pending 状态，最终收敛到终态。

### TFR-017 重试任务

1. 仅 `failed/cancelled` 状态显示重试按钮。
2. 若当前 task 存在 threadId，重试复用当前 task record 并恢复同一 thread。
3. 若当前 task 没有 threadId，重试允许退回创建新的 task。
3. UI 需清晰标识“重试来源”。

### TFR-018 操作失败处理

1. break/重试失败必须可见且可重试。
2. 不得 silent fail。

### TFR-019 并发操作保护

同一 task 在操作进行中，控制按钮应禁用，避免重复请求。

### TFR-020 控制埋点

1. `task_break_clicked`
2. `task_break_succeeded`
3. `task_break_failed`
4. `task_retry_clicked`
5. `task_retry_succeeded`
6. `task_retry_failed`

---

## 6. 接口与数据契约

## 6.1 v1 任务 API 依赖

1. `POST /v1/tasks`
2. `GET /v1/projects/:projectId/tasks`
3. `GET /v1/tasks/:taskId`
4. `GET /v1/tasks/:taskId/events`
5. `POST /v1/tasks/:taskId/followup`
6. `POST /v1/tasks/:taskId/break`
7. `POST /v1/tasks/:taskId/retry`

## 6.2 前端类型建议

1. `TaskStatus`
2. `TaskListItem`
3. `TaskDetail`
4. `TaskAgentEvent`
5. `TaskAgentEventStream`

建议使用 `zod` 定义响应 schema 并在前端解析。

---

## 7. 非功能需求（Task Frontend）

1. 首次打开任务页，列表首屏数据响应目标 < 1s（本地环境）。
2. 状态变化到 UI 可见延迟目标 < 1s（SSE）或 < 3s（轮询）。
3. conversation / 输出面板在 10k+ 行文本情况下仍可操作（通过分段/虚拟化策略）。
4. 错误文案需覆盖：网络失败、执行器不可用、参数错误、权限错误。

---

## 8. 验收标准（Task MVP）

1. 用户可在单页面完成创建任务、查看列表、查看 conversation、查看 diff。
2. 用户可在同一 thread 上 follow-up，并看到当前 task event stream 继续增长。
3. 用户可看到实时 event stream 或拉取降级更新。
4. 用户可取消 running/queued 任务并看到终态收敛。
5. 用户可重试失败任务，并按 thread 能力决定是复用当前 task 还是新建 task。
6. 页面在 loading/empty/error 三类状态下表现稳定。

---

## 9. 实施优先级

## P0（必须）

1. 单页面任务工作台落地
2. 创建 + 列表 + 详情 + 状态筛选 + 时间筛选
3. 日志实时展示（SSE 优先，轮询降级）
4. 取消与重试闭环

## P1（应有）

1. 日志复制与下载
2. 任务关键词搜索
3. 二次确认与更细粒度交互优化

## P2（后续）

1. 多 executor 切换
2. 高级过滤与视图自定义
3. 更丰富任务分析面板
