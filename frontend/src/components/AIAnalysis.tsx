import { useState } from 'react'
import { aiApi } from '../api'

interface QuestionData {
  id: number
  module: string
  knowledgePoint: string
  question: string
  options: string[]
  answer: string
}

interface AIAnalysisProps {
  question: QuestionData
  userAnswer: string
  onClose?: () => void
}

export default function AIAnalysis({ question, userAnswer, onClose }: AIAnalysisProps) {
  const [analysisResult, setAnalysisResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAnalyze = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await aiApi.analyzeQuestion({
        question: question.question,
        options: question.options,
        user_answer: userAnswer,
        correct_answer: question.answer,
        module: question.module,
        knowledge_point: question.knowledgePoint
      })

      setAnalysisResult(response.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-analysis-panel">
      <div className="analysis-header">
        <h3>AI错题解析</h3>
        {onClose && (
          <button className="close-btn" onClick={onClose}>×</button>
        )}
      </div>

      <div className="question-summary">
        <div className="summary-row">
          <span className="label">模块：</span>
          <span className="value">{question.module}</span>
        </div>
        <div className="summary-row">
          <span className="label">知识点：</span>
          <span className="value knowledge">{question.knowledgePoint}</span>
        </div>
        <div className="summary-row">
          <span className="label">你的答案：</span>
          <span className="value wrong">{userAnswer}</span>
        </div>
        <div className="summary-row">
          <span className="label">正确答案：</span>
          <span className="value correct">{question.answer}</span>
        </div>
      </div>

      {!analysisResult ? (
        <div className="analysis-action">
          <button
            className="btn btn-primary btn-large"
            onClick={handleAnalyze}
            disabled={loading}
          >
            {loading ? (
              <span className="loading-text">
                <span className="spinner"></span>
                AI分析中...
              </span>
            ) : (
              '开始AI分析'
            )}
          </button>
        </div>
      ) : (
        <div className="analysis-result">
          <h4>解析结果</h4>
          <div className="result-content">
            {analysisResult}
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => setAnalysisResult('')}
          >
            重新分析
          </button>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  )
}