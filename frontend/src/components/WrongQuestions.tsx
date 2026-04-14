import { useState, useEffect } from 'react'
import QuestionCard from './QuestionCard'
import { aiApi } from '../api'
import { Question } from '../data/index'
import { useAppStore } from '../stores/useAppStore'

export default function WrongQuestions() {
  const wrongQuestions = useAppStore(s => s.wrongQuestions)
  const startPractice = useAppStore(s => s.startPractice)
  const goToSocratic = useAppStore(s => s.goToSocratic)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [analysisResult, setAnalysisResult] = useState<string>('')
  const [analyzing, setAnalyzing] = useState(false)
  const [practiceAnswer, setPracticeAnswer] = useState<string | undefined>()
  const [practiceSubmitted, setPracticeSubmitted] = useState(false)

  const selectedQuestion = selectedIndex !== null ? wrongQuestions[selectedIndex] : null

  // 进入详情页自动触发AI分析
  useEffect(() => {
    if (selectedQuestion && !analysisResult) {
      handleAnalyze(selectedQuestion.question, selectedQuestion.userAnswer)
    }
  }, [selectedIndex])

  const handleAnalyze = async (question: Question, userAnswer: string) => {
    setAnalyzing(true)
    setAnalysisResult('')
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
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { detail?: string } }; message?: string }
      const errorMsg = axiosErr.response?.data?.detail || axiosErr.message || '网络错误，请稍后重试'
      setAnalysisResult(`分析失败: ${errorMsg}`)
    } finally {
      setAnalyzing(false)
    }
  }

  if (wrongQuestions.length === 0) {
    return (
      <div className="wrong-questions empty">
        <div className="empty-state">
          <h3>错题集为空</h3>
          <p>继续刷题，答错的题目会自动加入错题集</p>
        </div>
      </div>
    )
  }

  return (
    <div className="wrong-questions">
      <div className="wrong-header">
        <h2>错题集</h2>
        <p className="wrong-count">共 {wrongQuestions.length} 道错题</p>
      </div>

      {selectedQuestion ? (
        <div className="wrong-detail">
          <button
            className="btn btn-secondary back-btn"
            onClick={() => {
              setSelectedIndex(null)
              setAnalysisResult('')
              setPracticeAnswer(undefined)
              setPracticeSubmitted(false)
            }}
          >
            ← 返回错题列表
          </button>

          {/* 重练模式 */}
          {!practiceSubmitted ? (
            <>
              <QuestionCard
                question={selectedQuestion.question}
                isPractice={true}
                showResult={false}
                selectedAnswer={practiceAnswer}
                onAnswerSelect={setPracticeAnswer}
              />
              <button
                className="btn btn-primary submit-btn"
                disabled={!practiceAnswer}
                onClick={() => setPracticeSubmitted(true)}
              >
                提交答案
              </button>
            </>
          ) : (
            <>
              <QuestionCard
                question={selectedQuestion.question}
                isPractice={true}
                showResult={true}
                selectedAnswer={practiceAnswer}
              />
              <div className={`result-banner ${practiceAnswer === selectedQuestion.question.answer ? 'correct' : 'wrong'}`}>
                {practiceAnswer === selectedQuestion.question.answer ? '✓ 答对了！' : `✗ 答错了，正确答案是 ${selectedQuestion.question.answer}`}
              </div>
            </>
          )}

          <div className="analysis-section">
            <div className="analysis-section-header">
              <h3>AI错题解析</h3>
              {!analyzing && analysisResult && (
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => handleAnalyze(selectedQuestion.question, selectedQuestion.userAnswer)}
                >
                  重新分析
                </button>
              )}
            </div>
            {analyzing ? (
              <div className="analyzing-state">
                <span className="spinner-inline"></span>
                <span>AI分析中...</span>
              </div>
            ) : (
              <div className="analysis-result">
                <p>{analysisResult}</p>
              </div>
            )}
          </div>

          <div className="wrong-detail-actions">
            <button
              className="btn btn-secondary"
              onClick={() => startPractice(selectedQuestion.question.id)}
            >
              重新练习此题
            </button>
            <button
              className="btn btn-primary"
              onClick={() => goToSocratic({
                question: selectedQuestion.question.question,
                options: selectedQuestion.question.options,
                answer: selectedQuestion.question.answer,
                knowledgePoint: selectedQuestion.question.knowledgePoint,
                module: selectedQuestion.question.module
              })}
            >
              苏格拉底教学
            </button>
          </div>
        </div>
      ) : (
        <div className="wrong-list">
          {wrongQuestions.map((wq, index) => (
            <div key={index} className="wrong-item">
              <div className="wrong-item-main" onClick={() => { setSelectedIndex(index); setAnalysisResult('') }}>
                <div className="wrong-item-header">
                  <span className="question-id">{wq.question.id === 0 ? '变式题' : `第${wq.question.id}题`}</span>
                  <span className="question-module">{wq.question.module}</span>
                  <span className="knowledge-tag">{wq.question.knowledgePoint}</span>
                </div>
                <p className="question-preview">
                  {wq.question.question.length > 60
                    ? wq.question.question.substring(0, 60) + '...'
                    : wq.question.question}
                </p>
                <div className="wrong-info">
                  <span className="user-answer">你的答案: {wq.userAnswer}</span>
                  <span className="correct-answer">正确答案: {wq.question.answer}</span>
                </div>
              </div>
              <div className="wrong-item-actions">
                <button
                  className="btn btn-sm btn-outline"
                  title="查看题目详情并获取AI解析"
                  onClick={() => { setSelectedIndex(index); setAnalysisResult('') }}
                >
                  AI解析
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  title="通过苏格拉底式对话深入理解知识点"
                  onClick={() => goToSocratic({
                    question: wq.question.question,
                    options: wq.question.options,
                    answer: wq.question.answer,
                    knowledgePoint: wq.question.knowledgePoint,
                    module: wq.question.module
                  })}
                >
                  苏格拉底教学
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
