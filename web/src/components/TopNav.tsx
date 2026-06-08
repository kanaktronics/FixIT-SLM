import Link from 'next/link'

export default function TopNav() {
  return (
    <header className="top-nav" role="banner">
      <div className="nav-wordmark">
        <div className="nav-logo-mark" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 8h12M8 2l4 6-4 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="nav-title">FIXIT SLM</span>
        <span className="nav-badge">Beta</span>
      </div>

      <nav className="nav-right" aria-label="Top navigation">
        <Link href="/" className="nav-btn">Home</Link>
        <button className="nav-btn primary" id="new-chat-top-btn">New chat</button>
      </nav>
    </header>
  )
}
