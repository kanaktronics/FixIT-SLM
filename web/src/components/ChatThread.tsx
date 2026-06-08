'use client'

import { useEffect, useRef } from 'react'
import { Message, Mode, MODES } from '@/types'
import MessageCard from '@/components/MessageCard'

const EXAMPLE_PROMPTS: Record<Mode, { label: string; text: string }[]> = {
  troubleshoot: [
    { label: 'Electronics', text: 'My laptop fan runs at full speed even when idle.' },
    { label: 'Networking',  text: 'My WiFi keeps disconnecting every few minutes.' },
  ],
  learn: [
    { label: 'Engineering', text: 'How does a PID controller work?' },
    { label: 'Computing',   text: 'How does RAM differ from storage?' },
  ],
  build: [
    { label: 'IoT',         text: 'Help me build a home weather station.' },
    { label: 'Electronics', text: 'How do I build a simple inverter circuit?' },
  ],
  engineer: [
    { label: 'Software',    text: 'What are the tradeoffs between microservices and a monolith?' },
    { label: 'Materials',   text: 'Should I use aluminum or steel for a load-bearing bracket?' },
  ],
  decide: [
    { label: 'Database',    text: 'Should I use PostgreSQL or MongoDB?' },
    { label: 'Hardware',    text: 'Should I buy a used car or a new car?' },
  ],
  reality: [
    { label: 'Startup',     text: 'I want to build an AI startup that competes with ChatGPT in 6 months with a 3-person team.' },
    { label: 'Finance',     text: 'I want to quit my job and day-trade stocks full time.' },
  ],
}

interface Props {
  messages: Message[]
  isThinking: boolean
  activeMode: Mode
}

export default function ChatThread({ messages, isThinking, activeMode }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  const modeConfig = MODES.find(m => m.id === activeMode)!
  const examples   = EXAMPLE_PROMPTS[activeMode]

  if (messages.length === 0) {
    return (
      <div className="chat-thread">
        <div className="empty-state">
          <h2 className="empty-title">What do you need to fix?</h2>
          <p className="empty-subtitle">
            Select a mode from the sidebar, then describe your problem, question, or project.
          </p>

          <div className="empty-prompts">
            {examples.map((ex, i) => (
              <div key={i} className="prompt-chip">
                <div
                  className="prompt-chip-label"
                  style={{ color: modeConfig.color }}
                >
                  {ex.label}
                </div>
                <div className="prompt-chip-text">{ex.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-thread" role="log" aria-live="polite" aria-label="Chat messages">
      {messages.map((msg, index) => (
        <div key={msg.id} className="message-group" style={{ animationDelay: `${index * 20}ms` }}>
          {msg.role === 'user' ? (
            <div className="user-message">
              <div className="user-bubble">{msg.content}</div>
            </div>
          ) : (
            <MessageCard message={msg} />
          )}
        </div>
      ))}

      {isThinking && (
        <div className="message-group">
          <div className="thinking" role="status" aria-label="FIXIT SLM is thinking">
            <div className="thinking-dots" aria-hidden="true">
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
            </div>
            <span className="thinking-label">Analyzing...</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
