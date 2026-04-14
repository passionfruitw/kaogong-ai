// 行测题库类型定义
export interface Question {
  id: number
  module: '言语理解' | '数量关系' | '判断推理' | '资料分析' | '常识判断'
  knowledgePoint: string
  question: string
  image?: string
  images?: string[]
  imageLayout?: { matrix: number; options: number; cols?: number }  // 图形推理：matrix=题干图片数，options=选项图片数，cols=列数(默认sqrt)
  options: string[]
  answer: string
  passageId?: number
  examSet?: string  // 所属试卷，如 '2020国考地市'
}

export interface Passage {
  id: number
  module: '言语理解' | '数量关系' | '判断推理' | '资料分析' | '常识判断'
  title?: string
  content: string
  image?: string
  images?: string[]
  questionIds: number[]
}
