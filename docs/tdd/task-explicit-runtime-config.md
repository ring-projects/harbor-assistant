# TDD Plan for Task Explicit Runtime Config

## 1. 文档信息

- 文档名称：TDD Plan for Task Explicit Runtime Config
- 日期：2026-03-30
- 状态：Reference
- 适用范围：
  - `apps/service/src/modules/project`
  - `apps/service/src/modules/task`
  - `apps/web/src/modules/tasks`
- 关联文档：
  - [../task-explicit-runtime-config-requirements-2026-03-30.md](../task-explicit-runtime-config-requirements-2026-03-30.md)
  - [../task-api.md](../task-api.md)
  - [./task.md](./task.md)
  - [./task-effort.md](./task-effort.md)

## 2. 目标

这份 TDD 文档只规划“删除 project runtime 默认配置，并让 create task 显式传入完整 runtime config”如何按红灯 / 绿灯推进。

核心目标：

1. 先锁后端 contract
2. 再删除 project fallback
3. 再收敛 create use case
4. 最后接前端默认预选与提交行为

## 3. 测试推进原则

1. 先从后端 domain / application / route 测试入手
2. 先证明旧行为被拒绝，再实现新行为
3. 先锁 create contract，再删 project fallback
4. 前端测试只验证“进入页面即可拥有明确值并成功提交”，不验证视觉细节

## 4. 红绿灯顺序总览

1. 第一盏灯：project 默认 execution 设置改为 `null`
2. 第二盏灯：create route schema 强制完整 runtime config
3. 第三盏灯：create use case 删除 project / hardcoded fallback
4. 第四盏灯：runtime 组合校验继续成立
5. 第五盏灯：前端 create composer 初始化明确 runtime 值
6. 第六盏灯：前端不再提交 `default / auto / null` 语义

## 5. 后端测试计划

### 5.1 第一盏灯：project 默认 execution 设置改为 `null`

#### 红灯

新增 / 调整 project domain 测试，断言：

1. 新建 project 后 `defaultExecutor === null`
2. 新建 project 后 `defaultModel === null`
3. 新建 project 后 `defaultExecutionMode === null`

同时调整 project mapper 测试，断言：

1. 当数据库字段为空时，不再回填 `codex`
2. 当数据库字段为空时，不再回填 `safe`

#### 绿灯

修改：

1. `apps/service/src/modules/project/domain/project.ts`
2. `apps/service/src/modules/project/infrastructure/persistence/project-mapper.ts`

直到 project 相关测试通过。

### 5.2 第二盏灯：create route schema 强制完整 runtime config

#### 红灯

新增 / 调整 route 测试，断言以下请求返回 4xx：

1. 缺失 `executor`
2. 缺失 `model`
3. 缺失 `effort`
4. 缺失 `executionMode`

并保留一条成功路径，断言完整请求仍可创建 task。

#### 绿灯

修改：

1. `apps/service/src/modules/task/schemas/task.schema.ts`
2. `apps/service/src/modules/task/routes/task.routes.test.ts`

直到 route schema 行为符合新 contract。

### 5.3 第三盏灯：create use case 删除 fallback

#### 红灯

新增 / 调整 create use case 测试，断言：

1. create 不再从 project.settings.defaultExecutor 取值
2. create 不再从 project.settings.defaultModel 取值
3. create 不再从 project.settings.defaultExecutionMode 取值
4. create 不再从硬编码 `codex` / `safe` 取值
5. create 请求若未提供完整 runtime config，则直接失败

#### 绿灯

修改：

1. `apps/service/src/modules/task/application/create-task.ts`
2. `apps/service/src/modules/task/application/task.use-cases.test.ts`

直到 create use case 仅依赖请求显式传入的 runtime config。

### 5.4 第四盏灯：runtime 校验继续成立

#### 红灯

保留并补充以下测试：

1. 非法 executor 仍被拒绝
2. 非法 model 仍被拒绝
3. 非法 effort / model 组合仍被拒绝
4. 合法组合仍成功创建 task

#### 绿灯

尽量不扩大实现面，只确认：

1. `validateTaskRuntimeConfig()` 继续工作
2. 删除 fallback 后，校验仍基于显式传入值执行

## 6. 前端测试计划

### 6.1 第五盏灯：create composer 初始化明确 runtime 值

#### 红灯

新增 / 调整前端测试，断言：

1. 打开 create dialog 时，已经有明确 `executor`
2. 打开 create dialog 时，已经有明确 `model`
3. 打开 create dialog 时，已经有明确 `effort`
4. 打开 create dialog 时，已经有明确 `executionMode`

这里不要求用户手动选择后才能提交。

#### 绿灯

修改：

1. `apps/web/src/modules/tasks/features/task-create/components/task-create-dialog.tsx`
2. 对应组件测试文件

直到 create composer 初始化即持有完整 runtime config。

### 6.2 第六盏灯：前端不再提交 `default / auto / null`

#### 红灯

新增 / 调整前端 API / mutation 测试，断言 create 请求：

1. 总是发送具体 `executor`
2. 总是发送具体 `model`
3. 总是发送具体 `effort`
4. 总是发送具体 `executionMode`
5. 不再发送 `runtime-default`、`Provider Default`、`null` 作为 create runtime 语义

#### 绿灯

修改：

1. `apps/web/src/modules/tasks/api/task-api-client.ts`
2. `apps/web/src/modules/tasks/hooks/use-task-queries.ts`
3. `apps/web/src/modules/tasks/features/task-create/components/task-create-dialog.tsx`
4. 相关测试文件

## 7. 回归检查

在所有灯都变绿后，回归检查如下：

1. create task 仍可成功启动 runtime
2. task detail / task list 中 runtime 字段为明确值
3. resume task 不受 create contract 收敛影响
4. 前端不再出现 `default / auto` 文案

## 8. 实施顺序建议

推荐按下面顺序提交改动：

1. project domain / mapper
2. create schema / route tests
3. create use case / application tests
4. 前端 create 默认预选与提交
5. 文案与展示收尾

这样可以避免前后端同时大面积悬空。
