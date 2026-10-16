# 定制方向：财务插件 (dddas)

> 本 fork 基于 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)，
> 目标是在 dsh 之上加一个 DDD 财务领域插件。

## 思路

dsh 已经提供了 agent 循环、会话、工具调用、Web UI、存储插件体系。
我们不重写这些，只加一个 `packages/finance/` 包：

- 复用 dsh 的 agent 循环让 agent 能记账
- 复用 dsh 的存储插件体系持久化账户/分录
- 复用 dsh 的 Web UI 展示财务面板

## 要加的包

### `packages/finance/`

参考 `packages/todo/` 和 `packages/goal/` 的结构。

包含：

1. **领域模型**（从 [codesbegin/dddas](https://github.com/codesbegin/dddas) 迁过来）
   - Account（资产/负债/权益/收入/费用）
   - JournalEntry（借贷平衡、DRAFT→POSTED→LOCKED）
   - Posting（过账行）

2. **Tools**（agent 可调用）
   - `create_account({ id, name, category })`
   - `post_entry({ id, description, postings })`
   - `list_accounts()`
   - `trial_balance()`
   - `list_entries({ accountId, limit })`

3. **Repository**（走 dsh storage 插件）
   - AccountRepository / JournalEntryRepository 接口
   - 默认实现用 dsh 的 storage

4. **Skill / preset**（可选）
   - 一个"财务助手"skill，让 agent 知道怎么记账

## 目录预期

```
packages/finance/
  package.json
  src/
    domain/       # Account / JournalEntry / Posting（纯 TS）
    tools/        # 注册给 agent 的 tool
    repo/         # 实现 Repository 接口
    index.ts      # 导出 Cordis 插件
  tests/
```

## 不改动的 dsh 部分

- core / session / skill / web / storage 这些内核包不改
- 只在 packages/ 下新增 finance 包
- 跟上游保持可 merge

## 关联仓库

- [codesbegin/dddas](https://github.com/codesbegin/dddas)：领域模型独立仓库（已停止维护，模型已迁入本 fork）
- [codesbegin/reconciliation-loop-skill](https://github.com/codesbegin/reconciliation-loop-skill)：7 步循环方法论，dsh 已内置类似循环

---

## 2026-10-16 复盘：从 goal 包学到的 Cordis 模式

对照 `packages/goal/goal/src/index.ts`（约 600 行），我们当前的 FinanceService 骨架还差几步才能真正被 dsh 加载。

### goal 包的关键模式（我们要对齐的）

| 模式 | goal 包做法 | FinanceService 当前 |
|---|---|---|
| Service 基类 | `extends TypertRemoteService`，构造时 `super(ctx, 'goals')` | ✅ 已对齐 |
| 依赖注入 | `static inject = ['agents', 'sessionProjections']` | ❌ 空数组，下一步要注入 storage |
| 配置 schema | `static Config: z<Config> = z.object({...})`（schemastery） | ✅ 已加（ledger 字段） |
| ctx 扩展 | `declare module '@deepseek-ai/cordis' { interface Context { goals: GoalService } }` | ✅ 已对齐（`finance: FinanceService`） |
| 远程方法 | `@Remote('create')` 装饰器暴露 RPC | ✅ 已加 4 个 |
| 事件驱动 | `ctx.on('agent/created', ...)` / `ctx.sessionProjections.register(...)` | ❌ 还是内存 Map |
| 错误模型 | 自定义 `GoalError` + 稳定错误码（`GOAL_*`） | ❌ 直接 throw Error |
| 并发控制 | compare-and-set（revision 乐观锁） | ❌ 无 |

### 下一步路线（按优先级）

1. **P0：接 dsh storage**。把 `accounts` / `entries` 两个 Map 换成 Repository 接口，参考 goal 包对 `sessionProjections` 的依赖方式。先注入一个 `storage` 句柄，默认 SQLite。
2. **P1：tool-finance 子包**。新建 `packages/finance/tool-finance/`，参考 `packages/goal/tool-goal/` 把 4 个 @Remote 方法包装成 agent 可调用的 tool（带 zod schema 入参、错误码映射）。
3. **P2：错误模型**。定义 `FinanceError` + 错误码族（`FINANCE_UNKNOWN_ACCOUNT` / `FINANCE_UNBALANCED_ENTRY` / `FINANCE_LOCKED_LEDGER`），让 agent 能区分"账户不存在"和"借贷不平"。
4. **P3：事件投影**。过账后发 `finance/posted` session event，未来可以接 Web UI 的实时账本视图。
5. **P4：乐观锁**。多 agent 并发过账时用 revision 做 CAS，避免重复入账。

### 已知的坑（踩过的）

- dsh fork 默认分支是 `master`，不是 `main`；用错分支会 404。
- `pnpm-workspace.yaml` 的 `packages/*/*` glob 已经覆盖 `packages/finance/finance/`，**不需要手动注册**。
- `create_or_update_file` 是整文件覆盖，不是 diff；更新已存在文件必须传完整新内容（10-16 踩过：只传末尾几行把 budget-checker.js 删空了）。
