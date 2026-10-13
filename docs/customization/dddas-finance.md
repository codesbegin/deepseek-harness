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

- [codesbegin/dddas](https://github.com/codesbegin/dddas)：领域模型独立仓库，先在这里写稳定，再搬进来
- [codesbegin/reconciliation-loop-skill](https://github.com/codesbegin/reconciliation-loop-skill)：7 步循环方法论，dsh 已内置类似循环
