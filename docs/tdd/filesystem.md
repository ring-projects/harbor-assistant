# Filesystem TDD 红绿灯计划

## 1. 文档信息

- 文档名称：Filesystem TDD 红绿灯计划
- 日期：2026-03-24
- 状态：Proposed
- 适用范围：
  - `filesystem` context
  - `apps/service/src/modules/filesystem`
- 关联文档：
  - [../filesystem-context-design-2026-03-24.md](../filesystem-context-design-2026-03-24.md)
  - [../backend-lite-ddd-design-2026-03-24.md](../backend-lite-ddd-design-2026-03-24.md)

## 2. 目标

这份文档只规划新的 `filesystem` module 如何按 TDD 推进，不讨论 `project` 聚合，也不讨论 watcher、编辑器状态或 websocket。

核心目标有三个：

1. 把 `filesystem` 收敛成纯 root-scoped capability
2. 用测试先固定 path resolution 与 boundary enforcement 语义
3. 把 project-scoped file API 编排留到 `filesystem` module 之外

这里默认采用的设计前提是：

1. `filesystem` module 不接受 `projectId`
2. `filesystem` module 不依赖 `project`
3. `filesystem` module 接受 `rootPath` 与 `path`

## 3. TDD 总原则

新的 `filesystem` module 必须坚持一条底线：

先定义路径与文件访问语义测试，再写实现。

推荐顺序：

1. path policy / helper tests
2. application service tests
3. repository integration tests
4. project-scoped facade tests（如后续仍然保留）
5. HTTP route tests（仅在 API 形态稳定后补）

不建议的顺序：

1. 先从 `/projects/:id/files/...` 开始写
2. 先让 `filesystem` 依赖 `project` 再慢慢拆
3. 先做 write / delete，再回头补 read 语义和越界测试

原因很简单：

`filesystem` 的核心复杂度不在 route，而在路径规范化、越界判断、symlink 行为和错误映射。

## 4. 每一轮红绿灯怎么执行

后续每个 filesystem use case 都按同一模板推进，不允许跳步：

### 4.1 红灯

先写一个失败测试，只表达一个明确语义：

1. 输入是什么
2. rootPath 与 path 如何组合
3. 仓储依赖返回什么 stat / realpath / readFile 结果
4. 期望返回什么结构化结果或错误

### 4.2 绿灯

再补最小实现让测试通过：

1. 只写让当前失败测试变绿所需的最小代码
2. 不提前抽象未来 command 接口
3. 不在这一轮顺手做 facade / route / watcher

### 4.3 重构

测试变绿之后，再做必要重构：

1. 消除重复路径处理逻辑
2. 收紧错误分类
3. 收紧命名
4. 保持对外 contract 不变

重构阶段不允许：

1. 扩展边界
2. 引入 `projectId`
3. 把 facade 逻辑塞回 `filesystem` module

## 5. 测试分层

### 5.1 Path policy / helper tests

测试对象：

1. rootPath 与 requested path 的 resolve 规则
2. canonical path 是否仍在 root 内
3. cursor / limit 解析
4. hidden file policy
5. symlink 越界判断

这一层应该尽量纯函数化，不碰：

1. Fastify
2. Prisma
3. `project`
4. 真实数据库

### 5.2 Application tests

测试对象：

1. `ListDirectory`
2. `StatPath`
3. `ReadTextFile`
4. future `WriteTextFile`

这一层验证：

1. 输入是 `rootPath` + `path`
2. service 如何调用 filesystem repository
3. 系统错误如何映射为结构化 filesystem 错误
4. 不同路径场景下返回什么结果

### 5.3 Repository integration tests

测试对象：

1. node filesystem adapter
2. 在真实临时目录上的命令执行
3. realpath / lstat / readdir / readFile 的真实行为

这一层只验证：

1. 命令是否真的跑通
2. helper 假设是否与真实文件系统行为一致
3. symlink / hidden file / path traversal 假设是否成立

### 5.4 HTTP route tests（后置可选）

这一层当前不是第一轮核心范围。

只有在下面条件成立时才建议补：

1. root-scoped API 需要长期稳定对外
2. route 层有独立 schema / coercion / error mapping 价值
3. 上层不会很快废弃这组接口

### 5.5 Facade tests

测试对象：

1. `projectId -> rootPath` 的编排
2. 读取 project 后转调 root-scoped filesystem service
3. `PROJECT_NOT_FOUND` 与 filesystem 错误的边界分层

这层不属于 `filesystem` module 本体，但必须单独测试，不要混进 `filesystem` 内核测试中。

## 6. 红绿灯开发节奏

这里的“红绿灯”是指每一阶段都要遵守：

1. 先写失败测试
2. 再补最小实现让测试变绿
3. 最后做必要重构，不扩边界

### 6.1 第一盏灯：路径与边界纯逻辑

先写红灯测试：

1. 相对路径会被解析到 root 下
2. 绝对路径会被规范化后再校验
3. `..` 穿越 root 时会被拒绝
4. symlink 指向 root 外时会被拒绝
5. 非法 cursor / limit 会被稳定分类

变绿目标：

1. helper / path policy 纯函数通过
2. 不引入 service / repository 依赖

### 6.2 第二盏灯：root-scoped queries

先写红灯测试：

1. `ListDirectory(rootPath, path)` 在正常目录返回 entries
2. 不存在路径返回 `PATH_NOT_FOUND`
3. 越界路径返回 `PATH_OUTSIDE_ALLOWED_ROOT`
4. `StatPath(rootPath, path)` 返回 file / directory 元数据
5. `ReadTextFile(rootPath, path)` 返回文本内容
6. 目录传给 `ReadTextFile` 时返回 `NOT_A_FILE`

变绿目标：

