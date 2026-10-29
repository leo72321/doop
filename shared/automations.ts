import { normalizePipeline } from './agents.ts'
import type { FrameApproval } from './types.ts'

/** Scheduled or approval-triggered workflows. Every step names a canvas;
 * approval workflows use the watched canvas and carry only the signed-off sources.
 * Design tasks finish before the following step starts. */

export type ScheduleKind = 'daily' | 'weekdays' | 'weekly'

export interface Schedule {
  kind: ScheduleKind
  /** weekly only: 0 = Sunday … 6 = Saturday */
  weekday: number
  /** wall-clock time in `tz` */
  hour: number
  minute: number
  /** IANA zone the wall-clock time is read in, e.g. Europe/Berlin */
  tz: string
}

export type PullFilter = 'active' | 'all'

export interface PullStep {
  id: string
  type: 'pull'
  provider: 'meta'
  /** Meta ad account id, e.g. act_1234 — empty until the user picks one */
  accountId: string
  filter: PullFilter
  canvasId: string
}

export type AutomationTrigger = { type: 'schedule' } | { type: 'approval'; canvasId: string }

export interface SlackStep {
  id: string
  type: 'slack'
  canvasId: string
  channelId: string
  message: string
}

export interface LinearStep {
  id: string
  type: 'linear'
  canvasId: string
  teamId: string
  title: string
  description: string
}

export interface AgentStep {
  id: string
  type: 'agent'
  /** short label shown on the node, e.g. "Weekly review"; the prompt is the brief */
  title: string
  prompt: string
  /** the one agent role the card goes to (kept as a list for the card's pipeline shape) */
  roles: string[]
  canvasId: string
}

export type Step = PullStep | AgentStep | SlackStep | LinearStep

/** A durable run keeps the approved sources and the steps as they were at dispatch. */
export interface ApprovedSource {
  id: string
  canvasId: string
  name: string
  approval: FrameApproval
}

export interface AutomationRunState {
  steps: Step[]
  sources: ApprovedSource[]
  stepIndex: number
  summaries: string[]
  links: string[]
  taskId?: string
  /** Set before a side effect; an interrupted call is never silently replayed. */
  dispatching?: boolean
}

export type RunStatus = 'running' | 'ok' | 'failed'

export interface AutomationRun {
  id: string
  automationId: string
  startedAt: number
  endedAt: number | null
  status: RunStatus
  /** one line of what happened: "12 creatives pulled · 1 card queued" */
  summary: string | null
  error: string | null
  /** the first step's canvas — where "Open canvas" leads */
  canvasId: string | null
  /** what went wrong, when it's something the user can fix with one click */
  failure: 'reconnect' | null
}

export interface Automation {
  id: string
  name: string
  enabled: boolean
  trigger: AutomationTrigger
  schedule: Schedule
  steps: Step[]
  nextRunAt: number | null
  lastRun: Pick<AutomationRun, 'id' | 'startedAt' | 'status' | 'summary' | 'failure'> | null
  createdAt: number
  updatedAt: number
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export const MAX_STEPS = 6
export const MAX_NAME = 80
export const MAX_PROMPT = 4_000

export const DEFAULT_SCHEDULE: Schedule = { kind: 'weekly', weekday: 1, hour: 9, minute: 0, tz: 'UTC' }

export function normalizeTrigger(raw: unknown): AutomationTrigger | string {
  if (raw === undefined) return { type: 'schedule' }
  if (!raw || typeof raw !== 'object') return 'Choose a schedule or approval trigger'
  const r = raw as Record<string, unknown>
  if (r.type === 'schedule') return { type: 'schedule' }
  if (r.type === 'approval' && typeof r.canvasId === 'string') return { type: 'approval', canvasId: r.canvasId.trim() }
  return 'Choose a schedule or approval trigger'
}

/* ------------------------------------------------------------------ */
/* Schedule math                                                       */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: number
}

const partsCache = new Map<string, Intl.DateTimeFormat>()

function formatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    })
    partsCache.set(tz, f)
  }
  return f
}

/** The wall clock in `tz` at the instant `at`. */
export function wallClock(at: number, tz: string): WallClock {
  const parts: Record<string, string> = {}
  for (const p of formatter(tz).formatToParts(new Date(at))) parts[p.type] = p.value
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS_SHORT.indexOf(parts.weekday as (typeof WEEKDAYS_SHORT)[number]),
  }
}

