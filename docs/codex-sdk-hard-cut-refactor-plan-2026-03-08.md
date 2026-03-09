# Codex SDK Hard-Cut 重构方案（无旧方式遗留）

日期：2026-03-08  
适用范围：`@harbor/service` + `@harbor/web` 任务执行与会话模块  
目标：用 **Codex SDK** 替换当前 CLI/本地文件推导链路，确保后续功能开发建立在统一、可持续的线程化执行模型上。

---

## 1. 背景与目标

当前任务系统以 `spawn codex exec --json` 为核心执行路径，辅以本地文件与 sqlite 扫描来推断会话。该方案在 MVP 可用，但对“持续会话、可维护扩展、可观测一致性”不友好。

本方案采用 **Hard Cut**：  
- 直接切到 SDK 执行路径  
- 不保留旧的 CLI 主路径  
- 不保留 rollout/session 文件解析主路径  
- 不保留 legacy tasks.json 运行时导入主路径

---

## 2. 现状审阅结论（关键事实）

### 2.1 执行链路（现状）
- 当前 runner 直接启动 CLI：`apps/service/src/modules/tasks/task-runner.service.ts`
- 线程信息依赖 stdout JSON 行解析（`session_meta`）
- `retry` 仅复用 prompt 创建新 task，不是线程级 follow-up

### 2.2 会话链路（现状）
- conversation 读取依赖：
  - `task_events` 中记录的 `codex-session`
  - 本地 `~/.codex/sessions` rollout 文件解析
  - 本地 `~/.codex/state_*.sqlite` 回查 thread/rollout
- 回放属于“推导结果”，不是服务一手写入数据

### 2.3 遗留兼容（现状）
- repository 每次读写会触发 legacy `tasks.json` 导入保护逻辑
- 线程快照会被导入为伪 task（`codex-thread:*`）
- 配置中仍保留 `task.dataFile`（legacy）入口

---

## 3. 重构原则（必须遵守）

1. **单执行路径**：服务端只允许 SDK 作为 Codex 执行入口  
2. **单事实来源**：会话消息以服务数据库为准，不从 rollout 文件推导  
3. **线程一等公民**：thread/session 成为显式数据模型  
4. **可追踪可恢复**：任务状态、消息、错误、运行记录均可回放  
5. **移除遗留而非共存**：旧逻辑在验收后直接删除

---

## 4. 目标架构（To-Be）

`TaskService -> CodexSdkGateway -> SDK stream events -> Repository(DB)`

### 4.1 后端核心
- 新增 SDK 网关模块（建议 `modules/tasks/codex-sdk.gateway.ts`）
- 统一封装：
  - `startThreadAndRun(...)`
  - `resumeThreadAndRun(...)`
  - `runStreamed(...)`（统一事件落库）

### 4.2 数据层核心
- conversation 直接读 `TaskMessage`（或同等消息表）
- `Task` 绑定 `threadId`
- `TaskRun` 保留执行生命周期事件（状态、失败原因、耗时等）

### 4.3 前端核心
- Chat 面板改为“上方消息内滚动 + 下方固定输入框”
- 发送 follow-up 不再创建“伪新会话任务”，而是同线程续聊

---

## 5. 分阶段实施计划（严格顺序）

## Phase 1：Schema 与契约升级（先立地基）

### 5.1 数据模型变更
- Prisma 新增（命名可微调）：
  - `TaskThread`（thread 元数据）
  - `TaskMessage`（role/content/timestamp/source）
- `Task` 新增：
  - `threadId`（FK）
  - `parentTaskId`（可选，用于链路展示）

### 5.2 API 契约变更（先定义）
- 保留：`POST /v1/tasks`（创建并运行第一轮）
- 新增：`POST /v1/tasks/:taskId/followup`
- 保留：`GET /v1/tasks/:taskId/conversation`（但实现改为 DB 读取）

