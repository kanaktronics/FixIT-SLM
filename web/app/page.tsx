'use client';

import React, { useState, useEffect } from 'react';

export default function Home() {
  const initialSystemMessage = { role: 'system', content: 'System initialized. FIXIT SLM is ready for diagnostic queries.' };
  
  const [chatId, setChatId] = useState('');
  const [messages, setMessages] = useState<{role: string, content: string}[]>([initialSystemMessage]);
  const [input, setInput] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [history, setHistory] = useState<{id: string, title: string, messages: any[]}[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load history on mount
  useEffect(() => {
    setChatId(Date.now().toString());
    const saved = localStorage.getItem('fixit-history');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
    
    fetch('http://localhost:11434/')
      .then(res => { if (res.ok) setIsOnline(true); })
      .catch(() => setIsOnline(false));
  }, []);

  // Auto-save history when messages change
  useEffect(() => {
    if (messages.length > 1 && chatId) {
      setHistory(prev => {
        const existing = prev.find(h => h.id === chatId);
        let newHistory;
        if (existing) {
          newHistory = prev.map(h => h.id === chatId ? { ...h, messages } : h);
        } else {
          const title = messages[1].content.slice(0, 25) + (messages[1].content.length > 25 ? '...' : '');
          newHistory = [{ id: chatId, title, messages }, ...prev];
        }
        localStorage.setItem('fixit-history', JSON.stringify(newHistory));
        return newHistory;
      });
    }
  }, [messages, chatId]);

  const handleNewChat = () => {
    setChatId(Date.now().toString());
    setMessages([initialSystemMessage]);
  };

  const loadChat = (id: string) => {
    const chat = history.find(h => h.id === id);
    if (chat) {
      setChatId(id);
      setMessages(chat.messages);
    }
  };

  const handleDownload = () => {
    const text = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n====================\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FIXIT_Analysis_${chatId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSettings = () => {
    setIsSettingsOpen(true);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    const currentInput = input;
    setInput('');
    
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'fixit-slm',
          prompt: currentInput,
          stream: false
        })
      });
      
      const data = await response.json();
      if (response.ok) setIsOnline(true);
      
      setMessages(prev => [
        ...prev,
        { role: 'model', content: data.response || data.error || 'No response generated.' }
      ]);
      
    } catch (error) {
      setIsOnline(false);
      setMessages(prev => [
        ...prev,
        { role: 'model', content: '**Error:** Could not connect to Ollama. Model might still be downloading in the background.' }
      ]);
    }
  };

  return (
    <div style={styles.container}>
      {isSettingsOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsSettingsOpen(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} style={styles.closeButton}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>Backend</label>
                <div style={styles.settingValue}>http://localhost:11434</div>
              </div>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>Active Model</label>
                <div style={styles.settingValue}>fixit-slm</div>
              </div>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>Mode</label>
                <div style={styles.settingValue}>Local Inference</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h1 style={styles.logo}>FIXIT</h1>
          <p style={styles.version}>v1.0.0-rc</p>
        </div>
        
        <button onClick={handleNewChat} style={styles.newButton}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Analysis
        </button>

        <div style={styles.historySection}>
          <h3 style={styles.historyTitle}>Recent</h3>
          <ul style={styles.historyList}>
            {history.length === 0 && <li style={styles.historyItem}>No recent history</li>}
            {history.map(chat => (
              <li 
                key={chat.id}
                onClick={() => loadChat(chat.id)}
                style={chat.id === chatId ? styles.historyItemActive : styles.historyItem}
              >
                {chat.title}
              </li>
            ))}
          </ul>
        </div>
        
        <div style={styles.sidebarFooter}>
          <div style={styles.statusIndicator}>
            <div style={{
              ...styles.statusDot, 
              backgroundColor: isOnline ? 'var(--accent)' : '#ff4444'
            }}></div>
            Model: {isOnline ? 'Online (fixit-slm)' : 'Offline'}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        <header style={styles.mainHeader}>
          <h2 style={styles.headerTitle}>
            {history.find(h => h.id === chatId)?.title || 'Hardware Diagnostics'}
          </h2>
          <div style={styles.headerActions}>
            <button onClick={handleDownload} style={styles.iconButton} title="Export Analysis">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
            <button onClick={handleSettings} style={styles.iconButton} title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          </div>
        </header>

        <div style={styles.chatContainer}>
          <div style={styles.messagesWrapper}>
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                style={{
                  ...styles.messageRow, 
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={
                  msg.role === 'user' 
                    ? styles.messageUser 
                    : msg.role === 'system' 
                      ? styles.messageSystem 
                      : styles.messageModel
                }>
                  {msg.role !== 'user' && (
                    <div style={styles.messageRole}>
                      {msg.role === 'system' ? 'SYSTEM' : 'FIXIT'}
                    </div>
                  )}
                  <div style={styles.messageContent}>
                    {(msg.content || '').split('\n').map((line, i) => {
                      if (line.startsWith('**')) {
                        return <h4 key={i} style={styles.sectionHeader}>{line.replace(/\*\*/g, '')}</h4>
                      }
                      return <p key={i} style={styles.paragraph}>{line}</p>
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.inputContainer}>
          <form onSubmit={handleSend} style={styles.inputForm}>
            <textarea 
              style={styles.textarea} 
              placeholder="Describe the issue you are observing..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              rows={1}
            />
            <button type="submit" style={styles.sendButton} disabled={!input.trim()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
          <div style={styles.inputFooter}>
            FIXIT SLM may produce inaccurate results. Verify critical solutions.
          </div>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-pure)',
  },
  sidebar: {
    width: '260px',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-surface)',
  },
  sidebarHeader: {
    padding: '24px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: 'var(--text-main)',
  },
  version: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  newButton: {
    margin: '20px',
    padding: '10px 16px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-main)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 500,
    borderRadius: '4px',
  },
  historySection: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px',
  },
  historyTitle: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--text-muted)',
    marginBottom: '12px',
    fontWeight: 600,
  },
  historyList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  historyItem: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  historyItemActive: {
    fontSize: '13px',
    color: 'var(--accent)',
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  sidebarFooter: {
    padding: '16px 20px',
    borderTop: '1px solid var(--border)',
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#ff4444', // Red for offline, can change to var(--accent) when online
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  mainHeader: {
    height: '60px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
  },
  headerTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-main)',
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
  },
  iconButton: {
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 0',
  },
  messagesWrapper: {
    maxWidth: '800px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    padding: '0 24px',
  },
  messageRow: {
    display: 'flex',
    width: '100%',
  },
  messageSystem: {
    maxWidth: '80%',
    padding: '12px 16px',
    borderLeft: '2px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: '13px',
    fontFamily: 'monospace',
  },
  messageUser: {
    maxWidth: '80%',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    padding: '16px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    color: 'var(--text-main)',
  },
  messageModel: {
    maxWidth: '85%',
    padding: '16px 0',
    fontSize: '14px',
    color: 'var(--text-main)',
  },
  messageRole: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--accent)',
    marginBottom: '8px',
    letterSpacing: '0.5px',
  },
  messageContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionHeader: {
    fontSize: '13px',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    fontWeight: 600,
    letterSpacing: '0.5px',
    marginTop: '8px',
  },
  paragraph: {
    lineHeight: '1.6',
  },
  inputContainer: {
    borderTop: '1px solid var(--border)',
    padding: '24px',
    backgroundColor: 'var(--bg-pure)',
  },
  inputForm: {
    maxWidth: '800px',
    margin: '0 auto',
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    transition: 'border-color 0.2s',
  },
  textarea: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    padding: '16px',
    color: 'var(--text-main)',
    fontSize: '14px',
    resize: 'none',
    maxHeight: '200px',
    minHeight: '52px',
  },
  sendButton: {
    padding: '14px',
    color: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 1,
  },
  inputFooter: {
    maxWidth: '800px',
    margin: '12px auto 0',
    textAlign: 'center',
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    width: '400px',
    maxWidth: '90%',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
  },
  modalHeader: {
    padding: '20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-main)',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '24px',
    cursor: 'pointer',
    lineHeight: 1,
  },
  modalBody: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  settingRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  settingLabel: {
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  settingValue: {
    fontSize: '14px',
    color: 'var(--text-main)',
    backgroundColor: 'var(--bg-pure)',
    padding: '10px 12px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    fontFamily: 'monospace',
  }
};