/** The zone's UTC offset (ms) at the instant `at`. */
function offsetAt(at: number, tz: string): number {
  const w = wallClock(at, tz)
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return asUtc - Math.floor(at / 1000) * 1000
}

/** The instant a wall-clock time in `tz` happens. Around a DST jump a
 *  nonexistent time resolves to the instant an hour later; an ambiguous one
 *  to its first occurrence. */
export function zonedTime(tz: string, year: number, month: number, day: number, hour: number, minute: number): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const offset = offsetAt(guess, tz)
  const result = guess - offset
  /* the offset can differ at the resolved instant when a DST change sits
     between the guess and the answer — one correction settles it */
  const settled = offsetAt(result, tz)
  return settled === offset ? result : guess - settled
}

/** The next instant strictly after `after` that the schedule fires. */
export function nextRunAt(schedule: Schedule, after: number): number {
  const tz = isValidTimeZone(schedule.tz) ? schedule.tz : 'UTC'
  const now = wallClock(after, tz)
  /* walk day by day from today; a weekly schedule fires within 7 days */
  for (let ahead = 0; ahead <= 8; ahead++) {
    const dayStart = Date.UTC(now.year, now.month - 1, now.day + ahead)
    const d = new Date(dayStart)
    const candidate = zonedTime(
      tz,
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
      schedule.hour,
      schedule.minute,
    )
    if (candidate <= after) continue
    const weekday = wallClock(candidate, tz).weekday
    if (schedule.kind === 'weekly' && weekday !== schedule.weekday) continue
    if (schedule.kind === 'weekdays' && (weekday === 0 || weekday === 6)) continue
    return candidate
  }
  /* unreachable: 8 days always contain every weekday */
  return after + 7 * 86_400_000
}

