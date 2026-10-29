import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { navigate } from '../App'
import { useStore } from '../lib/store'
import { roleByAgentName } from '../../shared/agents'
import { posthog } from '../lib/posthog'
import { canUseChatGPTPublicEndpoint, CHATGPT_CONNECTION_GUIDE, CHATGPT_PLUGINS_URL } from '../lib/chatgptConnection'
import { AgentIcon } from './AgentIcon'
import { ClaudeDesktopInstall } from './ClaudeDesktopInstall'
import { canAddToClaudeDesktop, claudeConnectorInstallUrl } from '../lib/claudeConnection'
import { CursorInstall } from './CursorInstall'
import { CodexInstall } from './CodexInstall'
import { Button } from './ui/button'
import { CodeBlock } from './ui/code-block'
import { Disclosure } from './ui/collapsible'
import { Dot } from './ui/dot'
import { CheckIcon, ChevronLeftIcon, PuzzleIcon } from './ui/icons'
import { Modal, ModalActions, ModalLede, ModalSpacer, ModalTitle } from './ui/modal'
import { barPrimaryBtn } from './TopBar'
import { cn } from '@/lib/utils'
import { useI18n } from '../lib/i18n'

/**
 * "Connect AI" is about agents that join the canvas from outside: Claude Code,
 * Codex, Cursor, the Claude or ChatGPT apps, or any MCP client. Pick the agent,
 * then follow its own three steps. Running the built-in Doop Agent on your own
 * ChatGPT or Claude plan is an account setting and lives in Settings, next to
 * the prompt bar's allowance meter — not here.
 */

type AgentId = 'claude-code' | 'claude' | 'chatgpt' | 'codex' | 'cursor' | 'mcp'
type View = 'agents' | AgentId
type ClaudeConnection = 'desktop' | 'web'

interface AgentOption {
  id: AgentId
  name: string
  blurb: string
  icon: ReactNode
}

const AGENTS: AgentOption[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    blurb: 'Connect from your terminal',
    icon: <AgentIcon name="claude" size={20} />,
  },
  { id: 'claude', name: 'Claude', blurb: 'Add Doop to Claude', icon: <AgentIcon name="claude" size={20} /> },
  { id: 'chatgpt', name: 'ChatGPT', blurb: 'Connect in your browser', icon: <AgentIcon name="gpt" size={20} /> },
  { id: 'codex', name: 'Codex', blurb: 'ChatGPT desktop and Codex CLI', icon: <AgentIcon name="codex" size={20} /> },
  {
    id: 'cursor',
    name: 'Cursor',
    blurb: 'Add Doop to Cursor',
    icon: <AgentIcon name="cursor" size={20} />,
  },
  {
    id: 'mcp',
    name: 'Other MCP client',
    blurb: 'Use a manual connection',
    icon: <PuzzleIcon width={20} height={20} />,
  },
]

const agentById = (id: AgentId): AgentOption => AGENTS.find((agent) => agent.id === id) ?? AGENTS[0]!

/** `canvasId` is optional: opened from the home dashboard there is no canvas to
 *  suggest a prompt for, and no presence connection to watch for an arrival. */
