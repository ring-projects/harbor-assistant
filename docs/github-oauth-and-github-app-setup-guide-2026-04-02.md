# GitHub OAuth 与 GitHub App 设置说明

## 1. 文档信息

- 文档名称：GitHub OAuth 与 GitHub App 设置说明
- 日期：2026-04-02
- 状态：Reference
- 适用场景：
  - 需要在 GitHub 中创建 OAuth App，用于“GitHub 登录”
  - 需要在 GitHub 中创建 GitHub App，用于“仓库访问、安装授权、installation token”
  - Harbor 或类似服务需要同时接入“用户身份”和“私有仓库访问”两条能力
- 参考来源：
  - GitHub Docs: Creating an OAuth app
  - GitHub Docs: Authorizing OAuth apps
  - GitHub Docs: Registering a GitHub App
  - GitHub Docs: About the setup URL
  - GitHub Docs: About the user authorization callback URL
  - GitHub Docs: Managing private keys for GitHub Apps
  - GitHub Docs: Installing your own GitHub App
  - GitHub Docs: Authenticating as a GitHub App installation

## 2. 先说结论

GitHub 里有两类常见应用接入形态：

1. `OAuth App`
   - 主要解决“让用户用 GitHub 账号登录你的系统”
   - 核心产物是 `client_id` 和 `client_secret`
   - 典型流程是用户授权后，你用 `code` 换取用户 access token
2. `GitHub App`
   - 主要解决“让你的服务以更细粒度、更安全的方式访问 GitHub 资源”
   - 核心产物是 `App ID`、`private key`、`installation`
   - 典型流程是 App 被安装到个人账号或组织后，服务端按 installation 动态换取短期 token

如果你的产品同时需要：

1. 让用户用 GitHub 登录
2. 读取或拉取 GitHub 私有仓库

推荐的职责分工通常是：

```text
OAuth App 负责登录。
GitHub App 负责仓库访问。
```

不要默认把“登录”和“仓库授权”混成一个流程。

## 3. 两者的核心区别

| 维度 | OAuth App | GitHub App |
| --- | --- | --- |
| 主要用途 | 用户登录、代表用户调用 API | 服务级集成、仓库访问、自动化 |
| 权限模型 | 基于 `scope`，粒度较粗 | 基于细粒度 permissions，粒度更细 |
| 仓库访问控制 | 通常按用户 token 权限走 | 按 installation 与仓库范围走 |
| token 生命周期 | 常见是用户 access token | 常见是短期 installation token |
| 仓库选择 | 一般不够精细 | 可选全部仓库或指定仓库 |
| 是否适合私有仓库服务集成 | 一般不如 GitHub App | 更适合 |
| 是否适合单纯登录 | 非常适合 | 可以做，但通常没必要 |

GitHub 官方文档当前也明确更推荐 GitHub App，因为它：

1. 权限更细
2. 仓库访问控制更强
3. token 更短期

## 4. 什么时候用 OAuth，什么时候用 GitHub App

### 4.1 适合用 OAuth App 的场景

1. 你只想做“使用 GitHub 登录”
2. 你只需要读取 GitHub 基本身份信息
3. 你不希望引入 installation、private key、setup URL 这些额外概念

### 4.2 适合用 GitHub App 的场景

1. 你要读私有仓库
2. 你要做仓库级授权控制
3. 你希望访问权限和用户个人长期 token 解耦
4. 你未来可能做自动化能力，比如同步、PR、checks、webhook

### 4.3 Harbor 这类系统的推荐做法

如果系统像 Harbor 一样既有“登录”又有“私有仓库访问”需求，推荐：

1. `OAuth App` 只做登录
2. `GitHub App` 单独做 repo access

这样边界最清晰。

## 5. 如何在 GitHub 中设置 OAuth App

### 5.1 创建入口

GitHub 官方当前路径是：

1. 登录 GitHub
2. 右上角头像
3. `Settings`
4. 左侧 `Developer settings`
5. `OAuth apps`
6. 点击 `New OAuth App`

如果你之前从未创建过应用，按钮文案可能会显示为 `Register a new application`。

