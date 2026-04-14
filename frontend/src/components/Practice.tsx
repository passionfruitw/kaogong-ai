import { useState, useEffect, useMemo, useRef } from 'react'
import { questions, Question, passages } from '../data/index'
import QuestionCard from './QuestionCard'
import { useAppStore, VariantQuestion } from '../stores/useAppStore'

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

export default function Practice() {
  const wrongQuestions = useAppStore(s => s.wrongQuestions)
  const setWrongQuestions = useAppStore(s => s.setWrongQuestions)
  const goToSocratic = useAppStore(s => s.goToSocratic)
  const initialQuestionId = useAppStore(s => s.practiceQuestionId)
  const trainingVariants = useAppStore(s => s.trainingVariants)
  const currentTrainingIndex = useAppStore(s => s.currentTrainingIndex)
  const initialVariant = trainingVariants[currentTrainingIndex] as VariantQuestion | undefined
  const addCustomQuestion = useAppStore(s => s.addCustomQuestion)
  const originalQuestion = useAppStore(s => s.originalQuestion)
  const nextTrainingQuestion = useAppStore(s => s.nextTrainingQuestion)
  const trainingProgress = trainingVariants.length > 0 ? { current: currentTrainingIndex + 1, total: trainingVariants.length } : undefined
  const markDone = useAppStore(s => s.markDone)
  const resetDone = useAppStore(s => s.resetDone)
  const saveAnswer = useAppStore(s => s.saveAnswer)
  const clearTraining = useAppStore(s => s.clearTraining)
  const setCurrentView = useAppStore(s => s.setCurrentView)
  const saveExamProgress = useAppStore(s => s.saveExamProgress)
  const answerHistory = useAppStore(s => s.answerHistory)
  const practiceMode = useAppStore(s => s.practiceMode)
  const setPracticeMode = useAppStore(s => s.setPracticeMode)
  const practiceModeProgress = useAppStore(s => s.practiceModeProgress)
  const savePracticeModeProgress = useAppStore(s => s.savePracticeModeProgress)
  const practiceLimits = useAppStore(s => s.practiceLimits)
  const setPracticeLimit = useAppStore(s => s.setPracticeLimit)
  const updateTodayStats = useAppStore(s => s.updateTodayStats)
  const todayStats = useAppStore(s => s.todayStats)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | undefined>()
  const [showResult, setShowResult] = useState(false)
  const [triggerVariant, setTriggerVariant] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [timerActive, setTimerActive] = useState(true)

  // 当前正在练习的变式题
  const [currentVariant, setCurrentVariant] = useState<VariantQuestion | null>(initialVariant || null)
  const [variantOriginalQuestion, setVariantOriginalQuestion] = useState<Question | null>(null)

  const [passageAnswers, setPassageAnswers] = useState<Record<number, string>>({})
  const [passageSubmitted, setPassageSubmitted] = useState(false)

  // 切换题目时重置 passage 状态
  useEffect(() => {
    setPassageAnswers({})
    setPassageSubmitted(false)
  }, [currentIndex])

  // 判断是否是真题套卷模式
  const currentExamSet = useMemo(() => {
    if (initialQuestionId) {
      const q = questions.find(q => q.id === initialQuestionId)
      return q?.examSet
    }
    return undefined
  }, [initialQuestionId])

  // 使用 ref 存储初始答题历史，避免刷题过程中题目列表重新排序
  const initialAnswerHistoryRef = useRef(answerHistory)

  // 只在切换模式或初始化时更新初始答题历史
  useEffect(() => {
    initialAnswerHistoryRef.current = answerHistory
  }, [practiceMode])

  const filteredQuestions = useMemo(() => {
    let filtered = currentExamSet
      ? questions.filter(q => q.examSet === currentExamSet)
      : questions

    // 使用初始答题历史进行筛选和排序，避免刷题过程中列表变化
    const historySnapshot = initialAnswerHistoryRef.current

    // 根据刷题模式筛选
    switch (practiceMode) {
      case 'undone':
        return filtered.filter(q => !historySnapshot.find(h => h.questionId === q.id))
      case 'wrong':
        // 只刷错题：显示所有做错过的题目
        return filtered.filter(q => {
          const history = historySnapshot.find(h => h.questionId === q.id)
          return history && !history.isCorrect
        })
      case 'smart':
        return [...filtered].sort((a, b) => {
          const aHistory = historySnapshot.find(h => h.questionId === a.id)
          const bHistory = historySnapshot.find(h => h.questionId === b.id)

          // 艾宾浩斯遗忘曲线复习间隔（天）：1, 2, 4, 7, 15
          const shouldReview = (history: typeof aHistory) => {
            if (!history) return false
            const daysPassed = (Date.now() - history.timestamp) / (1000 * 60 * 60 * 24)
            const intervals = [1, 2, 4, 7, 15]
            // 如果做错了，按遗忘曲线复习
            if (!history.isCorrect) {
              return intervals.some(interval => Math.abs(daysPassed - interval) < 0.5)
            }
            return false
          }

          const aNeedsReview = shouldReview(aHistory)
          const bNeedsReview = shouldReview(bHistory)

          // 1. 到达复习时间的错题最优先
          if (aNeedsReview && !bNeedsReview) return -1
          if (bNeedsReview && !aNeedsReview) return 1

          // 2. 未做题优先
          if (!aHistory && bHistory) return -1
          if (!bHistory && aHistory) return 1

          // 3. 做对的题不出现（排到最后）
          if (aHistory?.isCorrect && !bHistory?.isCorrect) return 1
          if (bHistory?.isCorrect && !aHistory?.isCorrect) return -1

          // 4. 知识点正确率低的优先
          const getKnowledgePointAccuracy = (q: Question) => {
            const kpAnswers = historySnapshot.filter(h => {
              const question = questions.find(qq => qq.id === h.questionId)
              return question?.knowledgePoint === q.knowledgePoint
            })
            if (kpAnswers.length === 0) return 1
            const correct = kpAnswers.filter(h => h.isCorrect).length
            return correct / kpAnswers.length
          }

          const aAccuracy = getKnowledgePointAccuracy(a)
          const bAccuracy = getKnowledgePointAccuracy(b)
          if (aAccuracy !== bAccuracy) return aAccuracy - bAccuracy

          return 0
        })
      default:
        return filtered
    }
  }, [currentExamSet, practiceMode])

  // 应用刷题数量限制（真题套卷模式不限制）
  const limitedQuestions = useMemo(() => {
    if (currentExamSet) return filteredQuestions
    const limit = practiceLimits[practiceMode]
    return filteredQuestions.slice(0, limit)
  }, [filteredQuestions, currentExamSet, practiceMode, practiceLimits])

  // 构建题组列表：同一 passage 的题合并为一组，单题自成一组（不过滤已完成）
  const questionGroups = useMemo(() => {
    const groups: Question[][] = []
    const seenPassageIds = new Set<number>()
    for (const q of limitedQuestions) {
      if (q.passageId) {
        if (!seenPassageIds.has(q.passageId)) {
          seenPassageIds.add(q.passageId)
          groups.push(limitedQuestions.filter(fq => fq.passageId === q.passageId))
        }
      } else {
        groups.push([q])
      }
    }
    return groups
  }, [limitedQuestions])

  const currentGroup = questionGroups[currentIndex] || []
  const currentQuestion = currentGroup[0]
  const currentPassage = currentGroup[0]?.passageId
    ? passages.find(p => p.id === currentGroup[0].passageId)
    : null

  const questionGroupsRef = useRef(questionGroups)
  questionGroupsRef.current = questionGroups

  // 跳转到初始题目或恢复进度（只在组件挂载时执行一次）
  useEffect(() => {
    if (initialQuestionId) {
      const index = questionGroupsRef.current.findIndex(group => group.some(q => q.id === initialQuestionId))
      if (index !== -1) {
        setCurrentIndex(index)
      }
    } else {
      // 恢复当前模式的进度
      setCurrentIndex(practiceModeProgress[practiceMode] || 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestionId])

  // 计时器
  useEffect(() => {
    setElapsed(0)
    setTimerActive(true)
  }, [currentIndex, currentVariant])

  useEffect(() => {
    if (!timerActive) return
    const id = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(id)
  }, [timerActive])

  // 处理初始变式题
  useEffect(() => {
    if (initialVariant) {
      setCurrentVariant(initialVariant)
      setVariantOriginalQuestion(originalQuestion || null)
      setShowResult(false)
      setSelectedAnswer(undefined)
    }
  }, [initialVariant, originalQuestion])

  // 触发生成新变式题
  useEffect(() => {
    if (triggerVariant && currentQuestion) {
      setTriggerVariant(false)
      // 自动触发举一反三
      setTimeout(() => {
        const btn = document.querySelector('.variant-btn') as HTMLButtonElement
        btn?.click()
      }, 100)
    }
  }, [triggerVariant, currentQuestion])

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer)
  }

  const handleSubmit = () => {
    if (!selectedAnswer || !currentQuestion) return
    setTimerActive(false)

    const isCorrect = selectedAnswer === currentQuestion.answer

    // 如果答错，加入错题集
    if (!isCorrect) {
      const exists = wrongQuestions.some(wq => wq.question.id === currentQuestion.id)
      if (!exists) {
        setWrongQuestions([...wrongQuestions, {
          question: currentQuestion,
          userAnswer: selectedAnswer,
          timestamp: Date.now()
        }])
      }
    }

    saveAnswer(currentQuestion.id, selectedAnswer, isCorrect)
    updateTodayStats(isCorrect)
    setShowResult(true)
  }

  const handleNext = () => {
    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)
    setSelectedAnswer(undefined)
    setShowResult(false)
    setTimeout(() => { if (currentQuestion) markDone(currentQuestion.id) }, 0)
    // 保存进度
    if (currentExamSet) {
      saveExamProgress(currentExamSet, nextIndex)
    } else {
      savePracticeModeProgress(practiceMode, nextIndex)
    }
  }

  const handleReset = () => {
    resetDone()
    setCurrentIndex(0)
    setSelectedAnswer(undefined)
    setShowResult(false)
  }

  const handleGoToSocratic = () => {
    if (currentQuestion) {
      goToSocratic({
        question: currentQuestion.question,
        options: currentQuestion.options,
        answer: currentQuestion.answer,
        knowledgePoint: currentQuestion.knowledgePoint,
        module: currentQuestion.module
      })
    }
  }

  const handlePracticeVariant = (variant: VariantQuestion, originalQuestion: Question) => {
    setCurrentVariant(variant)
    setVariantOriginalQuestion(originalQuestion)
    setSelectedAnswer(undefined)
    setShowResult(false)
  }

  const handleBackFromVariant = () => {
    setCurrentVariant(null)
    if (originalQuestion && originalQuestion.id === 0) {
      clearTraining()
      setCurrentView('ai-help')
    }
  }

  const handleGenerateNewVariant = async () => {
    setCurrentVariant(null)
    setTriggerVariant(true)
  }

  const handleAddToBank = () => {
    if (currentVariant && variantOriginalQuestion) {
      const newQuestion: Question = {
        id: 0,
        module: variantOriginalQuestion.module,
        knowledgePoint: variantOriginalQuestion.knowledgePoint,
        question: currentVariant.question,
        options: currentVariant.options || [],
        answer: currentVariant.answer || ''
      }
      addCustomQuestion(newQuestion)
      alert('题目已加入题库')
    }
  }

  const handleVariantWrong = () => {
    if (currentVariant && selectedAnswer && variantOriginalQuestion) {
      const tempQuestion: Question = {
        id: 0,
        module: variantOriginalQuestion.module,
        knowledgePoint: variantOriginalQuestion.knowledgePoint,
        question: currentVariant.question,
        options: currentVariant.options || [],
        answer: currentVariant.answer || ''
      }
      setWrongQuestions([...wrongQuestions, {
        question: tempQuestion,
        userAnswer: selectedAnswer,
        timestamp: Date.now()
      }])
    }
  }

  // 显示变式题练习
  if (currentVariant) {
    const variantIsCorrect = selectedAnswer === currentVariant.answer

    return (
      <div className="practice">
        <div className="practice-header">
          <div className="variant-banner">
            <button className="btn btn-secondary back-btn" onClick={handleBackFromVariant}>
              ← 返回原题
            </button>
            <h2>变式题练习</h2>
          </div>
          <div className="practice-stats">
            {trainingProgress ? (
              <span>强化训练：第 {trainingProgress.current} / {trainingProgress.total} 题</span>
            ) : (
              <span>举一反三</span>
            )}
          </div>
        </div>

        <div className="question-card">
          <div className="question-header">
            <span className="module-tag variant">变式题</span>
          </div>

          <div className="question-content">
            <p className="question-text">{currentVariant.question}</p>
          </div>

          <div className="options-container">
            {(currentVariant.options || []).map((opt, index) => {
              const optionLetter = String.fromCharCode(65 + index)
              return (
                <button
                  key={index}
                  className={`option-btn ${showResult ? (optionLetter === currentVariant.answer ? 'correct' : (optionLetter === selectedAnswer ? 'wrong' : '')) : (optionLetter === selectedAnswer ? 'selected' : '')}`}
                  onClick={() => !showResult && setSelectedAnswer(optionLetter)}
                  disabled={showResult}
                >
                  <span className="option-label">{optionLetter}.</span>
                  <span className="option-text">{opt}</span>
                </button>
              )
            })}
          </div>

          {!showResult ? (
            <button
              className="btn btn-primary submit-btn"
              onClick={() => {
                setShowResult(true)
                if (selectedAnswer !== currentVariant.answer) {
                  handleVariantWrong()
                }
              }}
              disabled={!selectedAnswer}
            >
              提交答案
            </button>
          ) : (
            <div className={`result-banner ${variantIsCorrect ? 'correct' : 'wrong'}`}>
              {variantIsCorrect ? '回答正确！' : `回答错误，正确答案是 ${currentVariant.answer}`}
            </div>
          )}

          {showResult && (
            <div className="action-buttons">
              {trainingProgress && trainingProgress.current < trainingProgress.total ? (
                <>
                  <button className="btn btn-secondary" onClick={handleAddToBank}>
                    加入题库
                  </button>
                  <button className="btn btn-primary" onClick={nextTrainingQuestion}>
                    下一题
                  </button>
                </>
              ) : trainingProgress ? (
                <>
                  <button className="btn btn-secondary" onClick={handleAddToBank}>
                    加入题库
                  </button>
                  <button className="btn btn-primary" onClick={handleBackFromVariant}>
                    返回强化训练
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={handleBackFromVariant}>
                    返回原题
                  </button>
                  <button className="btn btn-secondary" onClick={handleAddToBank}>
                    加入题库
                  </button>
                  <button className="btn btn-primary" onClick={handleGenerateNewVariant}>
                    继续生成新题
                  </button>
                </>
              )}
            </div>
          )}

          {showResult && currentVariant.explanation && (
            <div className="explanation-section">
              <h4>解析</h4>
              <p>{currentVariant.explanation}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (currentGroup.length === 0) {
    const emptyMessage = (() => {
      if (practiceMode === 'undone') return '暂无未做题目，所有题目都已完成！'
      if (practiceMode === 'wrong') return '暂无错题，继续刷题后错误的题目会出现在这里'
      if (limitedQuestions.length === 0) return '当前模式下暂无题目'
      return '已完成所有题目！'
    })()
    return (
      <div className="practice-empty">
        <p>{emptyMessage}</p>
        {limitedQuestions.length > 0 && (
          <button className="btn btn-primary" onClick={() => setCurrentIndex(0)}>
            重新开始
          </button>
        )}
        {!currentExamSet && (
          <button className="btn btn-secondary" style={{ marginLeft: '8px' }} onClick={() => {
            setPracticeMode('sequential')
            setCurrentIndex(0)
          }}>
            切换顺序刷题
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="practice">
      <div className="practice-header">
        <h2>刷题练习</h2>
        <div className="practice-stats">
          <span>今日: {todayStats.count}题 {todayStats.count > 0 ? `${Math.round(todayStats.correct / todayStats.count * 100)}%` : '0%'}</span>
          <span className="divider">|</span>
          <span>第 {currentIndex + 1} / {questionGroups.length} 组</span>
          <span className="divider">|</span>
          <span>错题数: {wrongQuestions.length}</span>
          <span className="divider">|</span>
          <span className="timer">{Math.floor(elapsed / 60).toString().padStart(2, '0')}:{(elapsed % 60).toString().padStart(2, '0')}</span>
        </div>
      </div>

      {!currentExamSet && (
        <div className="practice-mode-selector">
          <button
            className={`mode-btn ${practiceMode === 'sequential' ? 'active' : ''}`}
            onClick={() => {
              setPracticeMode('sequential')
              setCurrentIndex(practiceModeProgress.sequential || 0)
            }}
            title="按题目顺序依次练习所有题目"
          >
            顺序刷题
          </button>
          <button
            className={`mode-btn ${practiceMode === 'undone' ? 'active' : ''}`}
            onClick={() => {
              setPracticeMode('undone')
              setCurrentIndex(practiceModeProgress.undone || 0)
            }}
            title="只显示从未做过的题目，适合快速刷新题"
          >
            只刷未做
          </button>
          <button
            className={`mode-btn ${practiceMode === 'wrong' ? 'active' : ''}`}
            onClick={() => {
              setPracticeMode('wrong')
              setCurrentIndex(practiceModeProgress.wrong || 0)
            }}
            title="只显示做错的题目，针对性强化薄弱环节"
          >
            只刷错题
          </button>
          <button
            className={`mode-btn ${practiceMode === 'smart' ? 'active' : ''}`}
            onClick={() => {
              setPracticeMode('smart')
              setCurrentIndex(practiceModeProgress.smart || 0)
            }}
            title="AI智能推荐：优先推荐错题和未做题，高效备考"
          >
            智能刷题 ℹ️
          </button>
        </div>
      )}

      {!currentExamSet && (
        <div className="practice-limit-setting">
          <label>
            本次刷题数量：
            <input
              type="number"
              min="5"
              max="100"
              value={practiceLimits[practiceMode]}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value) || 20
                setPracticeLimit(practiceMode, newLimit)
                // 如果当前索引超出新限制，重置到0
                if (currentIndex >= newLimit) {
                  setCurrentIndex(0)
                }
              }}
              style={{ width: '60px', marginLeft: '8px', padding: '4px' }}
            />
            题
          </label>
        </div>
      )}

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
              onAnalyzeClick={handleGoToSocratic}
              onPracticeVariant={handlePracticeVariant}
              hidePassage={idx > 0}
            />
          ))}
          <button
            className="btn btn-primary submit-btn"
            onClick={() => {
              currentGroup.forEach(q => {
                const ans = passageAnswers[q.id]
                const correct = ans === q.answer
                saveAnswer(q.id, ans || '', correct)
                updateTodayStats(correct)
                if (!correct && ans) {
                  const exists = wrongQuestions.some(wq => wq.question.id === q.id)
                  if (!exists) {
                    setWrongQuestions([...wrongQuestions, { question: q, userAnswer: ans, timestamp: Date.now() }])
                  }
                }
              })
              setPassageSubmitted(true)
              setTimerActive(false)
            }}
            disabled={currentGroup.some(q => !passageAnswers[q.id])}
            style={{ display: passageSubmitted ? 'none' : 'block' }}
          >
            提交答案
          </button>
          <div className="navigation-buttons" style={{ display: passageSubmitted ? 'flex' : 'none' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                const nextIndex = currentIndex + 1
                setCurrentIndex(nextIndex)
                setSelectedAnswer(undefined)
                setShowResult(false)
                setTimeout(() => currentGroup.forEach(q => markDone(q.id)), 0)
                // 保存进度
                if (currentExamSet) {
                  saveExamProgress(currentExamSet, nextIndex)
                } else {
                  savePracticeModeProgress(practiceMode, nextIndex)
                }
              }}
            >
              下一题
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleReset}
            >
              重新开始
            </button>
          </div>
          <ScrollToTopButton />
        </>
      ) : (
        <>
          <QuestionCard
            question={currentQuestion}
            isPractice={true}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            onAnswerSelect={handleAnswerSelect}
            onAnalyzeClick={handleGoToSocratic}
            onPracticeVariant={handlePracticeVariant}
          />
          <button
            className="btn btn-primary submit-btn"
            onClick={handleSubmit}
            disabled={!selectedAnswer}
            style={{ display: showResult ? 'none' : 'block' }}
          >
            提交答案
          </button>
          <div className="navigation-buttons" style={{ display: showResult ? 'flex' : 'none' }}>
            <button
              className="btn btn-primary"
              onClick={handleNext}
            >
              下一题
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleReset}
            >
              重新开始
            </button>
          </div>
        </>
      )}
    </div>
  )
}