/**
 * dsh-finance 插件入口
 *
 * 现在提供一个最小 FinanceService：内存账户簿 + 远程方法。
 * 后续接 dsh storage 做持久化、接 session event 做审计。
 */

import { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import s from '@deepseek-ai/schemastery'
import { randomUUID } from 'node:crypto'
import { Account, AccountCategory, JournalEntry, Posting } from './domain/index.js'

export * from './domain/index.js'

declare module '@deepseek-ai/cordis' {
  interface Context {
    finance: FinanceService
  }
}

/** 财务服务配置（运行时由 Cordis 注入并校验）。 */
export interface FinanceConfig {
  /** 账套标识（多账簿预留，默认 'default'）。 */
  ledger?: string
}

/**
 * 财务服务（ctx.finance）。
 *
 * 当前是进程内内存实现：账户与分录都存在 Map 里。
 * 下一步接 dsh storage 做 SQLite 持久化。
 */
export class FinanceService extends TypertRemoteService {
  static inject = [] as const

  /** 对齐 dsh 其他包的做法：用 schemastery 声明配置 schema，宿主校验后注入。 */
  static Config: s<FinanceConfig> = s.object({
    ledger: s.string().default('default'),
  })

  private readonly ledger: string
  private readonly accounts = new Map<string, Account>()
  private readonly entries = new Map<string, JournalEntry>()

  constructor(ctx: Context, config: FinanceConfig = {}) {
    super(ctx, 'finance')
    // schemastery 已经补了默认值，这里直接读即可。
    this.ledger = config.ledger ?? 'default'
  }

  /** 当前账套标识（只读）。 */
  @Remote('getLedger')
  getLedger(): string {
    return this.ledger
  }

  /** 创建账户。 */
  @Remote('createAccount')
  createAccount(input: { name: string; category: AccountCategory; openingBalance?: number }): Account {
    const id = `acct-${randomUUID().slice(0, 8)}`
    const acc = new Account({ id, ...input })
    this.accounts.set(id, acc)
    return acc
  }

  /** 列出全部账户。 */
  @Remote('listAccounts')
  listAccounts(): Array<{ id: string; name: string; category: AccountCategory; balance: number }> {
    return [...this.accounts.values()].map(a => ({
      id: a.id,
      name: a.name,
      category: a.category,
      balance: a.balance,
    }))
  }

  /** 提交一笔分录（借贷平衡才入账）。 */
  @Remote('postEntry')
  postEntry(input: {
    description: string
    postings: Array<{ accountId: string; direction: 'debit' | 'credit'; amount: number }>
  }): { id: string; status: string; totalDebit: number; totalCredit: number } {
    const je = new JournalEntry({ id: `je-${randomUUID().slice(0, 8)}`, description: input.description })
    for (const p of input.postings) {
      const acc = this.accounts.get(p.accountId)
      if (!acc) throw new Error(`account ${p.accountId} not found`)
      je.addPosting(new Posting({ account: acc, direction: p.direction, amount: p.amount }))
    }
    je.post()
    this.entries.set(je.id, je)
    return { id: je.id, status: je.status, totalDebit: je.totalDebit, totalCredit: je.totalCredit }
  }

  /** 试算平衡：按账户类别汇总借贷余额。 */
  @Remote('trialBalance')
  trialBalance(): {
    byCategory: Array<{ category: AccountCategory; debit: number; credit: number }>
    totalDebit: number
    totalCredit: number
    balanced: boolean
  } {
    // 按 normalBalance 把余额归到借贷两侧：
    //   资产/费用 → 借方余额
    //   负债/权益/收入 → 贷方余额
    const bucket = new Map<AccountCategory, { debit: number; credit: number }>()
    let d = 0, c = 0
    for (const a of this.accounts.values()) {
      const cell = bucket.get(a.category) ?? { debit: 0, credit: 0 }
      if (a.normalBalance === 'debit') { cell.debit += a.balance; d += a.balance }
      else { cell.credit += a.balance; c += a.balance }
      bucket.set(a.category, cell)
    }
    return {
      byCategory: [...bucket.entries()].map(([category, v]) => ({ category, ...v })),
      totalDebit: d,
      totalCredit: c,
      balanced: Math.round(d * 100) === Math.round(c * 100),
    }
  }
}

export default FinanceService
