import { useState, useEffect, useRef } from 'react'
import { aiApi, SessionSummaryResponse } from '../api'
import { questions, Question } from '../data/index'
import { useAppStore } from '../stores/useAppStore'
import WeakPoints from './WeakPoints'
import DailyRecommendations from './DailyRecommendations'

export default function Statistics() {
  const wrongQuestions = useAppStore(s => s.wrongQuestions)
  const doneQuestionIds = useAppStore(s => s.doneQuestionIds)
  const answerHistory = useAppStore(s => s.answerHistory)
  const customQuestions = useAppStore(s => s.customQuestions)
  const bookmarkedIds = useAppStore(s => s.bookmarkedIds)
  const toggleBookmark = useAppStore(s => s.toggleBookmark)
  const setWrongQuestions = useAppStore(s => s.setWrongQuestions)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState('')

  const [sessionData, setSessionData] = useState<SessionSummaryResponse | null>(null)
  const [studyPlan, setStudyPlan] = useState('')
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  useEffect(() => {
    aiApi.getSessionsSummary().then(data => setSessionData(data)).catch(() => {})
  }, [])

  const totalDone = doneQuestionIds.size
  const totalWrong = wrongQuestions.length
  // 基于 answerHistory 计算正确率（每题只保留最新一次作答）
  const totalAnswered = answerHistory.length
  const totalCorrect = answerHistory.filter(h => h.isCorrect).length
  const accuracyRate = totalAnswered > 0 ? totalCorrect / totalAnswered : 0

  // 各模块统计（基于 answerHistory）
  const moduleStats = questions.reduce((acc, q) => {
    if (!acc[q.module]) acc[q.module] = { total: 0, done: 0, correct: 0, wrong: 0 }
    acc[q.module].total++
    if (doneQuestionIds.has(q.id)) acc[q.module].done++
    return acc
  }, {} as Record<string, { total: number; done: number; correct: number; wrong: number }>)

  // 建立 questionId -> module 映射
  const questionModuleMap = new Map(questions.map(q => [q.id, q.module]))
  answerHistory.forEach(h => {
    const mod = questionModuleMap.get(h.questionId)
    if (mod && moduleStats[mod]) {
      if (h.isCorrect) moduleStats[mod].correct++
      else moduleStats[mod].wrong++
    }
  })

  // 薄弱知识点 Top 10
  const knowledgePointErrors = wrongQuestions.reduce((acc, wq) => {
    const kp = wq.question.knowledgePoint
    const mod = wq.question.module
    if (!acc[kp]) acc[kp] = { count: 0, module: mod }
    acc[kp].count++
    return acc
  }, {} as Record<string, { count: number; module: string }>)

  const weakPoints = Object.entries(knowledgePointErrors)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)

  // 近7天做题量
  const now = Date.now()
  const dayMs = 86400000
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const dayStart = now - (6 - i) * dayMs
    const dayEnd = dayStart + dayMs
    const date = new Date(dayStart)
    const label = `${date.getMonth() + 1}/${date.getDate()}`
    const count = wrongQuestions.filter(wq => wq.timestamp >= dayStart && wq.timestamp < dayEnd).length
    return { label, count }
  })

  const handleExportData = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      wrongQuestions,
      doneQuestionIds: [...doneQuestionIds],
      answerHistory,
      customQuestions,
      bookmarkedIds: [...bookmarkedIds],
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `考公备考数据_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (data.wrongQuestions) setWrongQuestions(data.wrongQuestions)
        if (data.doneQuestionIds) {
          const ids: number[] = data.doneQuestionIds
          ids.forEach(id => useAppStore.getState().markDone(id))
        }
        if (data.answerHistory) {
          data.answerHistory.forEach((h: { questionId: number; userAnswer: string; isCorrect: boolean }) => {
            useAppStore.getState().saveAnswer(h.questionId, h.userAnswer, h.isCorrect)
          })
        }
        if (data.customQuestions) {
          data.customQuestions.forEach((q: Question) => {
            useAppStore.getState().addCustomQuestion(q)
          })
        }
        if (data.bookmarkedIds) {
          const ids: number[] = data.bookmarkedIds
          ids.forEach(id => toggleBookmark(id))
        }
        setImportMsg('导入成功！')
        setTimeout(() => setImportMsg(''), 3000)
      } catch {
        setImportMsg('导入失败：文件格式错误')
        setTimeout(() => setImportMsg(''), 3000)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleGeneratePlan = async () => {
    setLoadingPlan(true)
    setStudyPlan('')
    try {
      const res = await aiApi.generateStudyPlan({
        wrong_knowledge_points: weakPoints.map(([kp, v]) => ({
          knowledge_point: kp,
          count: v.count,
          module: v.module
        })),
        session_summaries: (sessionData?.sessions || []).map(s => ({
          knowledge_point: s.knowledge_point,
          mastery_level: s.mastery_level
        })),
        total_done: totalDone,
        accuracy_rate: accuracyRate
      })
      setStudyPlan(res.content)
    } catch {
      setStudyPlan('生成失败，请稍后重试')
    } finally {
      setLoadingPlan(false)
    }
  }

  return (
    <div className="statistics-container">
      {/* 总览卡片 */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-value">{totalDone}</div>
          <div className="stat-label">已完成题目</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalWrong}</div>
          <div className="stat-label">错题数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalDone > 0 ? `${Math.round(accuracyRate * 100)}%` : '--'}</div>
          <div className="stat-label">正确率</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{sessionData?.total_sessions ?? '--'}</div>
          <div className="stat-label">AI教学次数</div>
        </div>
      </div>

      {/* 今日推荐复习 */}
      <DailyRecommendations />

      {/* 薄弱知识点识别 */}
      <WeakPoints />

      {/* 各模块正确率 */}
      <div className="stats-section">
        <h3>各模块完成情况</h3>
        {(Object.entries(moduleStats) as [string, { total: number; done: number; correct: number; wrong: number }][]).map(([mod, data]) => {
          const modAccuracy = (data.correct + data.wrong) > 0
            ? Math.round(data.correct / (data.correct + data.wrong) * 100)
            : 0
          return (
            <div key={mod} className="module-stat-row">
              <span className="module-stat-name">{mod}</span>
              <div className="module-stat-bar">
                <div
                  className="module-stat-fill"
                  style={{ width: data.done > 0 ? `${Math.min(100, (data.done / data.total) * 100)}%` : '0%' }}
                />
              </div>
              <span className="module-stat-count">
                {data.done}/{data.total} 题{(data.correct + data.wrong) > 0 ? ` · 正确率 ${modAccuracy}%` : ''}
              </span>
            </div>
          )
        })}
      </div>

      {/* 薄弱知识点 */}
      {weakPoints.length > 0 && (
        <div className="stats-section">
          <h3>薄弱知识点 Top {weakPoints.length}</h3>
          <div className="weak-points-stats">
            {weakPoints.map(([kp, v], i) => (
              <div key={kp} className="weak-point-stat-row">
                <span className="weak-rank">{i + 1}</span>
                <span className="weak-name">{kp}</span>
                <span className="weak-module-tag">{v.module}</span>
                <span className="weak-error-count">错 {v.count} 次</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 近7天做题趋势（仅显示有错题记录的天） */}
      {wrongQuestions.length > 0 && (
        <div className="stats-section">
          <h3>近7天错题记录</h3>
          <div className="day-chart">
            {last7Days.map(d => (
              <div key={d.label} className="day-bar-col">
                <div className="day-bar-wrap">
                  <div
                    className="day-bar-fill"
                    style={{ height: d.count > 0 ? `${Math.min(100, d.count * 20)}%` : '4px' }}
                  />
                </div>
                <span className="day-label">{d.label}</span>
                {d.count > 0 && <span className="day-count">{d.count}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 苏格拉底掌握程度 */}
      {sessionData && sessionData.total_sessions > 0 && (
        <div className="stats-section">
          <h3>AI教学掌握情况</h3>
          <div className="mastery-distribution">
            {Object.entries(sessionData.mastery_distribution).map(([level, count]) => (
              <div key={level} className="mastery-item">
                <span className={`mastery-dot mastery-${level === '已掌握' ? 'good' : level === '部分掌握' ? 'mid' : 'weak'}`} />
                <span className="mastery-label">{level}</span>
                <span className="mastery-count">{count} 次</span>
              </div>
            ))}
          </div>

          {/* 历史会话列表 */}
          <div className="session-history">
            <h4>历史教学记录</h4>
            {sessionData.sessions.map(s => (
              <div key={s.session_id} className="session-item" onClick={() => setExpandedSession(expandedSession === s.session_id ? null : s.session_id)}>
                <div className="session-item-header">
                  <span className="session-kp">{s.knowledge_point || '未知知识点'}</span>
                  <span className="session-module-tag">{s.module}</span>
                  {s.mastery_level && (
                    <span className={`mastery-badge mastery-${s.mastery_level === '已掌握' ? 'good' : s.mastery_level === '部分掌握' ? 'mid' : 'weak'}`}>
                      {s.mastery_level}
                    </span>
                  )}
                  <span className="session-time">{new Date(s.timestamp).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI学习方案 */}
      <div className="stats-section study-plan-section">
        <h3>个性化学习方案</h3>
        <p className="section-desc">AI 综合分析你的错题和教学记录，生成专属备考计划</p>
        {!studyPlan ? (
          <button className="btn btn-primary" onClick={handleGeneratePlan} disabled={loadingPlan}>
            {loadingPlan ? <><span className="spinner" />生成中...</> : '生成我的学习方案'}
          </button>
        ) : (
          <div className="study-plan-result">
            <div className="result-content">{studyPlan}</div>
            <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={handleGeneratePlan} disabled={loadingPlan}>
              重新生成
            </button>
          </div>
        )}
      </div>
      {/* 数据导出/导入 */}
      <div className="stats-section">
        <h3>数据备份</h3>
        <p className="section-desc">导出学习数据到 JSON 文件，防止浏览器清缓存丢失</p>
        <div className="action-buttons" style={{ gap: 12 }}>
          <button className="btn btn-primary" onClick={handleExportData}>
            导出数据
          </button>
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
            导入数据
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportData}
          />
        </div>
        {importMsg && <p style={{ marginTop: 8, color: importMsg.includes('失败') ? '#e74c3c' : '#27ae60' }}>{importMsg}</p>}
      </div>
    </div>
  )
}
