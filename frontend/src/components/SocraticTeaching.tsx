import { useState, useMemo, useEffect, useRef } from 'react'
import { GraduationCap, UserRound } from 'lucide-react'
import { aiApi } from '../api'
import { questions, getAllModules, Question } from '../data/index'

interface SocraticTeachingProps {
  initialQuestion?: {
    question: string
    options: string[]
    answer: string
    knowledge_point?: string
    module?: string
  }
  onClearQuestion?: () => void
}

interface Message {
  role: 'user' | 'ai'
  content: string
}

const getSpeechRecognitionConstructor = () => {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

const getSpeechErrorMessage = (error: SpeechRecognitionErrorCode) => {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '麦克风权限被拒绝，请允许浏览器访问麦克风后重试。'
    case 'audio-capture':
      return '没有检测到可用麦克风，请检查设备。'
    case 'no-speech':
      return '没有识别到声音，请靠近麦克风再试一次。'
    case 'network':
      return '语音识别服务连接失败，请稍后重试。'
    default:
      return '语音识别失败，请手动输入或稍后重试。'
  }
}

export default function SocraticTeaching({ initialQuestion, onClearQuestion }: SocraticTeachingProps) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', '', '', ''])
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [knowledgePoint, setKnowledgePoint] = useState('')
  const [module, setModule] = useState('行测')

  // 题目选择器
  const [pickerModule, setPickerModule] = useState('全部')
  const [pickerSearch, setPickerSearch] = useState('')
  const [showPicker, setShowPicker] = useState(true)

  // 如果有初始题目，直接跳过选择器
  useEffect(() => {
    if (initialQuestion) {
      setQuestion(initialQuestion.question)
      const cleanOptions = (initialQuestion.options || []).map(opt =>
        opt.replace(/^[A-D]\.\s*/, '').trim()
      )
      setOptions(cleanOptions.length > 0 ? cleanOptions : ['', '', '', ''])
      setCorrectAnswer(initialQuestion.answer)
      setKnowledgePoint(initialQuestion.knowledge_point || '')
      setModule(initialQuestion.module || '行测')
      setShowPicker(false)
    }
  }, [initialQuestion])

  const [messages, setMessages] = useState<Message[]>([])
  const [userInput, setUserInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [conversationEnded, setConversationEnded] = useState(false)
  const [_summary, setSummary] = useState('')
  const [speechSupported, setSpeechSupported] = useState(() => Boolean(getSpeechRecognitionConstructor()))
  const [isListening, setIsListening] = useState(false)
  const [speechNotice, setSpeechNotice] = useState('')
  const [speechStatus, setSpeechStatus] = useState<'idle' | 'active' | 'success' | 'error'>('idle')

  const [started, setStarted] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const speechInputBaseRef = useRef('')
  const speechHadResultRef = useRef(false)
  const speechHadErrorRef = useRef(false)

  const modules = getAllModules()

  const filteredQuestions = useMemo(() => {
    let filtered = pickerModule === '全部' ? questions : questions.filter(q => q.module === pickerModule)
    if (pickerSearch.trim()) {
      const search = pickerSearch.toLowerCase()
      filtered = filtered.filter(q => q.question.toLowerCase().includes(search) || q.knowledgePoint.toLowerCase().includes(search))
    }
    return filtered.slice(0, 15)
  }, [pickerModule, pickerSearch])

  // 自动滚动到最新消息
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, loading])

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognitionConstructor()))

    return () => {
      const recognition = recognitionRef.current
      if (!recognition) return

      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.abort()
      recognitionRef.current = null
    }
  }, [])

  // 组件卸载时若对话未保存，自动触发 summary
  useEffect(() => {
    return () => {
      if (started && messages.length > 0 && !conversationEnded && question.trim() && correctAnswer.trim()) {
        aiApi.socraticTeach({
          question: question.trim(),
          options: options.filter(o => o.trim()),
          user_answer: undefined,
          correct_answer: correctAnswer.trim(),
          module,
          knowledge_point: knowledgePoint.trim() || undefined,
          step: 'summary',
          user_response: undefined,
          conversation_history: messages
        }).catch(() => {})
      }
    }
  }, [started, messages, conversationEnded, question, correctAnswer, options, module, knowledgePoint])

  const handleSelectQuestion = (q: Question) => {
    setQuestion(q.question)
    setOptions(q.options)
    setCorrectAnswer(q.answer)
    setKnowledgePoint(q.knowledgePoint)
    setModule(q.module)
    setShowPicker(false)
  }

  const stopSpeechRecognition = () => {
    const recognition = recognitionRef.current
    if (!recognition) {
      setIsListening(false)
      return
    }

    try {
      recognition.stop()
    } catch {
      recognition.abort()
      recognitionRef.current = null
    }
    setIsListening(false)
  }

  const handleToggleVoiceInput = () => {
    if (loading) return

    if (isListening) {
      stopSpeechRecognition()
      return
    }

    const SpeechRecognitionConstructor = getSpeechRecognitionConstructor()
    if (!SpeechRecognitionConstructor) {
      setSpeechSupported(false)
      setSpeechStatus('error')
      setSpeechNotice('当前浏览器不支持语音输入，请使用 Chrome/Edge 或手动输入。')
      return
    }

    const recognition = new SpeechRecognitionConstructor()
    recognition.lang = 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    speechInputBaseRef.current = userInput.trimEnd()
    speechHadResultRef.current = false
    speechHadErrorRef.current = false

    recognition.onstart = () => {
      setIsListening(true)
      setSpeechStatus('active')
      setSpeechNotice('正在听写，点击麦克风可停止。')
    }

    recognition.onresult = (event) => {
      let transcript = ''

      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0]?.transcript || ''
      }

      if (transcript.trim()) {
        speechHadResultRef.current = true
      }

      const baseText = speechInputBaseRef.current
      const nextInput = [baseText, transcript.trim()].filter(Boolean).join(baseText ? '\n' : '')
      setUserInput(nextInput)
    }

    recognition.onerror = (event) => {
      speechHadErrorRef.current = true
      setSpeechStatus('error')
      setSpeechNotice(getSpeechErrorMessage(event.error))
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null
      }

      if (speechHadErrorRef.current) return

      if (speechHadResultRef.current) {
        setSpeechStatus('success')
        setSpeechNotice('语音输入已停止，可继续编辑后发送。')
      } else {
        setSpeechStatus('error')
        setSpeechNotice('没有识别到声音，请靠近麦克风再试一次。')
      }
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      setIsListening(false)
      setSpeechStatus('error')
      setSpeechNotice('语音输入启动失败，请稍后再试。')
    }
  }

  // 开始学习时，AI先主动提问
  const handleStartLearning = async () => {
    if (!question.trim() || !correctAnswer.trim()) {
      setError('请输入题目和正确答案')
      return
    }

    setStarted(true)
    setLoading(true)
    setError('')

    try {
      const response = await aiApi.socraticTeach({
        question: question.trim(),
        options: options.filter(o => o.trim()),
        user_answer: undefined,
        correct_answer: correctAnswer.trim(),
        module,
        knowledge_point: knowledgePoint.trim() || undefined,
        step: 'diagnose',
        user_response: undefined,
        conversation_history: []
      })

      setMessages([
        { role: 'ai', content: response.content }
      ])
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string }
      setError(err instanceof Error ? err.message : axiosErr?.response?.data?.detail || '请求失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!userInput.trim() || loading || conversationEnded || isListening) return

    const userMessage = userInput.trim()
    setLoading(true)
    setError('')

    try {
      const response = await aiApi.socraticTeach({
        question: question.trim(),
        options: options.filter(o => o.trim()),
        user_answer: userMessage,
        correct_answer: correctAnswer.trim(),
        module,
        knowledge_point: knowledgePoint.trim() || undefined,
        step: 'chat',
        user_response: userMessage,
        conversation_history: messages
      })

      setMessages(prev => [
        ...prev,
        { role: 'user', content: userMessage },
        { role: 'ai', content: response.content }
      ])

      setUserInput('')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string }
      setError(err instanceof Error ? err.message : axiosErr?.response?.data?.detail || '请求失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 结束对话时，AI总结并记录日志
  const handleEndConversation = async () => {
    if (loading || messages.length === 0) return

    stopSpeechRecognition()
    setLoading(true)
    setError('')

    try {
      const response = await aiApi.socraticTeach({
        question: question.trim(),
        options: options.filter(o => o.trim()),
        user_answer: undefined,
        correct_answer: correctAnswer.trim(),
        module,
        knowledge_point: knowledgePoint.trim() || undefined,
        step: 'summary',
        user_response: undefined,
        conversation_history: messages
      })

      setSummary(response.content)
      setConversationEnded(true)

      // 添加总结消息
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: '【本次学习总结】\n\n' + response.content }
      ])
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string }
      setError(err instanceof Error ? err.message : axiosErr?.response?.data?.detail || '请求失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleRestart = async () => {
    stopSpeechRecognition()
    setMessages([])
    setUserInput('')
    setError('')
    setConversationEnded(false)
    setSummary('')
    setShowPicker(false)
    setStarted(true)
    setLoading(true)

    try {
      const response = await aiApi.socraticTeach({
        question: question.trim(),
        options: options.filter(o => o.trim()),
        user_answer: undefined,
        correct_answer: correctAnswer.trim(),
        module,
        knowledge_point: knowledgePoint.trim() || undefined,
        step: 'diagnose',
        user_response: undefined,
        conversation_history: []
      })
      setMessages([{ role: 'ai', content: response.content }])
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string }
      setError(err instanceof Error ? err.message : axiosErr?.response?.data?.detail || '请求失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleNewQuestion = () => {
    stopSpeechRecognition()
    setQuestion('')
    setOptions(['', '', '', ''])
    setCorrectAnswer('')
    setKnowledgePoint('')
    setMessages([])
    setUserInput('')
    setStarted(false)
    setShowPicker(true)
    setError('')
    setConversationEnded(false)
    setSummary('')
    setSpeechNotice('')
    setSpeechStatus('idle')
    onClearQuestion?.()
  }

  // 处理键盘发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (conversationEnded || isListening) return
      handleSendMessage()
    }
  }

  const voiceButtonLabel = !speechSupported
    ? '当前浏览器不支持语音输入'
    : isListening
      ? '停止语音输入'
      : '开始语音输入'
  const voiceStatusMessage = !speechSupported
    ? '当前浏览器不支持语音输入，请使用 Chrome/Edge 或手动输入。'
    : speechNotice
  const voiceStatusClass = !speechSupported ? 'error' : speechStatus

  // 题目选择器界面
  if (showPicker) {
    return (
      <div className="socratic-container">
        <div className="socratic-header">
          <h2>选择题目开始学习</h2>
          <p>从题库选择一道题目进行苏格拉底式教学</p>
        </div>

        <div className="picker-container">
          <div className="picker-filters">
            <select value={pickerModule} onChange={e => setPickerModule(e.target.value)} className="picker-select">
              <option value="全部">全部模块</option>
              {modules.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input type="text" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="搜索题目..." className="picker-search" />
          </div>

          <div className="picker-list">
            {filteredQuestions.length === 0 ? (
              <div className="empty-state"><p>没有找到匹配的题目</p></div>
            ) : (
              filteredQuestions.map(q => (
                <div key={q.id} className="picker-item" onClick={() => handleSelectQuestion(q)}>
                  <div className="picker-item-header">
                    <span className="picker-id">第{q.id}题</span>
                    <span className="picker-module">{q.module}</span>
                    <span className="picker-knowledge">{q.knowledgePoint}</span>
                  </div>
                  <p className="picker-preview">{q.question.length > 60 ? q.question.substring(0, 60) + '...' : q.question}</p>
                </div>
              ))
            )}
          </div>

          <div className="manual-input">
            <h4>或手动输入题目</h4>
            <button className="btn btn-secondary" onClick={() => setShowPicker(false)}>手动输入题目</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="socratic-container">
      <div className="socratic-header">
        <h2>苏格拉底教学</h2>
        <p>AI引导式提问，真正理解知识点</p>
      </div>

      {!started && (
        <div className="socratic-setup">
          <div className="form-card">
            <h3>已选题目</h3>

            <div className="selected-question-preview">
              <div className="preview-header">
                <span className="module-tag">{module}</span>
                <span className="knowledge-tag">{knowledgePoint}</span>
                <button className="btn-link" onClick={handleNewQuestion}>更换题目</button>
              </div>
              <p className="preview-question">{question}</p>
              {options.filter(o => o.trim()).length > 0 && (
                <div className="preview-options">
                  {options.filter(o => o.trim()).map((opt, i) => (
                    <span key={i}>{String.fromCharCode(65 + i)}. {opt}</span>
                  ))}
                </div>
              )}
              <p className="preview-answer">正确答案: {correctAnswer}</p>
            </div>

            <button className="btn btn-primary btn-large" onClick={handleStartLearning}>
              开始与AI对话学习
            </button>
          </div>
        </div>
      )}

      {started && (
        <div className="socratic-learning">
          <div className="current-question">
            <div className="question-badge">{knowledgePoint || module}</div>
            <p className="question-text">{question}</p>
            {options.filter(o => o.trim()).length > 0 && (
              <div className="question-options">
                {options.filter(o => o.trim()).map((opt, i) => (
                  <div key={i} className="option-display">
                    {String.fromCharCode(65 + i)}. {opt}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="chat-container" ref={chatContainerRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'ai'
                    ? <GraduationCap aria-hidden="true" />
                    : <UserRound aria-hidden="true" />}
                </div>
                <div className="message-content">
                  <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-message ai thinking-message" aria-live="polite" aria-label="AI is thinking">
                <div className="message-avatar mentor-thinking-avatar" aria-hidden="true">
                  <span className="mentor-face">AI</span>
                  <span className="mentor-pulse" />
                </div>
                <div className="message-content">
                  <p className="typing">AI正在思考...</p>
                </div>
              </div>
            )}
          </div>

          {!conversationEnded && (
            <div className="input-area">
              <div className="turn-indicator">
                第 {messages.filter(m => m.role === 'user').length + 1} / 5 轮
              </div>
              <div className={`voice-input-field ${isListening ? 'listening' : ''}`}>
                <textarea
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="请输入你的回答... (按Enter发送, Shift+Enter换行)"
                  rows={3}
                  disabled={loading}
                  readOnly={isListening}
                />
                <button
                  type="button"
                  className={`voice-input-btn ${isListening ? 'listening' : ''}`}
                  onClick={handleToggleVoiceInput}
                  disabled={loading || !speechSupported}
                  aria-label={voiceButtonLabel}
                  aria-pressed={isListening}
                  title={voiceButtonLabel}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M12 14c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v5c0 1.66 1.34 3 3 3Z" />
                    <path d="M17.3 11a5.3 5.3 0 0 1-10.6 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-1.7Z" />
                  </svg>
                </button>
              </div>
              {voiceStatusMessage && (
                <p className={`voice-input-status ${voiceStatusClass}`} aria-live="polite">
                  {voiceStatusMessage}
                </p>
              )}
              <div className="input-actions">
                <button
                  className="btn btn-secondary"
                  onClick={handleEndConversation}
                  disabled={loading || messages.length === 0}
                >
                  结束对话
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSendMessage}
                  disabled={loading || isListening || !userInput.trim()}
                >
                  {loading ? '发送中...' : '发送'}
                </button>
              </div>
            </div>
          )}

          {conversationEnded && (
            <div className="summary-actions">
              <button className="btn btn-secondary" onClick={handleRestart}>
                重新学习此题
              </button>
              <button className="btn btn-primary" onClick={handleNewQuestion}>
                学习新题目
              </button>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
        </div>
      )}
    </div>
  )
}
