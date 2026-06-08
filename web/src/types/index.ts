export type Mode =
  | 'troubleshoot'
  | 'learn'
  | 'build'
  | 'engineer'
  | 'decide'
  | 'reality'

export interface ModeConfig {
  id: Mode
  label: string
  color: string
  placeholder: string
  sections: string[]
}

export const MODES: ModeConfig[] = [
  {
    id: 'troubleshoot',
    label: 'Troubleshoot',
    color: 'var(--mode-troubleshoot)',
    placeholder: 'Describe the problem — e.g. "My laptop fan runs at full speed even when idle."',
    sections: [
      'What is happening?',
      'Why is it happening?',
      'Real-life example',
      'How professionals approach it',
      'Step-by-step solution',
      'Common mistakes',
      'How to verify success',
    ],
  },
  {
    id: 'learn',
    label: 'Learn',
    color: 'var(--mode-learn)',
    placeholder: 'Ask what or how — e.g. "How does a PID controller work?"',
    sections: [
      'What is this?',
      'Why it works this way',
      'Real-life analogy',
      'How professionals think about it',
      'Hands-on demonstration',
      'Common misconceptions',
      'How to verify your understanding',
    ],
  },
  {
    id: 'build',
    label: 'Build',
    color: 'var(--mode-build)',
    placeholder: 'Describe what you want to build — e.g. "Help me build a home weather station."',
    sections: [
      'Project goal',
      'Required components',
      'Architecture',
      'Step-by-step build',
      'Testing process',
      'Common failure points',
      'How to verify success',
    ],
  },
  {
    id: 'engineer',
    label: 'Engineer',
    color: 'var(--mode-engineer)',
    placeholder: 'Ask about tradeoffs — e.g. "What are the tradeoffs between microservices and a monolith?"',
    sections: [
      'The engineering context',
      'Key tradeoffs',
      'Real-world application',
      'How engineers decide',
      'Step-by-step evaluation',
      'Common mistakes',
      'How to verify the right choice',
    ],
  },
  {
    id: 'decide',
    label: 'Decide',
    color: 'var(--mode-decide)',
    placeholder: 'Compare options — e.g. "Should I use PostgreSQL or MongoDB?"',
    sections: [
      'Understanding the decision',
      'Option comparison',
      'Real-life example',
      'How experts evaluate this',
      'Decision framework',
      'Common mistakes',
      'Recommendation',
    ],
  },
  {
    id: 'reality',
    label: 'Reality Check',
    color: 'var(--mode-reality)',
    placeholder: 'Share your plan — e.g. "I want to build an AI startup that competes with ChatGPT in 6 months."',
    sections: [
      'What you are proposing',
      'What sounds good',
      'What will actually happen',
      'Hidden challenges',
      'Better approach',
      'Success probability assessment',
      'How to verify you are on the right track',
    ],
  },
]

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  mode?: Mode
  sections?: Section[]
  timestamp: Date
}

export interface Section {
  title: string
  content: string
  index: number
  variant?: 'default' | 'warning' | 'success'
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  mode: Mode
  createdAt: Date
}
