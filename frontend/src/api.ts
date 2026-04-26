import axios, { AxiosResponse } from 'axios'

// 根据环境自动选择API地址
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
})

const AUTH_TOKEN_KEY = 'kaogong_auth_token'
const AUTH_USER_KEY = 'kaogong_auth_user'

api.interceptors.request.use(config => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function getStoredAuth() {
  return {
    token: localStorage.getItem(AUTH_TOKEN_KEY) || '',
    username: localStorage.getItem(AUTH_USER_KEY) || '',
  }
}

export function storeAuth(token: string, username: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
  localStorage.setItem(AUTH_USER_KEY, username)
}

export function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
}

export interface QuestionData {
  question: string
  options?: string[]
  user_answer?: string
  correct_answer?: string
  module: string
  knowledge_point?: string
}

export interface AIResponse {
  content: string
  type: string
  metadata?: Record<string, unknown>
}

export interface SocraticStep {
  step: 'diagnose' | 'chat' | 'explain' | 'verify' | 'summary'
  user_response?: string
}

export interface SessionSummaryResponse {
  total_sessions: number
  mastery_distribution: Record<string, number>
  sessions: Array<{
    session_id: string
    timestamp: string
    knowledge_point: string
    module: string
    mastery_level: string
  }>
}

export interface LoginResponse {
  token: string
  username: string
}

// Helper to extract .data from axios response
function unwrap<T>(promise: Promise<AxiosResponse<T>>): Promise<T> {
  return promise.then(res => res.data)
}

export const aiApi = {
  // AI错题解析
  analyzeQuestion: (data: QuestionData): Promise<AIResponse> =>
    unwrap(api.post('/ai/analyze', data)),

  // 举一反三 - 生成变式题
  generateVariants: (data: QuestionData & { count: number }): Promise<AIResponse> =>
    unwrap(api.post('/ai/variants', data)),

  // 苏格拉底式教学
  socraticTeach: (data: QuestionData & SocraticStep & { conversation_history?: Array<{role: string, content: string}> }): Promise<AIResponse> =>
    unwrap(api.post('/ai/socratic/teach', data)),

  // 通用聊天（用于强化训练生成题目）
  chat: (prompt: string): Promise<AIResponse> =>
    unwrap(api.post('/ai/chat', { prompt, model: 'deepseek-v4-flash' })),

  // 健康检查
  health: () => api.get('/ai/health'),

  // 获取苏格拉底会话汇总
  getSessionsSummary: (): Promise<SessionSummaryResponse> =>
    unwrap(api.get('/ai/sessions/summary')),

  // AI生成个性化学习方案
  generateStudyPlan: (data: {
    wrong_knowledge_points: { knowledge_point: string; count: number; module: string }[]
    session_summaries: { knowledge_point: string; mastery_level: string }[]
    total_done: number
    accuracy_rate: number
  }): Promise<AIResponse> => unwrap(api.post('/ai/study-plan', data)),
}

export const authApi = {
  login: (username: string, password: string): Promise<LoginResponse> =>
    unwrap(api.post('/auth/login', { username, password })),

  me: (): Promise<{ username: string }> =>
    unwrap(api.get('/auth/me')),
}

export default api
