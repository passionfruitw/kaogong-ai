export type { Question, Passage } from './types'
export { questions } from './questions/index'
export { passages } from './passages/index'

import { questions } from './questions/index'

export const getQuestionsByModule = (module: string): import('./types').Question[] => {
  if (module === '全部') return questions
  return questions.filter(q => q.module === module)
}

export const getAllModules = (): string[] => {
  const modules = new Set(questions.map(q => q.module))
  return ['全部', ...Array.from(modules)]
}

export const getAllExamSets = (): string[] => {
  const sets = new Set(questions.map(q => q.examSet).filter(Boolean) as string[])
  return Array.from(sets).sort()
}

export const getExamSetStats = (examSet: string, doneIds: Set<number>) => {
  const qs = questions.filter(q => q.examSet === examSet)
  const done = qs.filter(q => doneIds.has(q.id)).length
  return { total: qs.length, done }
}
