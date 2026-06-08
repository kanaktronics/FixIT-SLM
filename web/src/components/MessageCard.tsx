'use client'

import { useState } from 'react'
import { Message, MODES } from '@/types'

interface Props {
  message: Message
}

export default function MessageCard({ message }: Props) {
  const [openSections, setOpenSections] = useState<Set<number>>(() => new Set([0, 1, 4]))

  const modeConfig = MODES.find(m => m.id === message.mode)
  const sections   = message.sections || []

  const toggleSection = (index: number) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  // If no sections parsed yet (still streaming), show raw text
  if (sections.length === 0 && message.content) {
    return (
      <div>
        {modeConfig && (
          <div className="response-header">
            <div className="response-mode-badge">
              <span className="response-mode-dot" style={{ background: modeConfig.color }} />
              {modeConfig.label}
            </div>
          </div>
        )}
        <div className="section-card open">
          <div className="section-body" style={{ padding: 'var(--s5)' }}>
            <p className="section-content">{message.content}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {modeConfig && (
        <div className="response-header">
          <div className="response-mode-badge">
            <span className="response-mode-dot" style={{ background: modeConfig.color }} />
            {modeConfig.label}
          </div>
        </div>
      )}

      <div className="response-cards">
        {sections.map((section, i) => {
          const isOpen    = openSections.has(i)
          const cardClass = ['section-card', isOpen ? 'open' : '', section.variant ?? ''].filter(Boolean).join(' ')

          return (
            <div key={i} className={cardClass} style={{ animationDelay: `${i * 40}ms` }}>
              <button
                className="section-header"
                id={`section-${message.id}-${i}`}
                aria-expanded={isOpen}
                onClick={() => toggleSection(i)}
              >
                <div className="section-header-left">
                  <span className="section-number">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="section-title">{section.title}</span>
                </div>
                <svg
                  className="section-chevron"
                  width="16" height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              <div className={`section-body ${isOpen ? '' : 'collapsed'}`}>
                <SectionContent content={section.content} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SectionContent({ content }: { content: string }) {
  // Detect numbered lists (1. 2. 3.)
  const hasNumberedList = /^\d+\.\s/m.test(content)

  if (hasNumberedList) {
    const lines = content.split('\n')
    const items: string[] = []
    const prose: string[] = []

    for (const line of lines) {
      if (/^\d+\.\s/.test(line.trim())) {
        items.push(line.replace(/^\d+\.\s/, '').trim())
      } else if (line.trim()) {
        prose.push(line)
      }
    }

    return (
      <>
        {prose.length > 0 && (
          <p className="section-content" style={{ marginBottom: items.length ? 'var(--s4)' : 0 }}>
            {prose.join('\n')}
          </p>
        )}
        {items.length > 0 && (
          <div className="steps-list">
            {items.map((item, i) => (
              <div key={i} className="step-item">
                <span className="step-num">{i + 1}</span>
                <span className="step-text">{item}</span>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  // Bullet lists
  if (/^[-•]\s/m.test(content)) {
    return (
      <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {content.split('\n').filter(Boolean).map((line, i) => (
          <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            {/^[-•]/.test(line.trim()) && (
              <span style={{ color: 'var(--text-tertiary)', marginTop: '2px', flexShrink: 0 }}>—</span>
            )}
            <span className="section-content" style={{ display: 'inline' }}>
              {line.replace(/^[-•]\s/, '')}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  return <p className="section-content">{content}</p>
}