### 5.2 可以创建在什么地方

根据 GitHub 官方文档，OAuth App 可以创建在：

1. 你的个人账号下
2. 你具有管理权限的组织下

如果你只是自己用，放个人账号下通常就够了。  
如果它是团队服务的一部分，通常更适合放在组织下。

### 5.3 创建时需要填写的字段

创建 OAuth App 时，GitHub 会要求至少填写这些信息：

1. `Application name`
   - 应用名称
   - 这是用户授权时会看到的名字
2. `Homepage URL`
   - 应用主页地址
   - 例如：`https://harbor.example.com`
3. `Application description`
   - 可选
   - 用户授权页可能会看到
4. `Authorization callback URL`
   - OAuth 授权完成后 GitHub 重定向回来的地址
   - 例如：`https://api.example.com/v1/auth/github/callback`
5. `Enable Device Flow`
   - 可选
   - 主要给无浏览器或受限输入设备场景使用

### 5.4 每个字段怎么理解

#### `Application name`

建议填：

1. 对用户可识别的产品名
2. 最好带环境区分

例如：

1. `Harbor`
2. `Harbor Staging`

#### `Homepage URL`

建议填：

1. 用户实际访问产品的 Web 地址
2. 不要填只在内网可见、又不希望公开暴露的信息

GitHub 官方明确提醒：OAuth App 中不要放你认为敏感的信息。

#### `Authorization callback URL`

这是最关键的字段之一。

用户在 GitHub 完成授权后，会被重定向回这个 URL。你的服务端需要在这个地址：

1. 校验 `state`
2. 读取 `code`
3. 用 `code` 换 token
4. 读取用户信息
5. 创建你自己的登录态

常见示例：

```text
https://api.example.com/v1/auth/github/callback
http://localhost:5173/v1/auth/github/callback
```

### 5.5 OAuth App 的几个重要限制

#### 只能配置一个 callback URL

GitHub 官方当前文档明确指出：

1. OAuth App 不能像 GitHub App 那样配置多个 callback URL
2. 这意味着多环境时需要提前规划

常见处理方式：

1. 开发环境一个 OAuth App
2. 生产环境一个 OAuth App

不要指望一个 OAuth App 同时优雅覆盖本地、staging、production 三套回调地址。

#### 用户必须验证邮箱后才能授权 OAuth App

GitHub 官方文档提到，用户需要先验证自己的邮箱地址，才能授权 OAuth App。

### 5.6 创建后的关键凭据

创建成功后，你会看到：

1. `Client ID`
2. `Client Secret`

其中：

1. `Client ID` 可以暴露给前端跳转拼接授权 URL
2. `Client Secret` 只能保存在服务端

不要把 `Client Secret`：

1. 写到前端代码
2. 写到浏览器环境变量
3. 放到公开仓库

### 5.7 一个标准 OAuth 登录流程

如果你只想做 GitHub 登录，典型流程是：

1. 前端请求你的后端，例如 `GET /auth/github/start`
2. 后端生成 `state`
3. 后端重定向到 GitHub 授权页
4. GitHub 授权后回调到你的 `Authorization callback URL`
5. 后端用 `code` 换 access token
6. 后端调用 GitHub API 读取用户信息
7. 后端创建自己系统的 session
8. 后端再重定向回前端

### 5.8 OAuth App 最常见的坑

1. `callback URL` 配错
   - 路径、协议、端口、域名任何一个不一致都可能失败
2. `state` 没校验
   - 会留下 CSRF 风险
3. 把 GitHub access token 直接当自己系统的登录态
   - 不推荐
4. 为了登录直接申请过大的 scope
   - 比如为了“只是登录”就申请私有仓库权限
5. 想用一个 OAuth App 同时覆盖多个环境
   - 现实里经常会造成回调管理混乱

## 6. 如何在 GitHub 中设置 GitHub App

### 6.1 创建入口

GitHub 官方当前路径是：

1. 登录 GitHub
2. 右上角头像
3. 对个人账号：`Settings`
4. 对组织账号：进入组织后点 `Settings`
5. 左侧 `Developer settings`
6. `GitHub Apps`
7. 点击 `New GitHub App`

