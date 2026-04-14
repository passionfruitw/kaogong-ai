import { useState, useMemo, useEffect, useRef } from 'react'
import { questions, getAllModules, Question, passages } from '../data/index'
import QuestionCard from './QuestionCard'
import { useAppStore } from '../stores/useAppStore'

// 回到顶部按钮组件
function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.scrollY > 300)
    }
    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return isVisible ? (
    <button className="scroll-to-top" onClick={scrollToTop} title="回到顶部">
      ↑
    </button>
  ) : null
}

export default function QuestionBank() {
  const startPractice = useAppStore(s => s.startPractice)
  const goToSocratic = useAppStore(s => s.goToSocratic)
  const customQuestions = useAppStore(s => s.customQuestions)
  const saveAnswer = useAppStore(s => s.saveAnswer)
  const bookmarkedIds = useAppStore(s => s.bookmarkedIds)
  const toggleBookmark = useAppStore(s => s.toggleBookmark)
  const answerHistory = useAppStore(s => s.answerHistory)

  const [selectedModule, setSelectedModule] = useState('全部')
  const [searchText, setSearchText] = useState('')
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false)
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<string | undefined>()
  const [showResult, setShowResult] = useState(false)
  const [passageAnswers, setPassageAnswers] = useState<Record<number, string>>({})
  const [passageSubmitted, setPassageSubmitted] = useState(false)
  const scrollPositionRef = useRef(0)

  const modules = getAllModules()
  const allQuestions = [...questions, ...customQuestions]
  const filteredQuestions = useMemo(() => {
    let filtered = selectedModule === '全部'
      ? allQuestions
      : allQuestions.filter(q => q.module === selectedModule)
    if (showBookmarkedOnly) {
      filtered = filtered.filter(q => bookmarkedIds.has(q.id))
    }
    if (searchText.trim()) {
      const s = searchText.toLowerCase()
      filtered = filtered.filter(q =>
        q.question.toLowerCase().includes(s) ||
        q.knowledgePoint.toLowerCase().includes(s) ||
        String(q.id).includes(s)
      )
    }
    return filtered
  }, [selectedModule, customQuestions, searchText, showBookmarkedOnly, bookmarkedIds])

  const questionGroups = useMemo(() => {
    const groups: Question[][] = []
    const seenPassageIds = new Set<number>()
    for (const q of filteredQuestions) {
      if (q.passageId) {
        if (!seenPassageIds.has(q.passageId)) {
          seenPassageIds.add(q.passageId)
          groups.push(filteredQuestions.filter(fq => fq.passageId === q.passageId))
        }
      } else {
        groups.push([q])
      }
    }
    return groups
  }, [filteredQuestions])

  const handleGroupClick = (index: number) => {
    scrollPositionRef.current = window.scrollY
    setSelectedGroupIndex(index)
    setSelectedAnswer(undefined)
    setShowResult(false)
    setPassageAnswers({})
    setPassageSubmitted(false)
  }

  useEffect(() => {
    if (selectedGroupIndex === null && scrollPositionRef.current > 0) {
      window.scrollTo(0, scrollPositionRef.current)
    }
  }, [selectedGroupIndex])

  const currentGroup = selectedGroupIndex !== null ? questionGroups[selectedGroupIndex] : null
  const currentQuestion = currentGroup?.[0] ?? null
  const currentPassage = currentQuestion?.passageId
    ? passages.find(p => p.id === currentQuestion.passageId)
    : null

  const handleSubmit = () => {
    if (selectedAnswer && currentQuestion) {
      const isCorrect = selectedAnswer === currentQuestion.answer
      setShowResult(true)
      saveAnswer(currentQuestion.id, selectedAnswer, isCorrect)
    }
  }

  const handleReset = () => {
    setSelectedAnswer(undefined)
    setShowResult(false)
    setPassageAnswers({})
    setPassageSubmitted(false)
  }

  const handleAnalyze = (q: Question) => {
    goToSocratic({
      question: q.question,
      options: q.options,
      answer: q.answer,
      knowledgePoint: q.knowledgePoint,
      module: q.module,
    })
  }

  return (
    <div className="question-bank">
      <div className="bank-header">
        <h2>题库</h2>
        <p className="bank-stats">共 {questionGroups.length} 组题目</p>
      </div>

      <div className="module-filter">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            className="picker-search"
            placeholder="搜索题目、知识点..."
            value={searchText}
            onChange={e => { setSearchText(e.target.value); setSelectedGroupIndex(null) }}
            style={{ flex: 1 }}
          />
          <button
            className={`filter-btn ${showBookmarkedOnly ? 'active' : ''}`}
            onClick={() => { setShowBookmarkedOnly(v => !v); setSelectedGroupIndex(null) }}
            title="只看收藏"
          >
            {showBookmarkedOnly ? '★ 收藏' : '☆ 收藏'}
          </button>
        </div>
        {modules.map(module => (
          <button
            key={module}
            className={`filter-btn ${selectedModule === module ? 'active' : ''}`}
            onClick={() => { setSelectedModule(module); setSelectedGroupIndex(null) }}
          >
            {module}
          </button>
        ))}
      </div>


      {selectedGroupIndex === null ? (
        <div className="question-list">
          {questionGroups.map((group, idx) => {
            const q = group[0]
            const isMulti = group.length > 1
            const passage = q.passageId ? passages.find(p => p.id === q.passageId) : null
            const history = answerHistory.find(h => h.questionId === q.id)
            const status = history ? (history.isCorrect ? 'correct' : 'wrong') : 'undone'
            return (
              <div key={q.id} className="question-list-item">
                <div className="question-list-main" onClick={() => handleGroupClick(idx)}>
                  <div className="question-list-info">
                    <span className={`question-status status-${status}`}>
                      {status === 'correct' ? '✓' : status === 'wrong' ? '✗' : '○'}
                    </span>
                    <span className="question-id">{q.id === 0 ? '变式题' : `第${q.id}题`}</span>
                    {isMulti && <span className="tag-multi">多题 · {group.length}道</span>}
                    <span className="question-module">{q.module}</span>
                    <span className="question-knowledge">{q.knowledgePoint}</span>
                  </div>
                  <p className="question-preview">
                    {passage ? passage.title : (q.question.length > 80 ? q.question.substring(0, 80) + '...' : q.question)}
                  </p>
                </div>
                <div className="question-list-actions">
                  <button
                    className="btn btn-sm btn-bookmark"
                    onClick={e => { e.stopPropagation(); toggleBookmark(q.id) }}
                    title={bookmarkedIds.has(q.id) ? '取消收藏' : '收藏'}
                    style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: bookmarkedIds.has(q.id) ? '#f39c12' : '#bbb' }}
                  >
                    {bookmarkedIds.has(q.id) ? '★' : '☆'}
                  </button>
                  <button className="btn btn-sm btn-outline" onClick={() => handleGroupClick(idx)}>查看详情</button>
                  <button className="btn btn-sm btn-primary" onClick={() => startPractice(q.id)}>开始练习</button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="question-detail">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button className="btn btn-secondary back-btn" onClick={() => setSelectedGroupIndex(null)}>
              返回题库
            </button>
            {currentGroup && currentGroup[0] && (
              <button
                onClick={() => toggleBookmark(currentGroup[0].id)}
                style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: bookmarkedIds.has(currentGroup[0].id) ? '#f39c12' : '#bbb' }}
                title={bookmarkedIds.has(currentGroup[0].id) ? '取消收藏' : '收藏此题'}
              >
                {bookmarkedIds.has(currentGroup[0].id) ? '★' : '☆'}
              </button>
            )}
          </div>
          {currentGroup && (
            <>
              {currentPassage ? (
                <>
                  <div className="passage-tag">
                    <span className="tag-multi">多题 · {currentGroup.length}道</span>
                  </div>
                  {currentGroup.map((q, idx) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      isPractice={true}
                      selectedAnswer={passageAnswers[q.id]}
                      showResult={passageSubmitted}
                      onAnswerSelect={(ans) => setPassageAnswers(prev => ({ ...prev, [q.id]: ans }))}
                      onAnalyzeClick={() => handleAnalyze(q)}
                      onPracticeVariant={() => {}}
                      hidePassage={idx > 0}
                    />
                  ))}
                  {!passageSubmitted ? (
                    <button
                      className="btn btn-primary submit-btn"
                      onClick={() => {
                        currentGroup.forEach(q => {
                          const ans = passageAnswers[q.id]
                          if (ans) saveAnswer(q.id, ans, ans === q.answer)
                        })
                        setPassageSubmitted(true)
                      }}
                      disabled={currentGroup.some(q => !passageAnswers[q.id])}
                    >
                      提交答案
                    </button>
                  ) : (
                    <button className="btn btn-secondary" onClick={handleReset}>重新开始</button>
                  )}
                  <ScrollToTopButton />
                </>
              ) : (
                <>
                  <QuestionCard
                    question={currentQuestion!}
                    isPractice={true}
                    selectedAnswer={selectedAnswer}
                    showResult={showResult}
                    onAnswerSelect={setSelectedAnswer}
                    onAnalyzeClick={() => handleAnalyze(currentQuestion!)}
                    onPracticeVariant={() => {}}
                  />
                  {!showResult ? (
                    <button className="btn btn-primary submit-btn" onClick={handleSubmit} disabled={!selectedAnswer}>
                      提交答案
                    </button>
                  ) : (
                  <button className="btn btn-secondary" onClick={handleReset}>重新开始</button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
