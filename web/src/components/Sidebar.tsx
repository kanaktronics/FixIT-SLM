'use client'

import { Mode, Conversation, MODES } from '@/types'

interface Props {
  activeMode: Mode
  onModeChange: (mode: Mode) => void
  conversations: Conversation[]
  activeConvId: string | null
  onSelectConversation: (id: string) => void
  onNewChat: () => void
}

function formatTime(date: Date): string {
  const now  = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 60000)       return 'Just now'
  if (diff < 3600000)     return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000)    return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Sidebar({
  activeMode,
  onModeChange,
  conversations,
  activeConvId,
  onSelectConversation,
  onNewChat,
}: Props) {
  return (
    <aside className="sidebar" aria-label="Sidebar">

      {/* Mode selector */}
      <div className="sidebar-section">
        <div className="sidebar-label">Mode</div>
        <div className="mode-list" role="listbox" aria-label="Response mode">
          {MODES.map(mode => (
            <div
              key={mode.id}
              className={`mode-item${activeMode === mode.id ? ' active' : ''}`}
              role="option"
              aria-selected={activeMode === mode.id}
              id={`mode-${mode.id}`}
              onClick={() => onModeChange(mode.id)}
            >
              <span
                className="mode-dot"
                style={{ background: mode.color }}
                aria-hidden="true"
              />
              <span className="mode-name">{mode.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Conversation history */}
      <div className="sidebar-section" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="sidebar-label">History</div>

        <button className="new-chat-btn" id="new-chat-btn" onClick={onNewChat}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          New chat
        </button>

        <div className="history-scroll">
          {conversations.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', padding: '4px 8px' }}>
              No conversations yet.
            </p>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className="history-item"
                id={`conv-${conv.id}`}
                onClick={() => onSelectConversation(conv.id)}
                style={activeConvId === conv.id ? { background: 'var(--bg-elevated)' } : {}}
              >
                <div className="history-item-text">{conv.title}</div>
                <div className="history-item-meta">
                  <span style={{ color: MODES.find(m => m.id === conv.mode)?.color }}>
                    {MODES.find(m => m.id === conv.mode)?.label}
                  </span>
                  {' · '}
                  {formatTime(conv.createdAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  )
}