### 6.2 可以创建在什么地方

根据 GitHub 官方文档，GitHub App 可以创建在：

1. 个人账号下
2. 你拥有的组织下
3. 已授予你“管理所有 apps”权限的组织下

GitHub 当前还提到：

1. 一个用户或组织最多可以注册 100 个 GitHub App
2. 但一个账号可安装的 GitHub App 数量没有这个限制

### 6.3 GitHub App 创建时常见字段

GitHub App 的配置项比 OAuth App 多，常见重点项包括：

1. `GitHub App name`
2. `Homepage URL`
3. `Description`
4. `Callback URL`
5. `Request user authorization (OAuth) during installation`
6. `Enable Device Flow`
7. `Setup URL`
8. `Redirect on update`
9. `Webhook URL`
10. `Webhook secret`
11. Repository permissions
12. Organization permissions
13. Account permissions

### 6.4 最容易混淆的三个 URL

#### `Homepage URL`

这是应用主页，不是授权回调地址，也不是安装完成后的跳转地址。

#### `Callback URL`

这是“用户授权 GitHub App”时的回调地址。  
它只在你需要“以用户身份”生成 user access token 的场景下重要。

GitHub 官方说明：

1. GitHub App 最多可以配置 10 个 callback URL
2. 如果你配置了多个 callback URL，可以通过 `redirect_uri` 指定本次授权用哪个
3. 如果不指定，会使用第一个

这点和 OAuth App 很不一样。

#### `Setup URL`

这是“用户安装 GitHub App 完成后”的跳转地址。

它用于：

1. 安装完成后把用户带回你的系统
2. 提示后续步骤
3. 做安装后的业务绑定

这是 GitHub App 里非常常用的一个字段，尤其适合：

1. 让用户安装 App 后返回 Harbor
2. Harbor 记录 installation
3. 继续做 repo 选择或绑定

### 6.5 `Setup URL` 和 `Callback URL` 的区别

区别非常重要：

1. `Setup URL`
   - 用户安装 GitHub App 之后跳转回来
   - 面向“安装完成后的接入流程”
2. `Callback URL`
   - 用户授权 GitHub App 时跳转回来
   - 面向“用户授权 flow”

如果你只是想：

1. 安装 GitHub App
2. 让 Harbor 拿 installation token
3. 访问私有仓库

很多时候你更关注的是 `Setup URL`，而不是 `Callback URL`。

### 6.6 一个重要约束：请求用户授权时，不能再填 Setup URL

GitHub 官方当前文档说明：

1. 如果你勾选了 `Request user authorization (OAuth) during installation`
2. 那么你就不能再填写 `Setup URL`
3. 用户会走 callback URL 这条授权流

所以你需要先决定你的核心产品流是什么：

1. 如果你主要要做“安装后回到你的系统继续配置”
   - 优先保留 `Setup URL`
2. 如果你必须在安装时同时拿用户授权
   - 就走 `Callback URL`

对 Harbor 这类“服务端 repo access”场景，通常更常见的是：

1. 关注 installation
2. 关注 setup URL
3. 不强依赖“安装时的用户授权”

### 6.7 Webhook 如何理解

GitHub App 默认就很适合 webhook 驱动场景。

配置时通常会看到：

1. `Webhook URL`
2. `Webhook secret`

作用是：

1. GitHub 把安装、仓库、权限变更等事件推给你的服务
2. 你的服务用 `Webhook secret` 验签

如果你第一版只想先做：

1. 安装
2. 列仓库
3. clone/fetch

理论上可以先不依赖 webhook 驱动主流程。  
但如果你以后想自动感知：

1. installation 被删除
2. repo 被移出授权范围
3. repo 被 rename / transfer

webhook 会非常有用。

### 6.8 GitHub App 权限怎么配

这是 GitHub App 最核心的部分之一。

GitHub App 不是用大 scope，而是用细粒度 permissions。

如果你的目标是“列仓库 + 读取仓库信息 + clone/fetch 私有仓库”，推荐从最小权限开始：