### 5.3 迁移策略
- 提供 DB migration（前向）
- legacy 字段先“读兼容”，写路径全部走新模型

---

## Phase 2：SDK 网关接入（替换执行内核）

### 5.4 服务依赖
- `apps/service/package.json` 增加 `@openai/codex-sdk`

### 5.5 Runner 重写
- 以 SDK 事件流替换 `spawn codex exec`
- 线程创建/恢复通过 SDK API 实现
- 执行状态流转：
  - queued -> running -> completed/failed/cancelled

### 5.6 错误与中断
- 统一 SDK 错误映射到 `failureCode/failureMessage`
- 明确 cancel 行为（若 SDK 有 abort 则直连；否则定义服务级策略）

---

## Phase 3：会话读写重构（脱离本地 rollout）

### 5.7 Conversation 写入
- SDK 每轮产生的 user/assistant/system 消息，写入 `TaskMessage`
- 按 `threadId + turn` 保证顺序与幂等

### 5.8 Conversation 读取
- `readTaskConversation` 改为纯 DB 实现
- 删除对 `~/.codex/sessions` 和 `state_*.sqlite` 的运行时依赖

---

## Phase 4：接口与前端联动

### 5.9 Service Routes
- 增加 `followup` route + service handler
- `retry` 语义重定：
  - 可选 A：同线程“重试该轮”
  - 可选 B：同线程“再提交同 prompt”

### 5.10 Web 侧
- `task-api-client.ts` 增加 follow-up API
- `use-task-queries.ts` 增加 follow-up mutation
- `task-workbench.tsx` 的 Chat 面板增加 composer（固定底部）

---

## Phase 5：删除遗留（Hard Cut 核心）

以下内容在新链路稳定后直接移除：

1. `task-runner.service.ts` 中 CLI spawn 执行主逻辑  
2. `task-conversation.service.ts` 中 rollout 文件解析逻辑  
3. `codex-thread-index.service.ts` 与线程快照导入链路  
4. `task.repository.ts` 中运行时 legacy `tasks.json` 导入逻辑  
5. 旧的分散配置入口（现已删除），统一收敛到 `src/config.ts`

---

## 6. 验收标准（Definition of Done）

### 6.1 功能验收
- 创建任务可成功执行并落库 thread/messages
- Chat follow-up 可在同 thread 连续对话
- conversation API 仅来自 DB，重启服务不丢会话
- retry/cancel 行为符合新语义定义

### 6.2 清理验收（必须通过）
运行以下检查应不再命中“旧主链路”：

- `rg "spawn\\(|codex exec|session_meta|rollout_path|state_.*\\.sqlite|tasks\\.json" apps/service/src/modules/tasks -S`

允许残留仅限：历史迁移脚本、归档文档，不得在运行链路调用。

### 6.3 稳定性验收
- `bun run lint:service`
- `bun run typecheck:service`
- 关键集成测试/手工回归（create/followup/cancel/retry/conversation）

---

## 7. 风险与缓解

1. **SDK 事件语义与当前事件模型不一致**  
   - 缓解：引入事件适配层，内部统一成 Domain Event，再落库。

2. **取消能力实现差异**  
   - 缓解：先定义契约（可取消状态 + 错误码），能力不足时明确降级语义。

3. **迁移期前后端契约不一致**  
   - 缓解：先扩展 API，再切换前端调用，最后删除旧字段。

---

## 8. 建议执行节奏（新 session 可直接照做）

1. 先做 Phase 1 + migration（不改行为）  
2. 再做 Phase 2（SDK 接管 create）  
3. 再做 Phase 3（conversation 改 DB）  
4. 再做 Phase 4（follow-up + Chat composer）  
5. 最后做 Phase 5（删除旧逻辑）  

每阶段完成后都跑 `lint/typecheck`，并做最小手工回归。

---

## 9. 本文用途

此文档用于新 session 的重构启动基线。  
执行时应以“无遗留旧方式”为硬约束，不接受双轨长期共存。
