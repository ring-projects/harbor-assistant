# Harbor Assistant Task 前端需求文档（FRD）

## 1. 文档信息

- 文档名称：Task Frontend Requirements Document
- 版本：v1.0
- 日期：2026-03-05
- 范围：项目内 Task 工作台（创建、列表、详情、日志、取消、重试）
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
   - 任务历史可筛选、可定位，失败任务可重试。

4. **TypeScript-first**
   - 任务类型、状态、事件结构全部类型化，避免隐式字段。

5. **渐进演进**
   - v1 固定 `codex`，UI 预留扩展点但不提前复杂化。

---

## 3. 产品决策（已定）

1. Task 工作台采用**单页面结构**（列表 + 详情 + 创建表单同页）。
2. v1 执行器固定为 `codex`，不提供执行器切换。
3. 任务历史必须提供筛选能力（至少状态 + 时间范围）。
4. 设置页默认模型仅做 mock 展示，不做持久化。

---

## 4. 页面信息架构（Single Page IA）

建议在 `/:project_id` 的 progress 工作台中采用三段布局：

1. **顶部控制区**
   - 页面标题、刷新按钮、状态统计（queued/running/completed/failed/cancelled）

2. **左侧任务区**
   - 筛选器（状态、时间范围、关键词可选）
   - 任务列表（分页或无限加载）

3. **右侧详情区**
   - 任务基础信息（prompt、model、状态、时间）
   - 日志面板（stdout/stderr/系统事件）
   - 操作区（cancel/retry）

4. **创建任务区**
   - 可置于顶部抽屉、页内折叠区或详情上方固定表单（保持单页面原则）

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

## 5.2 任务列表与筛选（TFR-005 ~ TFR-009）

### TFR-005 列表项字段

每条任务至少展示：

1. taskId（可截断）
2. prompt 摘要（首行）
3. status
4. createdAt / startedAt / finishedAt（按可用性展示）
5. model（若有）

### TFR-006 状态筛选（必选）

支持多状态筛选或单选切换：

- queued
- running
- completed
- failed
- cancelled

### TFR-007 时间范围筛选（必选）

至少支持：

1. 最近 24 小时
2. 最近 7 天
3. 最近 30 天
4. 自定义范围（可在 v1.1）

### TFR-008 列表状态

1. loading：skeleton
2. empty：无数据提示 + 创建引导
3. error：错误提示 + 重试按钮

### TFR-009 列表性能

1. 默认分页，避免一次性加载全部任务。
2. 列表更新不应导致详情区重置（除非当前任务被移除）。

---

## 5.3 任务详情与日志（TFR-010 ~ TFR-015）

### TFR-010 详情基础信息

详情区需展示：

1. taskId
2. 状态与状态变更时间
3. prompt（可折叠展开）
4. model
5. 执行命令摘要（可选）

### TFR-011 日志展示

1. 支持 stdout 与 stderr 分区或标签切换。
2. 日志按时间顺序追加。
3. 支持“自动滚动到底部”开关。

### TFR-012 实时更新优先级

1. 优先 SSE：`GET /v1/tasks/:taskId/events`
2. SSE 不可用时回退轮询策略

### TFR-013 终态识别

终态必须明确标识：

1. completed
2. failed
3. cancelled

并附带终态原因（若有）。

### TFR-014 日志大文本策略

1. 对超长日志进行分段渲染（避免一次性渲染卡顿）。
2. 提供“复制日志”与“折叠历史”能力（P1）。

### TFR-015 详情埋点

1. `task_detail_opened`
2. `task_log_stream_connected`
3. `task_log_stream_disconnected`

---

## 5.4 任务控制（TFR-016 ~ TFR-020）

### TFR-016 取消任务

1. 仅 `queued/running` 状态显示取消按钮。
2. 用户点击后需二次确认（可选 P0，建议 P1）。
3. 调用取消接口后立即展示 pending 状态，最终收敛到终态。

### TFR-017 重试任务

1. 仅 `failed/cancelled` 状态显示重试按钮。
2. 重试成功生成新 run（或新 task，按后端契约展示关联）。
3. UI 需清晰标识“重试来源”。

### TFR-018 操作失败处理

1. 取消/重试失败必须可见且可重试。
2. 不得 silent fail。

### TFR-019 并发操作保护

同一 task 在操作进行中，控制按钮应禁用，避免重复请求。

### TFR-020 控制埋点

1. `task_cancel_clicked`
2. `task_cancel_succeeded`
3. `task_cancel_failed`
4. `task_retry_clicked`
5. `task_retry_succeeded`
6. `task_retry_failed`

---

## 6. 接口与数据契约

## 6.1 v1 任务 API 依赖

1. `POST /v1/tasks`
2. `GET /v1/projects/:projectId/tasks`
3. `GET /v1/tasks/:taskId`
4. `GET /v1/tasks/:taskId/events`（SSE）
5. `POST /v1/tasks/:taskId/cancel`
6. `POST /v1/tasks/:taskId/retry`

## 6.2 前端类型建议

1. `TaskStatus`
2. `TaskListItem`
3. `TaskDetail`
4. `TaskEvent`
5. `TaskFilter`

建议使用 `zod` 定义响应 schema 并在前端解析。

---

## 7. 非功能需求（Task Frontend）

1. 首次打开任务页，列表首屏数据响应目标 < 1s（本地环境）。
2. 状态变化到 UI 可见延迟目标 < 1s（SSE）或 < 3s（轮询）。
3. 日志面板在 10k+ 行文本情况下仍可操作（通过分段/虚拟化策略）。
4. 错误文案需覆盖：网络失败、执行器不可用、参数错误、权限错误。

---

## 8. 验收标准（Task MVP）

1. 用户可在单页面完成创建任务、查看列表、查看详情。
2. 用户可按状态和时间范围筛选任务历史。
3. 用户可看到实时日志或轮询降级日志更新。
4. 用户可取消 running/queued 任务并看到终态收敛。
5. 用户可重试失败任务并看到新 run 结果。
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