1. `Repository permissions -> Metadata: Read-only`
2. `Repository permissions -> Contents: Read-only`

除非你真的需要，否则先不要开：

1. Pull requests: write
2. Issues: write
3. Administration: write
4. Checks: write

### 6.9 选择安装范围

GitHub 官方安装流程中，如果 App 申请了 repository permissions，安装时通常会让你选择：

1. `All repositories`
2. `Only select repositories`

如果是 Harbor 这种服务，通常更建议：

1. 先用 `Only select repositories`
2. 只给它真正需要访问的仓库

这样权限面更小。

### 6.10 GitHub App 创建后的关键凭据

创建成功后，最关键的几个值通常是：

1. `App ID`
2. `Client ID`
3. `Client Secret`
4. `Webhook secret`
5. `Private key`

其中最重要的是 `Private key`。

GitHub 官方说明：

1. GitHub App 创建后，需要生成 private key，才能以 app 身份认证
2. 你用它签 JWT，再去换 installation token
3. GitHub 最多允许一个 App 维护 25 个 private keys
4. private key 不会自动过期，需要你主动轮换或删除

### 6.11 如何生成 private key

GitHub 官方当前路径是：

1. 进入该 GitHub App 设置页
2. 找到 `Private keys`
3. 点击 `Generate a private key`
4. GitHub 会下载一个 PEM 文件到本地

注意：

1. GitHub 只保存公钥部分
2. 私钥文件你自己必须保存好
3. 丢了就重新生成
4. 泄露了就立即吊销并轮换

### 6.12 private key 应该怎么存

GitHub 官方建议重点是：

1. 不要把 private key 硬编码进代码
2. 更推荐放到 key vault 或 secret manager
3. 如果只能放环境变量，也要把它当高敏感密钥管理

对大多数服务端项目，至少应该做到：

1. 放服务端密钥管理系统或安全环境变量
2. 不进入前端
3. 不写日志
4. 不写进仓库

### 6.13 安装 GitHub App 的流程

创建完 GitHub App 后，还不等于它已经能访问仓库。

你还需要安装它。

GitHub 官方当前路径一般是：

1. 进入 GitHub App 设置页
2. 点击 `Install App`
3. 选择安装到哪个账号或组织
4. 选择 `All repositories` 或 `Only select repositories`
5. 点击安装

如果这是你自己创建的 App：

1. 如果它的可见性是 `Only on this account`
   - 只能安装到创建它的那个账号
2. 如果是 `Any account`
   - 可以安装到你控制的其他账号

### 6.14 安装完成后会拿到什么

安装完成后，最关键的概念是：

1. `installation`
2. `installation_id`

之后你的服务端可以：

1. 用 App private key 签 JWT
2. 以 App 身份请求 installation token
3. 再以 installation token 访问该 installation 范围内的资源

这就是 GitHub App 最核心的服务端访问模型。

### 6.15 一个重要安全提醒：不要盲信 setup URL 带回来的 installation_id

GitHub 官方文档明确提醒：

1. 用户安装完成后跳转到 `Setup URL` 时，GitHub 会带上 `installation_id`
2. 但你不能只因为 URL 上有这个参数就完全信任它

原因是：

1. 恶意方可以伪造请求命中你的 setup URL

更稳妥的做法是：

1. 回到服务端再校验 installation 是否真实存在
2. 确认 installation 和当前用户/当前安装上下文确实匹配

## 7. OAuth App 与 GitHub App 的推荐填写示例

### 7.1 OAuth App 示例

适用于“GitHub 登录”：

- `Application name`: `Harbor`
- `Homepage URL`: `https://harbor.example.com`
- `Application description`: `Harbor login integration`
- `Authorization callback URL`: `https://api.example.com/v1/auth/github/callback`

开发环境可以单独创建一个：

- `Application name`: `Harbor Local`
- `Homepage URL`: `http://localhost:5173`
- `Authorization callback URL`: `http://localhost:5173/v1/auth/github/callback`

### 7.2 GitHub App 示例

适用于“私有仓库访问”：

