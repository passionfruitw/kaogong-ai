import { create } from 'zustand'
import { Question } from '../data/types'

// Shared types
export interface WrongQuestion {
  question: Question
  userAnswer: string
  timestamp: number
}

export interface AnswerHistory {
  questionId: number
  userAnswer: string
  isCorrect: boolean
  timestamp: number
}

export interface VariantQuestion {
  question: string
  options?: string[]
  answer?: string
  explanation?: string
}

export type View = 'bank' | 'practice' | 'wrong' | 'ai-help' | 'stats' | 'exam-sets'
export type AISubView = 'socratic' | 'training'
export type PracticeMode = 'sequential' | 'undone' | 'wrong' | 'smart'

interface SocraticQuestionData {
  question: string
  options: string[]
  answer: string
  knowledgePoint: string
  module: string
}

interface AppState {
  // Navigation
  currentView: View
  aiSubView: AISubView
  setCurrentView: (view: View) => void
  setAiSubView: (view: AISubView) => void

  // Wrong questions
  wrongQuestions: WrongQuestion[]
  setWrongQuestions: (questions: WrongQuestion[]) => void
  addWrongQuestion: (wq: WrongQuestion) => void

  // Done questions
  doneQuestionIds: Set<number>
  markDone: (id: number) => void
  removeDone: (id: number) => void
  resetDone: () => void

  // Answer history
  answerHistory: AnswerHistory[]
  saveAnswer: (questionId: number, userAnswer: string, isCorrect: boolean) => void

  // Custom questions
  customQuestions: Question[]
  addCustomQuestion: (question: Question) => void

  // Bookmarks
  bookmarkedIds: Set<number>
  toggleBookmark: (id: number) => void

  // Practice navigation
  practiceQuestionId: number | undefined
  setPracticeQuestionId: (id: number | undefined) => void

  // Progress tracking
  examProgress: Record<string, number>
  practiceProgress: number
  saveExamProgress: (examSet: string, groupIndex: number) => void
  savePracticeProgress: (groupIndex: number) => void

  // Practice mode progress (每个模式独立进度)
  practiceModeProgress: Record<PracticeMode, number>
  savePracticeModeProgress: (mode: PracticeMode, groupIndex: number) => void

  // Practice mode
  practiceMode: PracticeMode
  setPracticeMode: (mode: PracticeMode) => void

  // Practice mode limits (每个模式的刷题数量限制)
  practiceLimits: Record<PracticeMode, number>
  setPracticeLimit: (mode: PracticeMode, limit: number) => void

  // Today stats
  todayStats: {
    date: string
    count: number
    correct: number
  }
  updateTodayStats: (isCorrect: boolean) => void

  // Socratic teaching
  socraticQuestion: SocraticQuestionData | null
  setSocraticQuestion: (data: SocraticQuestionData | null) => void

  // Training variants
  trainingVariants: VariantQuestion[]
  currentTrainingIndex: number
  originalQuestion: Question | null
  setTrainingVariants: (variants: VariantQuestion[]) => void
  setCurrentTrainingIndex: (index: number) => void
  setOriginalQuestion: (question: Question | null) => void
  nextTrainingQuestion: () => void
  clearTraining: () => void

  // Composite actions
  startPractice: (questionId: number, examSet?: string) => void
  goToSocratic: (data: SocraticQuestionData) => void
  practiceGenerated: (questions: VariantQuestion[], weakPoint?: { module: string; knowledgePoint: string }) => void
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  currentView: 'bank',
  aiSubView: 'socratic',
  setCurrentView: (view) => set({ currentView: view }),
  setAiSubView: (view) => set({ aiSubView: view }),

  // Wrong questions
  wrongQuestions: loadFromStorage<WrongQuestion[]>('wrongQuestions', []),
  setWrongQuestions: (questions) => {
    localStorage.setItem('wrongQuestions', JSON.stringify(questions))
    set({ wrongQuestions: questions })
  },
  addWrongQuestion: (wq) => {
    const { wrongQuestions } = get()
    const exists = wrongQuestions.some(w => w.question.id === wq.question.id)
    if (!exists) {
      const updated = [...wrongQuestions, wq]
      localStorage.setItem('wrongQuestions', JSON.stringify(updated))
      set({ wrongQuestions: updated })
    }
  },

  // Done questions
  doneQuestionIds: new Set(loadFromStorage<number[]>('doneQuestionIds', [])),
  markDone: (id) => {
    const newSet = new Set(get().doneQuestionIds)
    newSet.add(id)
    localStorage.setItem('doneQuestionIds', JSON.stringify([...newSet]))
    set({ doneQuestionIds: newSet })
  },
  removeDone: (id) => {
    const newSet = new Set(get().doneQuestionIds)
    newSet.delete(id)
    localStorage.setItem('doneQuestionIds', JSON.stringify([...newSet]))
    set({ doneQuestionIds: newSet })
  },
  resetDone: () => {
    localStorage.setItem('doneQuestionIds', JSON.stringify([]))
    set({ doneQuestionIds: new Set() })
  },

  // Answer history
  answerHistory: loadFromStorage<AnswerHistory[]>('answerHistory', []),
  saveAnswer: (questionId, userAnswer, isCorrect) => {
    const { answerHistory } = get()
    const filtered = answerHistory.filter(h => h.questionId !== questionId)
    const updated = [...filtered, { questionId, userAnswer, isCorrect, timestamp: Date.now() }]
    localStorage.setItem('answerHistory', JSON.stringify(updated))
    set({ answerHistory: updated })
    // Also mark as done
    get().markDone(questionId)
  },

