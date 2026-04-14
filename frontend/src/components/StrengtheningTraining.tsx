import { useState, useEffect } from 'react'
import { aiApi } from '../api'
import { useAppStore } from '../stores/useAppStore'

interface GeneratedQuestion {
  question: string
  options: string[]
  answer: string
  explanation: string
}

interface WeakPoint {
  knowledgePoint: string
  count: number
  module: string
}

export default function StrengtheningTraining() {
  const wrongQuestions = useAppStore(s => s.wrongQuestions)
  const practiceGenerated = useAppStore(s => s.practiceGenerated)
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([])
  const [selectedPoints, setSelectedPoints] = useState<string[]>([])
  const [questionCount, setQuestionCount] = useState(3)
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')

  // 分析错题找出薄弱点
  useEffect(() => {
    const pointCounts: Record<string, { count: number; module: string }> = {}

    wrongQuestions.forEach(wq => {
      const key = wq.question.knowledgePoint
      // 过滤掉变式题和举一反三
      if (key && key !== '举一反三') {
        if (!pointCounts[key]) {
          pointCounts[key] = { count: 0, module: wq.question.module }
        }
        pointCounts[key].count++
      }
    })

    const points: WeakPoint[] = Object.entries(pointCounts)
      .map(([knowledgePoint, data]) => ({
        knowledgePoint,
        count: data.count,
        module: data.module
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    setWeakPoints(points)
  }, [wrongQuestions])

  const togglePoint = (knowledgePoint: string) => {
    setSelectedPoints(prev =>
      prev.includes(knowledgePoint)
        ? prev.filter(p => p !== knowledgePoint)
        : [...prev, knowledgePoint]
    )
  }

  const handleGenerate = async () => {
    if (selectedPoints.length === 0) {
      setError('请至少选择一个薄弱点')
      return
    }

    setLoading(true)
    setError('')
    setProgress('')

    try {
      const allQuestions: GeneratedQuestion[] = []
      const questionsPerPoint = Math.ceil(questionCount / selectedPoints.length)

      for (const point of selectedPoints) {
        const weakPoint = weakPoints.find(wp => wp.knowledgePoint === point)

        for (let i = 0; i < questionsPerPoint && allQuestions.length < questionCount; i++) {
          setProgress(`正在生成第 ${allQuestions.length + 1} / ${questionCount} 题...`)
          const prompt = `请生成1道关于「${point}」知识点的${weakPoint?.module || '行测'}练习题。

要求：
1. 题目类型为选择题，提供4个选项
2. 返回JSON格式：{"question":"题目","options":["选项A","选项B","选项C","选项D"],"answer":"A","explanation":"解析"}
3. 难度适中，符合考公行测水平

请直接返回JSON，不要有其他说明。`

          const response = await aiApi.chat(prompt)
          let content = response.content

          if (content.includes('```json')) {
            content = content.split('```json')[1].split('```')[0].trim()
          } else if (content.includes('```')) {
            content = content.split('```')[1].split('```')[0].trim()
          }

          try {
            const parsed = JSON.parse(content)
            const q = Array.isArray(parsed) ? parsed[0] : parsed
            const question = q.question || q.题目 || ''
            const options = q.options || q.选项 || []
            const answer = q.answer || q.答案 || ''
            const explanation = q.explanation || q.解析 || ''

            if (question && options.length >= 4 && answer) {
              allQuestions.push({ question, options, answer, explanation })
            }
          } catch (parseErr) {
            console.error('JSON解析失败:', parseErr)
          }
        }
      }

      if (allQuestions.length > 0) {
        setGeneratedQuestions(allQuestions)
      } else {
        setError('生成失败，请重试')
      }
    } catch (err: unknown) {
      console.error('生成错误:', err)
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string }
      const errorMsg = axiosErr.response?.data?.detail || axiosErr.message || '网络错误，请稍后重试'
      setError(`生成失败: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  const handlePractice = () => {
    if (generatedQuestions.length > 0 && selectedPoints.length > 0) {
      console.log('Generated questions:', generatedQuestions)
      const firstPoint = weakPoints.find(wp => selectedPoints.includes(wp.knowledgePoint))
      practiceGenerated(generatedQuestions, firstPoint ? { module: firstPoint.module, knowledgePoint: firstPoint.knowledgePoint } : undefined)
    }
  }

  const handleReset = () => {
    setSelectedPoints([])
    setGeneratedQuestions([])
    setError('')
  }

  return (
    <div className="strengthening-container">
      <div className="strengthening-header">
        <h2>强化训练</h2>
        <p>针对薄弱知识点进行针对性练习</p>
      </div>

      {generatedQuestions.length === 0 ? (
        <div className="strengthening-setup">
          {weakPoints.length > 0 ? (
            <>
              <div className="weak-points-section">
                <h3>您的薄弱知识点</h3>
                <p className="section-desc">根据您的错题记录，以下知识点需要加强</p>

                <div className="weak-points-list">
                  {weakPoints.map((wp, i) => (
                    <div
                      key={i}
                      className={`weak-point-item ${selectedPoints.includes(wp.knowledgePoint) ? 'selected' : ''}`}
                      onClick={() => togglePoint(wp.knowledgePoint)}
                    >
                      <div className="point-header">
                        <span className="knowledge-name">{wp.knowledgePoint}</span>
                        <span className="module-tag">{wp.module}</span>
                      </div>
                      <div className="point-stats">
                        <span className="error-count">错题数：{wp.count}</span>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${(wp.count / Math.max(...weakPoints.map(w => w.count))) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="training-settings">
                <div className="form-group">
                  <label>生成题目数量</label>
                  <div className="count-selector">
                    {[1, 3, 5, 8, 10].map(count => (
                      <button
                        key={count}
                        className={`count-btn ${questionCount === count ? 'active' : ''}`}
                        onClick={() => setQuestionCount(count)}
                      >
                        {count}题
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-large"
                  onClick={handleGenerate}
                  disabled={loading || selectedPoints.length === 0}
                >
                  {loading ? (progress || '生成中...') : `生成 ${questionCount} 道练习题`}
                </button>

                {error && <div className="error-message">{error}</div>}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>暂无薄弱点数据</h3>
              <p>请先完成一些练习，积累错题后，系统会自动分析您的薄弱知识点</p>
            </div>
          )}
        </div>
      ) : (
        <div className="generated-questions">
          <div className="generated-header">
            <h3>已生成 {generatedQuestions.length} 道练习题</h3>
            <p>点击"开始练习"进入刷题模式</p>
          </div>

          <div className="action-buttons">
            <button className="btn btn-secondary" onClick={handleReset}>
              重新生成
            </button>
            <button className="btn btn-primary" onClick={handlePractice}>
              开始练习
            </button>
          </div>
        </div>
      )}
    </div>
  )
}