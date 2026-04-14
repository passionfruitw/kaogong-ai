import { useMemo } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { questions } from '../data/index'

const REVIEW_INTERVALS = [1, 2, 4, 7, 15] // 艾宾浩斯遗忘曲线（天）

export default function DailyRecommendations() {
  const answerHistory = useAppStore(s => s.answerHistory)
  const setPracticeMode = useAppStore(s => s.setPracticeMode)
  const setCurrentView = useAppStore(s => s.setCurrentView)

  const reviewCount = useMemo(() => {
    const now = Date.now()
    const dayMs = 86400000
    let count = 0

    // 按题目ID分组，只保留最新记录
    const latestAnswers = new Map<number, typeof answerHistory[0]>()
    answerHistory.forEach(h => {
      const existing = latestAnswers.get(h.questionId)
      if (!existing || h.timestamp > existing.timestamp) {
        latestAnswers.set(h.questionId, h)
      }
    })

    latestAnswers.forEach(h => {
      const daysPassed = Math.floor((now - h.timestamp) / dayMs)
      if (!h.isCorrect) {
        const nextReview = REVIEW_INTERVALS.find(interval => daysPassed >= interval)
        if (nextReview) count++
      } else if (daysPassed >= 3) {
        count++
      }
    })

    return count
  }, [answerHistory])

  const handleStartReview = () => {
    setPracticeMode('smart')
    setCurrentView('practice')
  }

  if (reviewCount === 0) {
    return (
      <div className="daily-recommendations-empty">
        <p>✅ 今日暂无需要复习的题目</p>
      </div>
    )
  }

  return (
    <div className="daily-recommendations">
      <h3>📅 今日推荐复习</h3>
      <p className="recommendations-desc">基于艾宾浩斯遗忘曲线，今日推荐复习 {reviewCount} 道题</p>
      <button className="start-review-btn" onClick={handleStartReview}>
        开始智能刷题
      </button>
    </div>
  )
}