  // Custom questions
  customQuestions: loadFromStorage<Question[]>('customQuestions', []),
  addCustomQuestion: (question) => {
    const { customQuestions } = get()
    const updated = [...customQuestions, question]
    localStorage.setItem('customQuestions', JSON.stringify(updated))
    set({ customQuestions: updated })
  },

  // Bookmarks
  bookmarkedIds: new Set(loadFromStorage<number[]>('bookmarkedIds', [])),
  toggleBookmark: (id) => {
    const newSet = new Set(get().bookmarkedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    localStorage.setItem('bookmarkedIds', JSON.stringify([...newSet]))
    set({ bookmarkedIds: newSet })
  },

  // Practice navigation
  practiceQuestionId: undefined,
  setPracticeQuestionId: (id) => set({ practiceQuestionId: id }),

  // Progress tracking
  examProgress: loadFromStorage<Record<string, number>>('examProgress', {}),
  practiceProgress: loadFromStorage<number>('practiceProgress', 0),
  saveExamProgress: (examSet, groupIndex) => {
    const { examProgress } = get()
    const updated = { ...examProgress, [examSet]: groupIndex }
    localStorage.setItem('examProgress', JSON.stringify(updated))
    set({ examProgress: updated })
  },
  savePracticeProgress: (groupIndex) => {
    localStorage.setItem('practiceProgress', JSON.stringify(groupIndex))
    set({ practiceProgress: groupIndex })
  },

  // Practice mode progress
  practiceModeProgress: loadFromStorage<Record<PracticeMode, number>>('practiceModeProgress', {
    sequential: 0,
    undone: 0,
    wrong: 0,
    smart: 0
  }),
  savePracticeModeProgress: (mode, groupIndex) => {
    const { practiceModeProgress } = get()
    const updated = { ...practiceModeProgress, [mode]: groupIndex }
    localStorage.setItem('practiceModeProgress', JSON.stringify(updated))
    set({ practiceModeProgress: updated })
  },

  // Practice mode
  practiceMode: loadFromStorage<PracticeMode>('practiceMode', 'sequential'),
  setPracticeMode: (mode) => {
    localStorage.setItem('practiceMode', JSON.stringify(mode))
    set({ practiceMode: mode })
  },

  // Practice mode limits
  practiceLimits: loadFromStorage<Record<PracticeMode, number>>('practiceLimits', {
    sequential: 20,
    undone: 20,
    wrong: 10,
    smart: 20
  }),
  setPracticeLimit: (mode, limit) => {
    const { practiceLimits } = get()
    const updated = { ...practiceLimits, [mode]: limit }
    localStorage.setItem('practiceLimits', JSON.stringify(updated))
    set({ practiceLimits: updated })
  },

  // Today stats
  todayStats: (() => {
    const stored = loadFromStorage<{ date: string; count: number; correct: number }>('todayStats', { date: '', count: 0, correct: 0 })
    const today = new Date().toISOString().split('T')[0]
    return stored.date === today ? stored : { date: today, count: 0, correct: 0 }
  })(),
  updateTodayStats: (isCorrect) => {
    const { todayStats } = get()
    const today = new Date().toISOString().split('T')[0]
    const updated = todayStats.date === today
      ? { date: today, count: todayStats.count + 1, correct: todayStats.correct + (isCorrect ? 1 : 0) }
      : { date: today, count: 1, correct: isCorrect ? 1 : 0 }
    localStorage.setItem('todayStats', JSON.stringify(updated))
    set({ todayStats: updated })
  },

  // Socratic teaching
  socraticQuestion: null,
  setSocraticQuestion: (data) => set({ socraticQuestion: data }),

  // Training variants
  trainingVariants: [],
  currentTrainingIndex: 0,
  originalQuestion: null,
  setTrainingVariants: (variants) => set({ trainingVariants: variants }),
  setCurrentTrainingIndex: (index) => set({ currentTrainingIndex: index }),
  setOriginalQuestion: (question) => set({ originalQuestion: question }),
  nextTrainingQuestion: () => {
    const { currentTrainingIndex, trainingVariants } = get()
    if (currentTrainingIndex < trainingVariants.length - 1) {
      set({ currentTrainingIndex: currentTrainingIndex + 1 })
    } else {
      set({ trainingVariants: [], currentTrainingIndex: 0, originalQuestion: null, currentView: 'ai-help' })
    }
  },
  clearTraining: () => set({ trainingVariants: [], currentTrainingIndex: 0, originalQuestion: null }),

  // Composite actions
  startPractice: (questionId, examSet) => {
    const newSet = new Set(get().doneQuestionIds)
    newSet.delete(questionId)
    localStorage.setItem('doneQuestionIds', JSON.stringify([...newSet]))
    set({
      practiceQuestionId: questionId,
      trainingVariants: [],
      currentTrainingIndex: 0,
      originalQuestion: null,
      doneQuestionIds: newSet,
      currentView: 'practice',
    })
  },

  goToSocratic: (data) => {
    set({
      socraticQuestion: data,
      aiSubView: 'socratic',
      currentView: 'ai-help',
    })
  },

  practiceGenerated: (questions, weakPoint) => {
    if (questions.length > 0) {
      set({
        trainingVariants: questions,
        currentTrainingIndex: 0,
        originalQuestion: weakPoint ? {
          id: 0,
          module: weakPoint.module as Question['module'],
          knowledgePoint: weakPoint.knowledgePoint,
          question: '',
          options: [],
          answer: '',
        } : null,
        currentView: 'practice',
      })
    }
  },
}))
