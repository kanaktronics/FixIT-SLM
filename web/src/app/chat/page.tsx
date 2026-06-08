'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mode, Message, Conversation, MODES } from '@/types'
import { parseResponse, extractTitle, detectMode } from '@/lib/parseResponse'
import Sidebar from '@/components/Sidebar'
import ChatThread from '@/components/ChatThread'
import InputBar from '@/components/InputBar'
import TopNav from '@/components/TopNav'

let msgCounter = 0
const uid = () => `msg-${++msgCounter}-${Date.now()}`

export default function ChatPage() {
  const [activeMode, setActiveMode]           = useState<Mode>('troubleshoot')
  const [conversations, setConversations]     = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId]       = useState<string | null>(null)
  const [isThinking, setIsThinking]           = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const activeConv = conversations.find(c => c.id === activeConvId) ?? null

  // Start a new conversation
  const newConversation = useCallback(() => {
    setActiveConvId(null)
  }, [])

  // Switch conversation
  const selectConversation = useCallback((id: string) => {
    setActiveConvId(id)
    const conv = conversations.find(c => c.id === id)
    if (conv) setActiveMode(conv.mode)
  }, [conversations])

  // Handle sending a message
  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isThinking) return

    // Auto-detect mode if not manually set
    const detectedMode = detectMode(text) as Mode

    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    let convId = activeConvId

    // Create new conversation if needed
    if (!convId) {
      convId = `conv-${Date.now()}`
      const newConv: Conversation = {
        id: convId,
        title: extractTitle(text),
        messages: [userMsg],
        mode: detectedMode,
        createdAt: new Date(),
      }
      setConversations(prev => [newConv, ...prev])
      setActiveConvId(convId)
    } else {
      setConversations(prev =>
        prev.map(c =>
          c.id === convId
            ? { ...c, messages: [...c.messages, userMsg] }
            : c
        )
      )
    }

    // Build context prompt
    const modeConfig = MODES.find(m => m.id === detectedMode)!
    const systemHint = `You are responding in ${modeConfig.label} mode. Structure your response using these sections: ${modeConfig.sections.join(', ')}.`

    const conv = conversations.find(c => c.id === convId)
    const history = conv
      ? conv.messages.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'FIXIT'}: ${m.content}`).join('\n')
      : ''

    const fullPrompt = history
      ? `${history}\nUser: ${text}`
      : text

    // Add placeholder assistant message
    const assistantMsgId = uid()
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      mode: detectedMode,
      sections: [],
      timestamp: new Date(),
    }

    setConversations(prev =>
      prev.map(c =>
        c.id === convId
          ? { ...c, messages: [...c.messages, assistantMsg] }
          : c
      )
    )

    setIsThinking(true)

    try {
      abortRef.current = new AbortController()

      // Call Ollama via our API route (avoids CORS issues)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({ prompt: fullPrompt, systemHint }),
      })

      if (!res.ok) throw new Error(`API error: ${res.status}`)
      if (!res.body) throw new Error('No response body')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk

        const sections = parseResponse(fullText)
        setConversations(prev =>
          prev.map(c =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map(m =>
                    m.id === assistantMsgId
                      ? { ...m, content: fullText, sections }
                      : m
                  ),
                }
              : c
          )
        )
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return

      // Show error in the assistant message
      setConversations(prev =>
        prev.map(c =>
          c.id === convId
            ? {
                ...c,
                messages: c.messages.map(m =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: 'Connection error. Make sure Ollama is running with the fixit-slm model.\n\nRun: ollama run fixit-slm',
                        sections: parseResponse('**Error**\nConnection error. Make sure Ollama is running with the fixit-slm model.\n\nRun: `ollama run fixit-slm`'),
                      }
                    : m
                ),
              }
            : c
        )
      )
    } finally {
      setIsThinking(false)
      abortRef.current = null
    }
  }, [activeConvId, conversations, isThinking])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setIsThinking(false)
  }, [])

  return (
    <div className="app-layout">
      <TopNav />
      <Sidebar
        activeMode={activeMode}
        onModeChange={setActiveMode}
        conversations={conversations}
        activeConvId={activeConvId}
        onSelectConversation={selectConversation}
        onNewChat={newConversation}
      />
      <main className="main-area">
        <ChatThread
          messages={activeConv?.messages ?? []}
          isThinking={isThinking}
          activeMode={activeMode}
        />
        <InputBar
          onSend={handleSend}
          onStop={handleStop}
          isThinking={isThinking}
          activeMode={activeMode}
        />
      </main>
    </div>
  )
}
