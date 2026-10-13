/**
 * dsh-finance 插件入口
 *
 * 现在只导出域模型。下一步：
 * 1. 注册 agent tools（create_account / post_entry / list_accounts / trial_balance）
 * 2. 接 dsh storage 做 Repository 实现
 */

export * from './domain/index.js';

// TODO: Cordis 插件注册
// import { Service } from '@deepseek-ai/cordis';
// export class FinanceService extends Service {
//   // 注册 tools、repository、web 面板
// }