export function ConnectModal({
  canvasId,
  onClose,
  initialAgent,
  showAgentStatus = true,
}: {
  canvasId?: string
  onClose: () => void
  initialAgent?: AgentId
  /** Standalone setup can suggest a canvas without subscribing to its presence. */
  showAgentStatus?: boolean
}) {
  const [view, setView] = useState<View>(initialAgent ?? 'agents')
  return (
    <Modal size="lg" className="flex flex-col overflow-hidden p-0 sm:p-0" onClose={onClose}>
      {view === 'agents' ? (
        <AgentPicker onPick={setView} />
      ) : (
        <AgentSteps
          agent={view}
          canvasId={canvasId}
          showAgentStatus={showAgentStatus}
          onBack={() => setView('agents')}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

/* ---------- pick the agent, then its three steps ---------- */

function AgentPicker({ onPick }: { onPick: (agent: AgentId) => void }) {
  const { t } = useI18n()
  const [agent, setAgent] = useState<AgentId>('claude-code')

  const agentBlurbs: Record<AgentId, { name?: string; blurb: string }> = {
    'claude-code': { blurb: t('connect.claudeCodeBlurb') },
    claude: { blurb: t('connect.claudeBlurb') },
    chatgpt: { blurb: t('connect.chatgptBlurb') },
    codex: { blurb: t('connect.codexBlurb') },
    cursor: { blurb: t('connect.cursorBlurb') },
    mcp: { name: t('connect.otherMcp'), blurb: t('connect.otherMcpBlurb') },
  }

  return (
    <>
      <div className={body}>
        <ModalTitle>{t('connect.title')}</ModalTitle>
        <ModalLede>
          {t('connect.lede')}
        </ModalLede>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {AGENTS.map((option) => (
            <ChoiceCard
              key={option.id}
              selected={agent === option.id}
              onClick={() => setAgent(option.id)}
              icon={option.icon}
              title={agentBlurbs[option.id]?.name ?? option.name}
              blurb={agentBlurbs[option.id]?.blurb ?? option.blurb}
            />
          ))}
        </div>
      </div>

      <ModalActions className={footer}>
        <Button
          variant="primary"
          className={barPrimaryBtn}
          onClick={() => {
            posthog.capture('connect_ai_agent_chosen', { agent })
            onPick(agent)
          }}
        >
          連線
        </Button>
      </ModalActions>
    </>
  )
}

interface Step {
  title: string
  body: ReactNode
  code?: string
  action?: ReactNode
}

function agentSteps(
  agent: AgentId,
  mcpUrl: string,
  prompt: string,
  claudeConnection: ClaudeConnection,
  canvasId?: string,
): { lede: string; steps: Step[] } {
  const jsonConfig = JSON.stringify({ mcpServers: { doop: { type: 'http', url: mcpUrl } } }, null, 2)
  const pointAt: Step = {
    title: '指向此畫布',
    body: prompt
      ? '將此訊息作為第一則指令傳送給 Agent。其餘所需資訊將直接由伺服器提供。'
      : '開啟畫布並告知 Agent 在該畫布上工作。其餘所需資訊將直接由伺服器提供。',
    code: prompt || undefined,
  }
  switch (agent) {
    case 'claude-code':
      return {
        lede: '只需 3 個步驟，大約 1 分鐘。Claude Code 隨後即可代表您在此畫布上進行設計。',
        steps: [
          {
            title: '將 Doop 新增為 MCP 伺服器',
            body: (
              <>
                在任何終端機中執行一次此指令。這會為所有專案註冊 <code>doop</code> 伺服器。
              </>
            ),
            code: `claude mcp add --transport http doop "${mcpUrl}"`,
          },
          {
            title: '從 Claude Code 登入驗證',
            body: (
              <>
                在 Claude Code 中輸入 <code>/mcp</code>，選擇 <strong>doop</strong>，然後選擇{' '}
                <strong>Authenticate</strong>。系統會開啟瀏覽器分頁供您核准連線。
              </>
            ),
          },
          pointAt,
        ],
      }
    case 'claude':
      if (claudeConnection === 'desktop') {
        return {
          lede: '從桌面端應用程式新增 Doop，在 Claude 中確認後即可開始共同設計。',
          steps: [
            {
              title: '新增 Doop 至 Claude Desktop',
              body: '在 Doop 桌面端應用中點擊「新增至 Claude」，並在 Claude 中確認安裝。系統會自動填入您的 Doop 伺服器位址。',
              action: <ClaudeDesktopInstall mcpUrl={mcpUrl} />,
            },
            {
              title: '連線您的 Doop 帳號',
              body: '在 Claude 中啟用擴充功能。在開啟的瀏覽器中登入 Doop 並核准連線。',
            },
            {
              ...pointAt,
              body: prompt
                ? '開啟新的 Claude 對話，在工具選單中啟用 Doop，並將此作為第一則訊息傳送。'
                : '開啟新的 Claude 對話，在工具選單中啟用 Doop，並指定要在哪個畫布上工作。',
            },
          ],
        }
      }
      if (!claudeConnectorInstallUrl(mcpUrl)) {
        return {
          lede: 'Claude 的線上連接器需要公開可連線的 HTTPS 伺服器位址。',
          steps: [
            {
              title: '在此伺服器使用桌面端連線',
              body: '此 Doop 位址為本機位址或使用 HTTP。請在上方選擇「桌面端應用」從電腦連線，或在公開 HTTPS 位址上開啟 Doop。',
            },
          ],
        }
      }
      return {
        lede: '將 Doop 加入您的 Claude 帳號，核准連線後即可開始設計。無需下載任何檔案。',
        steps: [
          {
            title: '將 Doop 新增至 Claude',
            body: '開啟 Claude，Doop 的名稱與伺服器位址已為您預先填妥。檢視詳細資訊並新增連接器。',
            action: (
              <Button asChild variant="solid" className="mt-2.5">
                <a
                  href={claudeConnectorInstallUrl(mcpUrl)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => posthog.capture('claude_connector_opened')}
                >
                  新增至 Claude
                </a>
              </Button>
            ),
          },
          {
            title: '核准登入連線',
            body: '在新增的連接器上點擊連線。系統會開啟瀏覽器分頁供您核准授權。',
          },
          {
            ...pointAt,
            body: prompt
              ? '在新的對話中於工具選單下方啟用 Doop，並將此作為第一則訊息傳送。'
              : '在新的對話中於工具選單下方啟用 Doop，並指定要在哪個畫布上工作。',
          },
        ],
      }
    case 'chatgpt':
      if (!canUseChatGPTPublicEndpoint(mcpUrl)) {
        return {
          lede: 'ChatGPT 需要公開 HTTPS 位址或安全通道才能連線至此 Doop 伺服器。',
          steps: [
            {
              title: '使您的 Doop 伺服器可對外連線',
              body: 'ChatGPT 無法直接連線至此位址。請開啟您的公開 HTTPS Doop 位址並在此處發起連線，或為此伺服器設定 OpenAI Secure MCP Tunnel。',
              code: mcpUrl,
              action: (
                <Button asChild variant="solid" className="mt-2.5">
                  <a href={CHATGPT_CONNECTION_GUIDE} target="_blank" rel="noopener noreferrer">
                    檢視 ChatGPT 設定指南
                  </a>
                </Button>
              ),
            },
          ],
        }
      }
      return {
        lede: '無需下載。開啟 ChatGPT，貼上下方的伺服器位址，並核准 Doop 連線。',
        steps: [
          {
            title: '開啟 ChatGPT 外掛程式（Plugins）',
            body: (
              <>
                點擊外掛程式頁面上的 <strong>+</strong> 按鈕，然後選擇 <strong>新增自訂 MCP 伺服器</strong>。
                您的帳號或工作區必須允許自訂伺服器。
              </>
            ),
            action: (
              <Button asChild variant="solid" className="mt-2.5">
                <a
                  href={CHATGPT_PLUGINS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => posthog.capture('chatgpt_connection_opened')}
                >
                  開啟 ChatGPT 設定
                </a>
              </Button>
            ),
          },
          {
            title: '新增 Doop 並登入',
            body: (
              <>
                將其命名為 <strong>Doop</strong>，簡介填寫為設計畫布，並將此網址貼為 MCP 伺服器 URL。
                選擇 <strong>OAuth</strong>，檢視權限後選擇 <strong>建立為外掛程式</strong>。
                依提示登入 Doop 並完成安裝。
              </>
            ),
            code: mcpUrl,
          },
          {
            ...pointAt,
            body: prompt
              ? '開啟新的對話，輸入 @ 並選擇 Doop，然後將此作為第一則訊息傳送。'
              : '開啟新的對話，輸入 @ 並選擇 Doop，然後指定要在哪個畫布上工作。',
          },
        ],
      }
    case 'codex':
      return {
        lede: '從桌面端應用程式新增 Doop，登入後即可開始使用 Codex 進行設計。',
        steps: [
          {
            title: '新增 Doop 至 Codex',
            body: 'Doop Desktop 會為您自動設定 Codex。支援 Codex CLI 以及 ChatGPT 桌面應用的 Codex 分頁。',
            action: <CodexInstall mcpUrl={mcpUrl} canvasId={canvasId} />,
          },
          {
            title: '從 Codex 登入',
            body: '開啟新的 Codex 對話。若 Doop 需要驗證，請從其 MCP 設定中登入。若使用 Codex CLI，請執行下方指令並於瀏覽器中核准連線。',
            code: 'codex mcp login doop',
          },
          pointAt,
        ],
      }
    case 'cursor':
      return {
        lede: '將 Doop 新增至 Cursor，登入後即可一同協同設計。',
        steps: [
          {
            title: '新增 Doop 至 Cursor',
            body: '開啟 Cursor 並檢視伺服器連線。無需下載任何檔案。',
            action: <CursorInstall mcpUrl={mcpUrl} />,
          },
          {
            title: '核准登入連線',
            body: '在 Cursor 中啟用 doop 伺服器並完成瀏覽器登入授權。您的 Agent 即可存取您有權限的畫布。',
          },
          {
            ...pointAt,
            body: prompt
              ? '開啟 Agent 對話並將此作為第一則訊息傳送。'
              : '開啟 Agent 對話並指定要在哪個畫布上工作。',
          },
        ],
      }
    case 'mcp':
      return {
        lede: 'Doop 是一座支援串流 HTTP 與 OAuth 的 MCP 伺服器。任何支援該標準的客戶端均可在此設計。',
        steps: [
          {
            title: "將此伺服器新增至客戶端的 MCP 設定檔",
            body: (
              <>
                Windsurf、Zed、Cline 與 VS Code 皆讀取類似這樣的 JSON 設定檔。將 <code>doop</code> 設定項目貼入其中。
              </>
            ),
            code: jsonConfig,
          },
          {
            title: '核准登入連線',
            body: '客戶端首次連線時，會開啟瀏覽器分頁進行授權。Agent 隨後將以您的身分執行，所有變更皆記錄於您的名下。',
          },
          pointAt,
        ],
      }
  }
}

function AgentSteps({
  agent,
  canvasId,
  showAgentStatus,
  onBack,
  onClose,
}: {
  agent: AgentId
  canvasId?: string
  showAgentStatus: boolean
  onBack: () => void
  onClose: () => void
}) {
  const option = agentById(agent)
  const mcpUrl = `${location.origin}/mcp`
  const [claudeConnection, setClaudeConnection] = useState<ClaudeConnection>(() =>
    canAddToClaudeDesktop() || !claudeConnectorInstallUrl(mcpUrl) ? 'desktop' : 'web',
  )
  /* Deliberately thin: the MCP server ships its own INSTRUCTIONS on connect and the
     rest lives behind get_guide. The only thing this prompt knows that they don't is
     which canvas the human is looking at. */
  const prompt = canvasId
    ? `請在 Doop 畫布 ${canvasId} 上進行設計。首先呼叫 get_guide({ topic: "doop-instructions" }) 並遵循其指引。`
    : ''
  const { lede, steps } = agentSteps(agent, mcpUrl, prompt, claudeConnection, canvasId)
  return (
    <>
      <div className={body}>
        <div className="flex items-center gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-[11px] border border-line-soft bg-paper">
            {option.icon}
          </span>
          <div>
            <ModalTitle>連線 {option.name}</ModalTitle>
            <ModalLede className="mt-1">{lede}</ModalLede>
          </div>
        </div>

        {agent === 'claude' && (
          <div className="mt-5 flex gap-2" role="group" aria-label="Claude 連線方式">
            {(['web', 'desktop'] as const).map((connection) => (
              <Button
                key={connection}
                size="sm"
                variant={claudeConnection === connection ? 'solid' : 'ghost'}
                aria-pressed={claudeConnection === connection}
                onClick={() => setClaudeConnection(connection)}
              >
                {connection === 'desktop' ? '桌面端應用' : '線上連線'}
              </Button>
            ))}
          </div>
        )}

        <ol className="mt-6">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className={cn('grid grid-cols-[28px_1fr] gap-3.5', i > 0 && 'mt-3.5 border-t border-line-soft pt-3.5')}
            >
              <span className="mt-px grid size-[26px] place-items-center rounded-full bg-ink text-xs font-bold text-white">
                {i + 1}
              </span>
              <div>
                <h4 className="text-copy font-semibold text-ink">{step.title}</h4>
                <p className="mt-0.5 text-body leading-[1.5] text-ink-soft [&_code]:rounded-[4px] [&_code]:bg-paper-deep [&_code]:px-1 [&_code]:font-mono [&_code]:text-caption [&_code]:text-ink">
                  {step.body}
                </p>
                {step.code && <CodeBlock text={step.code} className="mt-2.5" />}
                {step.action}
              </div>
            </li>
          ))}
        </ol>

        {agent === 'claude' && claudeConnection === 'web' && claudeConnectorInstallUrl(mcpUrl) && (
          <Disclosure label="連線說明" className="mt-4 text-label leading-relaxed text-ink-soft">
            <p>
              若 Claude 要求您先登入，請返回此處並再次點擊「新增至 Claude」。您也可以在 Claude 中透過{' '}
              <strong>自訂 → 連接器 → 新增自訂連接器</strong> 並填入以下位址：
            </p>
            <CodeBlock text={mcpUrl} className="mt-2" />
          </Disclosure>
        )}

        {agent === 'mcp' && (
          <p className="mt-4 text-xs leading-[1.5] text-ink-faint">
            沒有瀏覽器可供登入（例如 n8n、Mastra、CI）？您可以在{' '}
            <button
              type="button"
              className="font-medium text-accent-ink underline underline-offset-2"
              onClick={() =>
                navigate(`/settings?pane=keys${canvasId ? `&from=${encodeURIComponent(`/c/${canvasId}`)}` : ''}`)
              }
            >
              設定 → 代理金鑰
            </button>{' '}
            產生代理金鑰，並以 <code>Authorization: Bearer &lt;key&gt;</code> 標頭傳送。金鑰代表您的身分，具有您可存取畫布的相同權限。
          </p>
        )}
      </div>

      <ModalActions className={footer}>
        {canvasId && showAgentStatus ? <AgentArrival name={option.name} /> : <ModalSpacer />}
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-sm px-2 py-2 text-xs font-medium text-ink-soft hover:text-ink"
          onClick={onBack}
        >
          <ChevronLeftIcon width={14} height={14} />
          返回
        </button>
        <Button onClick={onClose}>完成</Button>
      </ModalActions>
    </>
  )
}

/* ---------- shared pieces ---------- */

/* The modal is a column: the screen's body scrolls in the middle and the
   action row sits on the bottom edge, so the back button and the main action
   stay in reach on the long agent screens (the JSON config plus the headless
   note runs past a laptop viewport). */
const body = 'min-h-0 flex-1 overflow-y-auto p-5'
const footer = 'mt-0 shrink-0 items-center border-t border-line-soft bg-surface px-5 py-4'

function ChoiceCard({
  selected,
  onClick,
  icon,
  title,
  blurb,
}: {
  selected: boolean
  onClick: () => void
  icon: ReactNode
  title: string
  blurb: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-3 rounded-card border bg-surface py-3.5 pl-3.5 pr-9 text-left text-ink transition-colors',
        selected ? 'border-brand' : 'border-line hover:border-ink-faint',
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-[9px] border border-line-soft bg-paper">
        {icon}
      </span>
      <span className="block">
        <span className="block text-copy font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-[1.5] text-ink-soft">{blurb}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          'absolute right-4 top-1/2 size-4 -translate-y-1/2 rounded-full border',
          selected ? 'border-[5px] border-brand' : 'border-line',
        )}
      />
    </button>
  )
}

/** Live connection status: flips the moment an outside (non-resident) agent
 *  joins this canvas's presence, so nobody is left wondering whether the
 *  OAuth dance actually worked. */
export function AgentArrival({ name }: { name?: string }) {
  const presences = useStore((s) => s.presences)
  const arrived = useMemo(
    () => Object.values(presences).find((p) => p.kind === 'agent' && !roleByAgentName(p.name)),
    [presences],
  )
  return arrived ? (
    <span className="mr-auto inline-flex items-center gap-[7px] text-body text-success-ink">
      <CheckIcon size={14} />
      {arrived.name} 已連線 — 成功加入
    </span>
  ) : (
    <span className="mr-auto inline-flex items-center gap-[7px] text-body text-ink-faint">
      <Dot className="animate-[arrival-pulse_1.6s_ease-in-out_infinite] bg-brand" /> 正在等待{' '}
      {name ?? '您的 Agent'}……
    </span>
  )
}