- `GitHub App name`: `Harbor Repository Access`
- `Homepage URL`: `https://harbor.example.com`
- `Description`: `Harbor private repository access integration`
- `Setup URL`: `https://api.example.com/v1/integrations/github/setup`
- `Webhook URL`: `https://api.example.com/v1/integrations/github/webhook`
- `Webhook secret`: 由服务端安全生成并保存

推荐最小权限：

- `Repository permissions -> Metadata`: `Read-only`
- `Repository permissions -> Contents`: `Read-only`

## 8. Harbor 场景下的推荐配置

### 8.1 只做登录

如果你当前阶段只想做 GitHub 登录：

1. 只建 `OAuth App`
2. scope 控制在最小范围
3. 后端自己创建 Harbor session

### 8.2 做私有仓库访问

如果你当前阶段要让 Harbor 访问私有仓库：

1. 不建议简单扩大 OAuth scope 当长期方案
2. 建议单独创建 `GitHub App`
3. 由 GitHub App installation 控制仓库访问范围

### 8.3 同时做登录和私有仓库访问

推荐：

1. `OAuth App` 负责登录
2. `GitHub App` 负责 repo access

这是最符合边界设计的方式。

## 9. 常见错误与排查建议

### 9.1 OAuth callback 不生效

优先检查：

1. GitHub 上配置的 callback URL 是否和实际请求完全一致
2. 协议是否一致
3. 端口是否一致
4. 路径是否一致
5. 是否正确校验了 `state`

### 9.2 GitHub App 安装后没有看到仓库

优先检查：

1. 安装时是否只选了部分仓库
2. App 是否真的有 `Contents` 或 `Metadata` 权限
3. 访问时是否用的是对应 installation 的 token

### 9.3 Setup URL 收到 installation_id，但后续 API 失败

优先检查：

1. 是否只是盲信 URL 参数，没有再校验 installation
2. 是否用正确的 App private key 签 JWT
3. 是否正确换取 installation token
4. installation 是否仍在有效状态

### 9.4 private key 相关错误

优先检查：

1. PEM 文件是否完整
2. 是否误改了换行
3. 环境变量加载时是否转义错误
4. 是否用了已删除或已轮换的 key

## 10. 最终建议

如果你现在要在 GitHub 里完成两件事：

1. 让用户用 GitHub 登录 Harbor
2. 让 Harbor 访问 GitHub 私有仓库

建议按下面做：

### 10.1 登录链路

创建一个 `OAuth App`：

1. 配 `Homepage URL`
2. 配唯一 `Authorization callback URL`
3. 保存 `Client ID` 与 `Client Secret`
4. 由 Harbor 服务端完成 OAuth callback 和 session 创建

### 10.2 仓库访问链路

创建一个 `GitHub App`：

1. 配 `Homepage URL`
2. 配 `Setup URL`
3. 按最小权限原则勾选 repository permissions
4. 生成并安全保存 `private key`
5. 安装到个人账号或组织
6. 按 installation 换短期 token

### 10.3 不建议的做法

1. 为了仓库访问直接把 OAuth 登录 scope 扩得很大
2. 把用户长期 PAT 当成默认主方案
3. 把 GitHub App private key 写进代码库
4. 把带 token 的仓库 URL 落库或写进 `.git/config`

## 11. 官方文档链接

以下为本说明整理时参考的 GitHub 官方文档：

- Creating an OAuth app: https://docs.github.com/en/developers/apps/creating-an-oauth-app
- Authorizing OAuth apps: https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- Registering a GitHub App: https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app
- About the user authorization callback URL: https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-user-authorization-callback-url
- About the setup URL: https://docs.github.com/enterprise-cloud%40latest/apps/creating-github-apps/registering-a-github-app/about-the-setup-url
- Managing private keys for GitHub Apps: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps
- Installing your own GitHub App: https://docs.github.com/apps/installing-github-apps
- Authenticating as a GitHub App installation: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation

## 12. 一句话总结

```text
OAuth App 解决“用户怎么登录”。
GitHub App 解决“服务怎么合法访问 GitHub 资源”。
如果系统两者都要，最好分开建、分开管、分开用。
```
