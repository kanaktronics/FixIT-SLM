'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Mode, MODES } from '@/types'

interface Props {
  onSend:    (text: string) => void
  onStop:    () => void
  isThinking: boolean
  activeMode: Mode
}

export default function InputBar({ onSend, onStop, isThinking, activeMode }: Props) {
  const [value, setValue]   = useState('')
  const textareaRef         = useRef<HTMLTextAreaElement>(null)
  const modeConfig          = MODES.find(m => m.id === activeMode)!

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [value])

  const handleSend = () => {
    if (!value.trim() || isThinking) return
    onSend(value.trim())
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasText = value.trim().length > 0

  return (
    <div className="input-area">
      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          id="chat-input"
          className="input-field"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={modeConfig.placeholder}
          rows={1}
          disabled={isThinking}
          aria-label="Message input"
          aria-describedby="input-hint"
        />

        <div className="input-actions">
          <span
            className="input-mode-badge"
            style={{ color: modeConfig.color, borderColor: `${modeConfig.color}30` }}
          >
            {modeConfig.label}
          </span>

          {isThinking ? (
            <button
              className="send-btn active"
              id="stop-btn"
              onClick={onStop}
              aria-label="Stop generating"
              title="Stop"
            >
              <svg viewBox="0 0 16 16" fill="none">
                <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor"/>
              </svg>
            </button>
          ) : (
            <button
              className={`send-btn${hasText ? ' active' : ''}`}
              id="send-btn"
              onClick={handleSend}
              disabled={!hasText}
              aria-label="Send message"
              title="Send (Enter)"
            >
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M2 8h12M9 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>
      <p className="input-hint" id="input-hint">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  )
}
