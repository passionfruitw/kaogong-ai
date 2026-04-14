import { useMemo } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { questions } from '../data/index'

export default function WeakPoints() {
  const answerHistory = useAppStore(s => s.answerHistory)
  const setPracticeQuestionId = useAppStore(s => s.setPracticeQuestionId)
  const setCurrentView = useAppStore(s => s.setCurrentView)

  const weakPoints = useMemo(() => {
    const stats: Record<string, { total: number; correct: number; module: string; questionIds: number[] }> = {}

    answerHistory.forEach(h => {
      const q = questions.find(q => q.id === h.questionId)
      if (q) {
        const key = `${q.module}-${q.knowledgePoint}`
        if (!stats[key]) {
          stats[key] = { total: 0, correct: 0, module: q.module, questionIds: [] }
        }
        stats[key].total++
        if (h.isCorrect) stats[key].correct++
        stats[key].questionIds.push(q.id)
      }
    })

    return Object.entries(stats)
      .filter(([_, s]) => s.total >= 3 && s.correct / s.total < 0.6)
      .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
      .slice(0, 10)
  }, [answerHistory])

  const handlePractice = (questionIds: number[]) => {
    if (questionIds.length > 0) {
      setPracticeQuestionId(questionIds[0])
      setCurrentView('practice')
    }
  }

  if (weakPoints.length === 0) {
    return (
      <div className="weak-points-empty">
        <p>暂无薄弱知识点数据，继续刷题积累数据吧！</p>
      </div>
    )
  }

  return (
    <div className="weak-points">
      <h3>📉 薄弱知识点识别</h3>
      <p className="weak-points-desc">正确率低于60%且做题数≥3的知识点</p>
      <div className="weak-points-list">
        {weakPoints.map(([key, stat]) => {
          const [module, kp] = key.split('-')
          const rate = (stat.correct / stat.total * 100).toFixed(1)
          return (
            <div key={key} className="weak-point-item">
              <div className="weak-point-info">
                <span className="weak-point-module">{module}</span>
                <span className="weak-point-kp">{kp}</span>
                <span className="weak-point-stats">
                  {stat.correct}/{stat.total} ({rate}%)
                </span>
              </div>
              <button
                className="weak-point-btn"
                onClick={() => handlePractice(stat.questionIds)}
              >
                针对练习
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
