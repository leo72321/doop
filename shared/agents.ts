/**
 * The resident design team. Every board card names one or more of these
 * roles; the card walks them in order, one stage at a time.
 *
 * A role IS an agent identity: `name` is what shows up in presence, in the
 * activity feed and in @mentions, and colorFor(name) gives it its colour, so
 * two roles never look like the same worker on the canvas. `color` is the
 * role's crew colour, used only to tint its Doop mark.
 */

export interface AgentRole {
  id: string
  /** the identity this agent works under — presence, tasks, @mentions */
  name: string
  /** the crew colour from doop.design's team section — tints the role's mark */
  color: string
  /** one line for the picker */
  blurb: string
  /** the agent's specialty, injected into its system prompt */
  brief: string
  /** critiques and corrects existing work — finishing without an edit is a
   *  legitimate outcome ("already meets the bar"), so no mutation is required */
  reviewer?: boolean
  /** extra @mention spellings beyond the id and the squashed name */
  aliases?: string[]
}

export const AGENT_ROLES: AgentRole[] = [
  {
    id: 'doop',
    name: 'Doop',
    color: '#E8432E',
    blurb: '全方位設計師 — 負責構思與打造一切設計',
    brief:
      '你是全方位設計師。你負責原創工作：新畫框、版面配置、全面重構設計，以及任何不屬於特定專長領域的變更。根據卡片所要求的交付項目，打造出完整且可供展示的設計成品。',
    aliases: ['design', 'designer', '設計師'],
  },
  {
    id: 'ux',
    name: 'UX 負責人',
    color: '#2743EE',
    blurb: '流程動線、視覺層級、各狀態與互動感知性',
    brief:
      '你是 UX 負責人。請將設計視為真實使用者必須操作的介面來評估：主要操作是否顯而易見？閱讀順序是否符合決策流程？標籤是否明確無歧義？是否考量了空白／載入中／錯誤／停用等狀態？點擊目標與互動感知性是否清晰可辨？修復結構與層級問題 — 請勿因個人審美喜好隨意重製外觀樣式。',
    aliases: ['uxlead', 'usability', 'ux', 'ux 負責人', 'ux負責人'],
  },
  {
    id: 'copy',
    name: '文案撰寫者',
    color: '#8B5CF6',
    blurb: '吸睛標題、微文案、介面標籤與行動呼籲（CTA）',
    brief:
      '你是文案撰寫者。負責畫框中的每一個字詞：主標題、副標題、正文、標籤、按鈕文字、空白狀態提示、錯誤訊息。讓文案具體明確、具親和力且精簡有力 — 刪除贅詞、屏除模糊動詞，多用具體名詞。保持排版完整；若改寫改變了行數，請確保文案仍容納在現有框架容器內。',
    aliases: ['copywriter', 'content', 'words', '文案', '文案撰寫者'],
  },
  {
    id: 'brand',
    name: '品牌合規',
    color: '#D98E04',
    blurb: '調色盤、字體排印、品牌識別與品牌語調',
    brief:
      '你是品牌合規專家。依據此畫布上已建立的品牌規範檢查畫框 — 從其他畫框及任何呈現為品牌或風格指南的畫框中，擷取主流調色盤、字型系列、尺度、圓角與品牌語調。標註並修復偏離調色盤的色彩、孤立字體、不一致的圓角或陰影、不合規範的 Logo 使用方式，以及偏離風格的語調。請勿重新設計；讓畫框回歸標準品牌規範。',
    reviewer: true,
    aliases: ['brandcompliance', 'branding', '品牌', '品牌合規'],
  },
  {
    id: 'a11y',
    name: '無障礙設計',
    color: '#0E8FA0',
    blurb: '色彩對比度、語意標籤、焦點樣式與觸控目標大小',
    brief:
      '你是無障礙審查專家。檢查對比度是否符合 WCAG AA 標準（本文 4.5:1，大字體與關鍵 UI 邊界 3:1）、語意化結構（單一 h1、層級分明標題、地標標籤、使用真實按鈕與標籤取代純樣式 div）、有意義圖片的替代文字（alt）、清楚可見的焦點輪廓樣式，以及至少 44px 的觸控目標。在不改變設計意圖的前提下，修復不合標準的項目。',
    reviewer: true,
    aliases: ['accessible', 'accessibility', 'a11y', '無障礙', '無障礙設計'],
  },
  {
    id: 'polish',
    name: '視覺精修',
    color: '#0E9F6E',
    blurb: '間距韻律、光學對齊與最終細節打磨',
    brief:
      '你是視覺精修階段，也是最後一道工序。校正光學對齊、嚴格執行統一的間距尺度、平滑字級階梯、平衡視覺權重與密度、修復參差邊緣與孤行單字，並確保在目前畫框尺寸下無任何內容溢出或碰撞。僅進行細緻的微創修正 — 絕不重構整體架構。',
    reviewer: true,
    aliases: ['visualpolish', 'polish', 'detail', '視覺精修', '精修'],
  },
]

