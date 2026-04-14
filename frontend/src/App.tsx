import './App.css'
import { useState } from 'react'
import QuestionBank from './components/QuestionBank'
import Practice from './components/Practice'
import WrongQuestions from './components/WrongQuestions'
import SocraticTeaching from './components/SocraticTeaching'
import StrengtheningTraining from './components/StrengtheningTraining'
import Statistics from './components/Statistics'
import ErrorBoundary from './components/ErrorBoundary'
import { useAppStore } from './stores/useAppStore'
import { getAllExamSets, getExamSetStats, questions, passages } from './data/index'
import { Question } from './data/index'

const OPTION_LABELS = ['A', 'B', 'C', 'D']

function DevPreview({ examSet, onBack }: { examSet: string; onBack: () => void }) {
  const examQuestions = questions.filter(q => q.examSet === examSet)
  const sorted = [...examQuestions].sort((a, b) => (a.id % 1000) - (b.id % 1000))
  const renderedPassageIds = new Set<number>()

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-secondary" onClick={onBack}>← 返回套卷列表</button>
        <h2 style={{ margin: 0 }}>{examSet} — 开发者预览</h2>
        <span style={{ color: '#888', fontSize: 14 }}>共 {examQuestions.length} 题</span>
      </div>

      {sorted.map((q: Question) => {
        const passage = q.passageId ? passages.find(p => p.id === q.passageId) : null
        const showPassage = passage && !renderedPassageIds.has(q.passageId!)
        if (passage) renderedPassageIds.add(q.passageId!)

        return (
          <div key={q.id} style={{
            border: '1px solid #e0e0e0',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 12,
            background: '#fff'
          }}>
            {showPassage && (
              <div style={{
                background: '#f5f7fa',
                border: '1px solid #d0d7e0',
                borderRadius: 6,
                padding: '10px 14px',
                marginBottom: 10,
                fontSize: 13,
                color: '#444'
              }}>
                <strong>【材料】{passage.title}</strong>
                <div dangerouslySetInnerHTML={{ __html: passage.content }} style={{ marginTop: 6 }} />
                {passage.image && (
                  <img src={passage.image} alt="材料图片" style={{ maxWidth: '100%', marginTop: 8 }} />
                )}
                {passage.images && passage.images.map((img, i) => (
                  <img key={i} src={img} alt={`材料图片${i + 1}`} style={{ maxWidth: '100%', marginTop: 8 }} />
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{
                background: '#e8f0fe',
                color: '#1a73e8',
                borderRadius: 4,
                padding: '2px 7px',
                fontSize: 12,
                whiteSpace: 'nowrap',
                marginTop: 2,
                flexShrink: 0
              }}>
                第{q.id % 1000}题
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 14, marginBottom: 8, lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{ __html: q.question }}
                />

                {q.image && (
                  <img src={q.image} alt="题目图片" style={{ maxWidth: '100%', marginBottom: 8 }} />
                )}
                {q.images && q.imageLayout ? (() => {
                  const { matrix, cols: layoutCols } = q.imageLayout!
                  const cols = layoutCols ?? Math.ceil(Math.sqrt(matrix))
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 3, maxWidth: 300, marginBottom: 8 }}>
                      {q.images!.slice(0, matrix).map((img, i) => (
                        <div key={i} style={{ border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '1', background: '#fafafa' }}>
                          {img === '?' ? <span style={{ fontSize: 20, fontWeight: 'bold', color: '#666' }}>?</span> : <img src={img} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                        </div>
                      ))}
                    </div>
                  )
                })() : q.images && q.images.map((img, i) => (
                  <img key={i} src={img} alt={`题目图片${i + 1}`} style={{ maxWidth: '100%', marginBottom: 4 }} />
                ))}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {q.options.map((opt, idx) => {
                    const label = OPTION_LABELS[idx]
                    const isAnswer = label === q.answer
                    const optionImg = q.imageLayout ? q.images![q.imageLayout.matrix + idx] : null
                    return (
                      <div key={idx} style={{
                        fontSize: 13,
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: isAnswer ? '#e6f4ea' : 'transparent',
                        color: isAnswer ? '#1e7e34' : '#333',
                        fontWeight: isAnswer ? 600 : 400,
                        border: isAnswer ? '1px solid #a8d5b5' : '1px solid transparent',
                        display: 'flex', alignItems: 'center', gap: 6
                      }}>
                        {label}.{' '}
                        {optionImg
                          ? <img src={optionImg} alt={`选项${label}`} style={{ height: 40, objectFit: 'contain' }} />
                          : opt.replace(/^[A-D][、.\s]+/, '')}
                        {isAnswer && (
                          <span style={{ marginLeft: 6, fontSize: 12 }}>✓ 正确答案</span>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div style={{ marginTop: 6, fontSize: 12, color: '#888' }}>
                  {q.module} · {q.knowledgePoint}
                  {q.passageId && <span style={{ marginLeft: 8, color: '#aaa' }}>材料题</span>}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ExamSets() {
  const doneQuestionIds = useAppStore(s => s.doneQuestionIds)
  const startPractice = useAppStore(s => s.startPractice)
  const examProgress = useAppStore(s => s.examProgress)
  const examSets = getAllExamSets()
  const [devPreviewExamSet, setDevPreviewExamSet] = useState<string | null>(null)

  if (devPreviewExamSet) {
    return <DevPreview examSet={devPreviewExamSet} onBack={() => setDevPreviewExamSet(null)} />
  }

  return (
    <div className="exam-sets">
      <h2>真题套卷</h2>
      <div className="exam-set-list">
        {examSets.map(examSet => {
          const stats = getExamSetStats(examSet, doneQuestionIds)
          const examQuestions = questions.filter(q => q.examSet === examSet)

          const questionGroups: typeof examQuestions[] = []
          const seenPassageIds = new Set<number>()
          for (const q of examQuestions) {
            if (q.passageId) {
              if (!seenPassageIds.has(q.passageId)) {
                seenPassageIds.add(q.passageId)
                questionGroups.push(examQuestions.filter(fq => fq.passageId === q.passageId))
              }
            } else {
              questionGroups.push([q])
            }
          }

          let continueQuestion = questionGroups[0]?.[0]
          const savedProgress = examProgress[examSet]
          if (savedProgress !== undefined && savedProgress < questionGroups.length) {
            continueQuestion = questionGroups[savedProgress]?.[0]
          } else {
            const firstUndoneGroup = questionGroups.find(group => group.some(q => !doneQuestionIds.has(q.id)))
            if (firstUndoneGroup) continueQuestion = firstUndoneGroup[0]
          }

          const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
          return (
            <div key={examSet} className="exam-set-card" onClick={() => {
              if (continueQuestion) startPractice(continueQuestion.id, examSet)
            }}>
              <h3>{examSet}</h3>
              <p>共 {stats.total} 道题目</p>
              <div className="exam-set-progress">
                <div className="module-stat-bar">
                  <div className="module-stat-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="exam-set-progress-text">{stats.done}/{stats.total} ({progress}%)</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary">
                  {stats.done > 0 ? '继续练习' : '开始练习'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={e => { e.stopPropagation(); setDevPreviewExamSet(examSet) }}
                  title="一次性查看所有题目和答案"
                >
                  开发者预览
                </button>
              </div>
            </div>
          )
        })}
        {examSets.length === 0 && (
          <div className="empty-state">
            <p>暂无真题套卷数据</p>
          </div>
        )}
      </div>
    </div>
  )
}

function App() {
  const currentView = useAppStore(s => s.currentView)
  const setCurrentView = useAppStore(s => s.setCurrentView)
  const aiSubView = useAppStore(s => s.aiSubView)
  const setAiSubView = useAppStore(s => s.setAiSubView)
  const wrongQuestions = useAppStore(s => s.wrongQuestions)
  const socraticQuestion = useAppStore(s => s.socraticQuestion)
  const setSocraticQuestion = useAppStore(s => s.setSocraticQuestion)
  const clearTraining = useAppStore(s => s.clearTraining)
  const setPracticeQuestionId = useAppStore(s => s.setPracticeQuestionId)

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <h1>超级考公 2.0</h1>
          <p>基于苏格拉底式教学法的智能备考平台</p>
        </div>

        <nav className="nav-bar">
          <button
            className={`nav-btn ${currentView === 'bank' ? 'active' : ''}`}
            onClick={() => setCurrentView('bank')}
          >
            <span className="nav-icon">📚</span>
            题库
          </button>
          <button
            className={`nav-btn ${currentView === 'practice' ? 'active' : ''}`}
            onClick={() => {
              setPracticeQuestionId(undefined)
              clearTraining()
              setCurrentView('practice')
            }}
          >
            <span className="nav-icon">✏️</span>
            刷题
          </button>
          <button
            className={`nav-btn ${currentView === 'wrong' ? 'active' : ''}`}
            onClick={() => setCurrentView('wrong')}
          >
            <span className="nav-icon">❌</span>
            错题集
            {wrongQuestions.length > 0 && (
              <span className="badge">{wrongQuestions.length}</span>
            )}
          </button>
          <button
            className={`nav-btn ${currentView === 'ai-help' ? 'active' : ''}`}
            onClick={() => setCurrentView('ai-help')}
          >
            <span className="nav-icon">🤖</span>
            AI辅助
          </button>
          <button
            className={`nav-btn ${currentView === 'stats' ? 'active' : ''}`}
            onClick={() => setCurrentView('stats')}
          >
            <span className="nav-icon">📊</span>
            统计
          </button>
          <button
            className={`nav-btn ${currentView === 'exam-sets' ? 'active' : ''}`}
            onClick={() => setCurrentView('exam-sets')}
          >
            <span className="nav-icon">📝</span>
            真题套卷
          </button>
        </nav>

        <ErrorBoundary>
          {currentView === 'bank' && <QuestionBank />}

          {currentView === 'practice' && <Practice />}

          {currentView === 'wrong' && <WrongQuestions />}

          {currentView === 'ai-help' && (
            <div className="ai-help-container">
              <div className="ai-sub-nav">
                <button
                  className={`ai-sub-btn ${aiSubView === 'socratic' ? 'active' : ''}`}
                  onClick={() => setAiSubView('socratic')}
                >
                  <span className="sub-icon">🎓</span>
                  苏格拉底教学
                </button>
                <button
                  className={`ai-sub-btn ${aiSubView === 'training' ? 'active' : ''}`}
                  onClick={() => setAiSubView('training')}
                >
                  <span className="sub-icon">💪</span>
                  强化训练
                </button>
              </div>
              {aiSubView === 'socratic' && (
                <SocraticTeaching
                  initialQuestion={socraticQuestion ? {
                    question: socraticQuestion.question,
                    options: socraticQuestion.options,
                    answer: socraticQuestion.answer,
                    knowledge_point: socraticQuestion.knowledgePoint,
                    module: socraticQuestion.module
                  } : undefined}
                  onClearQuestion={() => setSocraticQuestion(null)}
                />
              )}
              {aiSubView === 'training' && <StrengtheningTraining />}
            </div>
          )}

          {currentView === 'stats' && <Statistics />}

          {currentView === 'exam-sets' && <ExamSets />}
        </ErrorBoundary>
      </div>
    </div>
  )
}

export default App
