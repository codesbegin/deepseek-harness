/**
 * dsh-finance 插件入口
 *
 * 现在提供一个最小 FinanceService：内存账户簿 + 远程方法。
 * 后续接 dsh storage 做持久化、接 session event 做审计。
 */

import { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { randomUUID } from 'node:crypto'
import { Account, AccountCategory, JournalEntry, Posting } from './domain/index.js'

export * from './domain/index.js'

declare module '@deepseek-ai/cordis' {
  interface Context {
    finance: FinanceService
  }
}

/** 财务服务配置。 */
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

  private readonly accounts = new Map<string, Account>()
  private readonly entries = new Map<string, JournalEntry>()

  constructor(ctx: Context, config: FinanceConfig = {}) {
    super(ctx, 'finance')
    // TODO: 读取 config.ledger，接 storage 适配器
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

  /** 试算平衡：所有账户余额汇总。 */
  @Remote('trialBalance')
  trialBalance(): { totalDebit: number; totalCredit: number; balanced: boolean } {
    // 简化版：资产+费用借余，负债+权益+收入贷余
    let d = 0, c = 0
    for (const a of this.accounts.values()) {
      if (a.normalBalance === 'debit') d += a.balance
      else c += a.balance
    }
    return { totalDebit: d, totalCredit: c, balanced: Math.round(d * 100) === Math.round(c * 100) }
  }
}

export default FinanceService
