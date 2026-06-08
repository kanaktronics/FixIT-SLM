import Link from 'next/link'

const MODES = [
  { name: 'Troubleshoot', color: 'var(--mode-troubleshoot)', desc: 'Diagnose and fix broken things' },
  { name: 'Learn', color: 'var(--mode-learn)', desc: 'Understand how things work' },
  { name: 'Build', color: 'var(--mode-build)', desc: 'Create projects step by step' },
  { name: 'Engineer', color: 'var(--mode-engineer)', desc: 'Evaluate tradeoffs and constraints' },
  { name: 'Decide', color: 'var(--mode-decide)', desc: 'Compare options and choose wisely' },
  { name: 'Reality Check', color: 'var(--mode-reality)', desc: 'Honest assessment of your plan' },
]

export default function Home() {
  return (
    <main className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="nav-wordmark">
          <div className="nav-logo-mark">
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 8h12M8 2l4 6-4 6M2 4l3 4-3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="nav-title">FIXIT SLM</span>
          <span className="nav-badge">Beta</span>
        </div>
        <div className="nav-right">
          <button className="nav-btn">Documentation</button>
          <Link href="/chat" className="nav-btn primary">Launch App</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-grid" aria-hidden="true" />

        <div className="hero-eyebrow">
          <span className="hero-eyebrow-dot" />
          Fine-tuned Small Language Model
        </div>

        <h1 className="hero-title">
          Fix it. Build it.<br />Understand it.
        </h1>

        <p className="hero-subtitle">
          An ultra-practical AI that teaches you to think like an expert.
          Not just answers — structured reasoning, real examples, and step-by-step solutions.
        </p>

        <div className="hero-cta-group">
          <Link href="/chat" className="cta-primary">Start using FIXIT SLM</Link>
          <a
            href="https://github.com"
            className="cta-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>

        {/* Mode showcase */}
        <div className="modes-grid">
          {MODES.map((mode) => (
            <div key={mode.name} className="mode-card">
              <div className="mode-card-dot" style={{ background: mode.color }} />
              <div className="mode-card-name">{mode.name}</div>
              <div className="mode-card-desc">{mode.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