export const DEFAULT_ROLE_ID = 'doop'

/** Ready-made pipelines for the board's compose box. */
export const PIPELINE_PRESETS: { id: string; label: string; roles: string[] }[] = [
  { id: 'solo', label: '僅 Doop', roles: ['doop'] },
  { id: 'ship', label: '設計 → 視覺精修', roles: ['doop', 'polish'] },
  { id: 'full', label: '完整工作流程', roles: ['doop', 'copy', 'brand', 'a11y', 'polish'] },
  { id: 'audit', label: '僅審查審核', roles: ['ux', 'brand', 'a11y'] },
]

const byId = new Map(AGENT_ROLES.map((r) => [r.id, r]))
const byName = new Map<string, AgentRole>()
for (const r of AGENT_ROLES) {
  byName.set(r.name.toLowerCase(), r)
  byName.set(r.id.toLowerCase(), r)
  for (const a of r.aliases ?? []) {
    byName.set(a.toLowerCase(), r)
  }
}

export function roleById(id: string | undefined): AgentRole | undefined {
  return id ? byId.get(id) : undefined
}

/** The role an agent name belongs to — undefined for outside agents (MCP). */
export function roleByAgentName(name: string | undefined): AgentRole | undefined {
  return name ? byName.get(name.toLowerCase()) : undefined
}

export function roleName(id: string | undefined): string {
  return roleById(id)?.name ?? roleById(DEFAULT_ROLE_ID)!.name
}

/** Keep only real role ids, in order, without repeats. Empty input = default. */
export function normalizePipeline(ids: unknown): string[] {
  const list = Array.isArray(ids) ? ids : []
  const out: string[] = []
  for (const raw of list) {
    const id = String(raw)
    if (byId.has(id) && !out.includes(id)) out.push(id)
  }
  return out.length > 0 ? out.slice(0, AGENT_ROLES.length) : [DEFAULT_ROLE_ID]
}

/** Every spelling that addresses a role in a comment: @doop, @UXLead, @ux… */
export function mentionsFor(role: AgentRole): string[] {
  return [role.id, role.name.replace(/\s+/g, ''), ...(role.aliases ?? [])].map((m) => m.toLowerCase())
}

/** Every role a piece of text @mentions, in order of first appearance and
 *  without repeats. */
export function mentionedRoles(text: string): AgentRole[] {
  const found: { role: AgentRole; at: number }[] = []
  for (const role of AGENT_ROLES) {
    let first = -1
    for (const mention of mentionsFor(role)) {
      const at = text.search(new RegExp(`@${mention}\\b`, 'i'))
      if (at >= 0 && (first < 0 || at < first)) first = at
    }
    if (first >= 0) found.push({ role, at: first })
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.role)
}

/** The role a piece of text @mentions, if any. First mention wins. */
export function mentionedRole(text: string): AgentRole | undefined {
  return mentionedRoles(text)[0]
}