1. service 输入只有 `rootPath` + `path`
2. service 不认识 `projectId`
3. service 错误全部收敛成 filesystem 错误

### 6.3 第三盏灯：write commands

这一盏灯可以放到 query 稳定之后。

先写红灯测试：

1. `WriteTextFile(rootPath, path, content)` 能写入文件
2. 越界写入返回 `PATH_OUTSIDE_ALLOWED_ROOT`
3. 目录目标返回 `NOT_A_FILE`
4. 无权限写入返回 `PERMISSION_DENIED`

变绿目标：

1. 写入路径清晰
2. 覆盖策略明确
3. 错误映射稳定

### 6.4 第四盏灯：真实文件系统集成

先写红灯测试：

1. 临时目录上能 list directory
2. 临时目录上能 stat file / directory
3. 临时目录上能 read text file
4. symlink 越界在真实文件系统中被拦下

变绿目标：

1. node filesystem adapter 稳定
2. helper 假设和真实文件系统行为一致

### 6.5 第五盏灯：project-scoped facade

这一盏灯只在外层仍保留 `/projects/:id/files/...` 时才存在。

先写红灯测试：

1. `/projects/:id/files/...` 先查 project，再调 root-scoped filesystem service
2. `projectId` 不存在时返回 `PROJECT_NOT_FOUND`
3. 项目存在但 path 越界时返回 filesystem 错误，而不是 project 错误

变绿目标：

1. project-scoped facade 成立
2. `filesystem` module 本体仍然完全不知道 `project`

### 6.6 第六盏灯：HTTP contract（仅在 API 稳定后补）

这一盏灯必须放最后，而且默认可跳过。

先写红灯测试：

1. root-scoped file route 返回正确 response
2. body / query 非法时 request validation 失败
3. response shape 稳定

变绿目标：

1. schema 正常工作
2. route 只是接线，不做路径语义判断
3. route 测试数量保持最小，不重复证明 filesystem 语义

## 7. 第一批优先开发项

建议先做下面这条最小路径：

1. `ListDirectory`
2. `StatPath`
3. `ReadTextFile`

原因：

1. 这三项都是 query
2. 风险比 write / delete 低
3. 它们已经能支撑大部分文件浏览、预览和调试能力

第一批不要急着做：

1. watcher
2. bulk write
3. project-scoped facade
4. delete / rename / move
5. HTTP contract

## 8. 分阶段验收清单

### 8.1 第一阶段验收

1. path policy 测试全部先红后绿
2. 出现第一版 `FileSystemError` 分类
3. 还没有真实 IO，也不阻塞进入下一阶段

### 8.2 第二阶段验收

1. `ListDirectory(rootPath, path)` 通过
2. `StatPath(rootPath, path)` 通过
3. `ReadTextFile(rootPath, path)` 通过
4. 所有输入都是 `rootPath` + `path`

### 8.3 第三阶段验收

1. `WriteTextFile` 如已进入范围，则具备结构化错误测试
2. 写入覆盖策略已明确
3. 权限错误有测试

### 8.4 第四阶段验收

1. 至少一组真实临时目录集成测试通过
2. symlink / hidden file / realpath 假设经过真实校验
3. node adapter 不再只是 fake

### 8.5 第五阶段验收

1. 如需 `/projects/:id/files/...`，它被单独视为 facade
2. facade 测试里才出现 `projectId`
3. `filesystem` module 本体仍不依赖 `project`

### 8.6 第六阶段验收

1. root-scoped route schema 稳定
2. request validation 覆盖非法 body / query / path
3. route 本身不含 filesystem 语义判断

## 9. 错误模型测试要求

新的 `filesystem` module 至少要把这些错误写成测试：

1. `INVALID_INPUT`
2. `PATH_NOT_FOUND`
3. `NOT_A_DIRECTORY`
4. `NOT_A_FILE`
5. `PATH_OUTSIDE_ALLOWED_ROOT`
6. `PERMISSION_DENIED`
7. `READ_FAILED`
8. `WRITE_FAILED`

关键点：

这些错误应该全部由 `filesystem` module 自己稳定产出，而不是留给 route 或外层调用方去猜。

## 10. 和 `project` 的测试边界

新的 `filesystem` TDD 必须守住一条规则：

`filesystem` module 的测试里，不出现 `projectId`。

一旦某个测试需要 `projectId`，那它已经不是 `filesystem` module 本体测试，而是 facade / orchestration 测试。

## 11. 建议开发顺序

推荐顺序：

1. 先补 path policy tests
2. 再补 root-scoped query service tests
3. 再做真实 filesystem repository integration tests
4. 如果需要 write，再补 command tests
5. 如果仍保留 project-scoped API，再单独做 facade tests
6. 只有在 API 形态稳定后，再补最小规模的 HTTP route tests

## 12. 第一轮验收标准

如果第一轮 TDD 做完，至少应该满足：

1. `filesystem` module 本体完全不依赖 `project`
2. 所有 service 输入都基于 `rootPath` + `path`
3. query 都有结构化错误测试
4. 至少一组真实临时目录 integration tests 通过

第一轮不要求：

1. HTTP route tests
2. request validation tests
3. `/projects/:id/files/...` facade tests
4. write / delete / rename / move

## 13. 最终结论

新的 `filesystem` TDD 规划只有一个核心原则：

```text
Root first, path safety first, facade later.
```

展开就是：

1. 先把 `filesystem` 做成纯 root-scoped capability
2. 先验证路径与边界语义，再扩展 read / write 能力
3. 把 `projectId -> rootPath` 的逻辑永远留在 `filesystem` module 外层

只要守住这条顺序，新的 `filesystem` module 就不会再次退化成旧实现那种“项目查询 + 文件访问 + route 编排”混杂在一起的形态。
