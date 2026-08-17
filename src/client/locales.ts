/**
 * Panel copy. The shell owns no text of its own, so every string a reader
 * sees is registered here in both languages.
 * @module dsh-research/client/locales
 */

/** Locale namespace this plugin registers under. */
export const NS = 'settings.researchMarket'

/** Copy keys of the panel. */
export type MarketLocaleKey =
  | 'nav'
  | 'title'
  | 'tabDiscover'
  | 'tabInstalled'
  | 'allCategories'
  | 'catLiterature'
  | 'catReference'
  | 'catWriting'
  | 'catWorkbench'
  | 'catPacks'
  | 'emptyInstalled'
  | 'intro'
  | 'search'
  | 'loading'
  | 'empty'
  | 'install'
  | 'installing'
  | 'progressInstall'
  | 'progressRemove'
  | 'progressElapsed'
  | 'installed'
  | 'restart'
  | 'uninstall'
  | 'uninstalling'
  | 'restartNow'
  | 'restartTitle'
  | 'confirmInstallTitle'
  | 'confirmRemoveTitle'
  | 'confirmRestartTitle'
  | 'confirmProfile'
  | 'confirmWillRun'
  | 'confirmOurs'
  | 'confirmRemoveBody'
  | 'confirmRestartBody'
  | 'confirmYes'
  | 'confirmNo'
  | 'confirmClose'
  | 'restarting'
  | 'restartHint'
  | 'failed'
  | 'copy'
  | 'copied'
  | 'noNpm'
  | 'ours'
  | 'stars'
  | 'retry'
  | 'error'
  | 'stale'
  | 'revision'
  | 'count'
  | 'profileNote'
  | 'disclosure'
  | 'site'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The research market settings page. */
    'settings.researchMarket': MarketLocaleKey
  }
}

export const zh: Record<MarketLocaleKey, string> = {
  nav: '科研插件',
  title: '科研插件',
  tabDiscover: '发现',
  tabInstalled: '已安装',
  allCategories: '全部',
  catLiterature: '文献检索与阅读',
  catReference: '文献管理与引用',
  catWriting: '写作与评审',
  catWorkbench: '科研工作台',
  catPacks: '技能包',
  emptyInstalled: '还没有从这里安装任何插件。',
  intro: '人工挑选的科研插件，装进当前 profile 后重启生效',
  search: '搜索插件、能力、关键词…',
  loading: '正在读取目录…',
  empty: '没有匹配的插件。',
  install: '安装',
  installing: '安装中…',
  progressInstall: '首次安装需要下载并解析依赖，大插件可能要 1–3 分钟。这期间可以离开本页，装完会记在这里。',
  progressRemove: '正在从 profile 中移除并清理依赖…',
  progressElapsed: '已用 {n} 秒',
  installed: '已安装',
  restart: '重启 dsh 后生效',
  uninstall: '卸载',
  uninstalling: '卸载中…',
  restartNow: '重启 dsh',
  restartTitle: '重启后新装或卸载的插件才会生效',
  confirmInstallTitle: '安装 {name}？',
  confirmRemoveTitle: '卸载 {name}？',
  confirmRestartTitle: '重启 dsh？',
  confirmProfile: '这会写入 profile ',
  confirmWillRun: '将执行：',
  confirmOurs: '本目录只收录 AI4Scholar 维护的插件。安装会改写 profile 的清单并重装依赖，装完需要重启。',
  confirmRemoveBody: '会从 profile 中移除该插件，磁盘上的包也会被删除。可以随时重新安装。',
  confirmRestartBody: '当前 dsh 进程会退出，随后自动拉起新的。本页会短暂断开，刷新即可回来；正在进行的对话会中断。',
  confirmYes: '确认',
  confirmNo: '取消',
  confirmClose: '关闭',
  restarting: '重启中…',
  restartHint: '有 {n} 项改动等待生效。重启后本页会短暂断开，刷新即可。',
  failed: '安装失败',
  copy: '复制命令',
  copied: '已复制',
  noNpm: '仅提供仓库安装',
  ours: '我们维护',
  stars: '星',
  retry: '重试',
  error: '读取目录失败：',
  stale: '这是缓存快照，最近一次刷新失败。',
  revision: '目录版本 ',
  count: '{n} / {total} 个',
  profileNote: '当前 profile：',
  disclosure: '收录不代表背书。本索引由 AI4Scholar 维护，其中部分插件也由我们开发。安装前请自行审查源码与权限。',
  site: '完整索引 →',
}

export const en: Record<MarketLocaleKey, string> = {
  nav: 'Research plugins',
  title: 'Research plugins',
  tabDiscover: 'Discover',
  tabInstalled: 'Installed',
  allCategories: 'All',
  catLiterature: 'Literature',
  catReference: 'References',
  catWriting: 'Writing & review',
  catWorkbench: 'Workbenches',
  catPacks: 'Skill packs',
  emptyInstalled: 'Nothing installed from here yet.',
  intro: 'Hand-picked research plugins, installed into the profile you are running',
  search: 'Search plugins, capabilities, keywords…',
  loading: 'Reading the catalog…',
  empty: 'No plugin matches.',
  install: 'Install',
  installing: 'Installing…',
  progressInstall: 'A first install downloads and resolves dependencies; a large plugin can take 1–3 minutes. You can leave this page — the result is recorded here.',
  progressRemove: 'Removing it from the profile and cleaning up dependencies…',
  progressElapsed: '{n}s elapsed',
  installed: 'Installed',
  restart: 'Restart dsh to load it',
  uninstall: 'Remove',
  uninstalling: 'Removing…',
  restartNow: 'Restart dsh',
  restartTitle: 'Installed and removed plugins take effect after a restart',
  confirmInstallTitle: 'Install {name}?',
  confirmRemoveTitle: 'Remove {name}?',
  confirmRestartTitle: 'Restart dsh?',
  confirmProfile: 'This writes into profile ',
  confirmWillRun: 'It will run:',
  confirmOurs: 'This catalog lists only plugins AI4Scholar maintains. Installing rewrites the profile manifest and reinstalls its dependencies; a restart is needed afterwards.',
  confirmRemoveBody: 'The plugin leaves the profile and its package is deleted from disk. You can install it again at any time.',
  confirmRestartBody: 'This dsh process exits and a fresh one is started. The page drops briefly — reload it — and any conversation in progress is interrupted.',
  confirmYes: 'Confirm',
  confirmNo: 'Cancel',
  confirmClose: 'Close',
  restarting: 'Restarting…',
  restartHint: '{n} change(s) waiting. The page drops briefly during the restart — reload it.',
  failed: 'Install failed',
  copy: 'Copy command',
  copied: 'Copied',
  noNpm: 'repository install only',
  ours: 'ours',
  stars: 'stars',
  retry: 'Retry',
  error: 'Could not read the catalog: ',
  stale: 'This is a cached snapshot; the last refresh failed.',
  revision: 'Catalog revision ',
  count: '{n} of {total}',
  profileNote: 'Profile: ',
  disclosure: 'Listing is not endorsement. This index is maintained by AI4Scholar, which also authors some of the entries. Review a plugin’s source and permissions before installing it.',
  site: 'Full index →',
}