/** The clock as the viewer's locale shows it; falls back to 24h where Intl is missing. */
export function clockTime(hour: number, minute: number): string {
  try {
    return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch {
    return `${pad(hour)}:${pad(minute)}`
  }
}

export function describeSchedule(s: Schedule): string {
  const time = clockTime(s.hour, s.minute)
  if (s.kind === 'daily') return `Every day at ${time}`
  if (s.kind === 'weekdays') return `Weekdays at ${time}`
  return `Every ${WEEKDAYS[s.weekday] ?? 'Monday'} at ${time}`
}

/** "Mon 09:00" — the short form for list rows */
export function shortSchedule(s: Schedule): string {
  const time = clockTime(s.hour, s.minute)
  if (s.kind === 'daily') return `Daily ${time}`
  if (s.kind === 'weekdays') return `Weekdays ${time}`
  return `${WEEKDAYS_SHORT[s.weekday] ?? 'Mon'} ${time}`
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */

function asInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  if (!Number.isInteger(n) || n < min || n > max) return fallback
  return n
}

export function normalizeSchedule(raw: unknown): Schedule {
  const r = (raw ?? {}) as Partial<Record<keyof Schedule, unknown>>
  const kind: ScheduleKind = r.kind === 'daily' || r.kind === 'weekdays' ? r.kind : 'weekly'
  const tz = typeof r.tz === 'string' && isValidTimeZone(r.tz) ? r.tz : DEFAULT_SCHEDULE.tz
  return {
    kind,
    weekday: asInt(r.weekday, 0, 6, DEFAULT_SCHEDULE.weekday),
    hour: asInt(r.hour, 0, 23, DEFAULT_SCHEDULE.hour),
    minute: asInt(r.minute, 0, 59, DEFAULT_SCHEDULE.minute),
    tz,
  }
}

function stepId(raw: unknown, index: number): string {
  return typeof raw === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(raw) ? raw : `s${index + 1}`
}

/** Shape-check the steps. Canvas ids are only validated for shape here — the
 *  server checks the owner can actually reach each one. */
export function normalizeSteps(raw: unknown): Step[] | string {
  if (!Array.isArray(raw)) return 'steps must be a list'
  if (raw.length > MAX_STEPS) return `at most ${MAX_STEPS} steps`
  const out: Step[] = []
  raw.forEach((item, i) => {
    const s = (item ?? {}) as Record<string, unknown>
    const canvasId = typeof s.canvasId === 'string' ? s.canvasId.trim() : ''
    const field = (key: string, max = MAX_PROMPT) => (typeof s[key] === 'string' ? s[key].trim().slice(0, max) : '')
    if (s.type === 'slack') {
      out.push({
        id: stepId(s.id, i),
        type: 'slack',
        canvasId,
        channelId: field('channelId', 100),
        message: field('message'),
      })
    } else if (s.type === 'linear') {
      out.push({
        id: stepId(s.id, i),
        type: 'linear',
        canvasId,
        teamId: field('teamId', 100),
        title: field('title', 200),
        description: field('description'),
      })
    } else if (s.type === 'pull') {
      out.push({
        id: stepId(s.id, i),
        type: 'pull',
        provider: 'meta',
        accountId: typeof s.accountId === 'string' ? s.accountId.trim().slice(0, 40) : '',
        filter: s.filter === 'all' ? 'all' : 'active',
        canvasId,
      })
    } else if (s.type === 'agent') {
      out.push({
        id: stepId(s.id, i),
        type: 'agent',
        title: typeof s.title === 'string' ? s.title.trim().slice(0, MAX_NAME) : '',
        prompt: typeof s.prompt === 'string' ? s.prompt.trim().slice(0, MAX_PROMPT) : '',
        /* one agent per task — the first real role wins */
        roles: normalizePipeline(s.roles).slice(0, 1),
        canvasId,
      })
    }
  })
  if (out.length !== raw.length) return 'each step must be a pull, agent task, Slack message or Linear ticket'
  if (new Set(out.map((s) => s.id)).size !== out.length) return 'step ids must be unique'
  return out
}

/** Why a saved automation cannot run yet — shown inline, and the reason the
 *  scheduler skips it. Undefined = ready. */
export function incompleteReason(steps: Step[], trigger?: AutomationTrigger): string | undefined {
  if (trigger?.type === 'approval' && !trigger.canvasId) return 'Pick a canvas to watch for approvals'
  if (steps.length === 0) return 'Add a step'
  for (const s of steps) {
    if (!s.canvasId) return 'Pick a canvas for every step'
    if (s.type === 'pull' && !s.accountId) return 'Pick a Meta ad account'
    if (s.type === 'agent' && !s.prompt) return 'Write what the agent should do'
    if (s.type === 'slack' && !/^[CG][A-Z0-9]+$/.test(s.channelId)) return 'Enter a Slack channel ID'
    if (s.type === 'slack' && !s.message) return 'Write a Slack message'
    if (s.type === 'linear' && !s.teamId) return 'Choose a Linear team'
    if (s.type === 'linear' && !s.title) return 'Write a Linear ticket title'
  }
  return undefined
}

/* ------------------------------------------------------------------ */
/* Examples                                                            */

export type ExampleStep =
  | Omit<PullStep, 'id' | 'canvasId'>
  | Omit<AgentStep, 'id' | 'canvasId'>
  | Omit<SlackStep, 'id' | 'canvasId'>
  | Omit<LinearStep, 'id' | 'canvasId'>

export interface AutomationExample {
  id: string
  name: string
  blurb: string
  schedule: Omit<Schedule, 'tz'>
  trigger?: 'approval'
  steps: ExampleStep[]
}

/** The "start from an example" cards. Canvas (and Meta account) are left for
 *  the user to pick; everything else is filled in. */
export const AUTOMATION_EXAMPLES: AutomationExample[] = [
  ...[
    {
      id: 'approved-sizes',
      name: '產生不同尺寸規格',
      blurb: '將核准的設計轉為正方形、直向與橫向草稿。',
      prompt:
        '若有前一步驟的草稿素材則優先使用，否則使用已核准的來源。針對每個輸入，分別建立 1080×1080、1080×1920 與 1200×628 的獨立草稿畫框。針對各尺寸重新調整版面排版，同時保留品牌風格、核心訊息與視覺焦點。檢查文字適配度並保持原始畫框不受更動。',
    },
    {
      id: 'approved-localization',
      name: '在地化翻譯核准設計',
      blurb: '翻譯已核准的設計並調整其版面配置。',
      prompt:
        '若有前一步驟的草稿素材則優先使用，否則使用已核准的來源。針對每個輸入，建立德文、法文與西班牙文草稿版本。依據該語言習慣與文字長度調整慣用語、字型排印與版面結構。保留品牌名稱與原始設計意圖。以對應語言為每個新畫框命名，並保持原始畫框不受更動。',
    },
    {
      id: 'approved-assets',
      name: '建立系列配套資產',
      blurb: '將核准的設計方向轉化為整套行銷宣傳資產。',
      prompt:
        '若有前一步驟的草稿素材則優先使用，否則使用已核准的來源。針對每個輸入建立三組配套草稿資產：1200×628 社群橫幅、600×300 電子報首圖以及 1440×600 網站 Hero 主視覺。延續其視覺風格方向，並依據不同用途調整文案與構圖。保持原始畫框不受更動。',
    },
  ].map((preset): AutomationExample => ({
    id: preset.id,
    name: preset.name,
    blurb: preset.blurb,
    trigger: 'approval',
    schedule: { kind: 'weekly', weekday: 1, hour: 9, minute: 0 },
    steps: [{ type: 'agent', title: preset.name, prompt: preset.prompt, roles: ['doop'] }],
  })),
  {
    id: 'weekly-creatives',
    name: '每週廣告創意',
    blurb: '每週一將所有投放中的 Meta 廣告抓取至畫布。',
    schedule: { kind: 'weekly', weekday: 1, hour: 9, minute: 0 },
    steps: [{ type: 'pull', provider: 'meta', accountId: '', filter: 'active' }],
  },
  {
    id: 'ad-variants',
    name: '廣告變體生成',
    blurb: '抓取本週廣告創意，再由 Doop 為每個廣告快速生成 5 組變體。',
    schedule: { kind: 'weekly', weekday: 1, hour: 9, minute: 0 },
    steps: [
      { type: 'pull', provider: 'meta', accountId: '', filter: 'active' },
      {
        type: 'agent',
        title: '製作變體',
        prompt:
          '針對今天匯入的每個廣告創意，在其旁邊建立 5 個新畫框作為變體：更吸睛的標題、不同的視覺層級、更鮮明大膽的配色處理、更精簡的文案版本，以及以社群口碑證言為主的版本。請確保品牌識別完整一致。',
        roles: ['doop'],
      },
    ],
  },
  {
    id: 'friday-ux',
    name: '週五 UX 審查',
    blurb: '由 UX 負責人審查本週所有變更內容。',
    schedule: { kind: 'weekly', weekday: 5, hour: 16, minute: 0 },
    steps: [
      {
        type: 'agent',
        title: '每週審查',
        prompt:
          '將此畫布上的每個畫框視為真實使用者會操作的介面進行審查。修復不明確的主要操作按鈕、混亂的視覺層級與缺漏的狀態。最後留下一則簡短說明記錄修改內容。',
        roles: ['ux'],
      },
    ],
  },
  {
    id: 'brand-a11y',
    name: '品牌與無障礙檢查',
    blurb: '讓所有畫框符合品牌規範並達到 WCAG AA 標準。',
    schedule: { kind: 'weekly', weekday: 3, hour: 10, minute: 0 },
    steps: [
      {
        type: 'agent',
        title: '品牌審查',
        prompt:
          '依據此處建立的品牌規範（調色盤、字體、圓角、語調）以及 WCAG AA 對比度與語意結構，檢查畫布上的每個畫框。在不重新設計的前提下修復不符規範之處。',
        roles: ['brand'],
      },
    ],
  },
  {
    id: 'copy-pass',
    name: '每週文案潤飾',
    blurb: '由文案撰寫者精煉每個標題與按鈕標籤。',
    schedule: { kind: 'weekly', weekday: 2, hour: 9, minute: 30 },
    steps: [
      {
        type: 'agent',
        title: '文案潤飾',
        prompt:
          '逐一檢視此畫布上的每個畫框並精煉文案：撰寫明確具體的標題、簡短的標籤、具體的行動呼籲（CTA），去除冗言贅字。確保每行文字都在原有的框架容器內不溢出。',
        roles: ['copy'],
      },
    ],
  },
  {
    id: 'nightly-polish',
    name: '夜間視覺精修',
    blurb: '每晚由視覺精修角色整理間距與對齊。',
    schedule: { kind: 'weekdays', weekday: 1, hour: 22, minute: 0 },
    steps: [
      {
        type: 'agent',
        title: '視覺精修',
        prompt:
          '精修此畫布上的每個畫框：視覺光學對齊、統一間距尺度、平滑字級階梯，並確保在該畫框尺寸下無任何內容溢出。僅進行精細的微調修正。',
        roles: ['polish'],
      },
    ],
  },
]

export function exampleById(id: string): AutomationExample | undefined {
  return AUTOMATION_EXAMPLES.find((e) => e.id === id)
}
