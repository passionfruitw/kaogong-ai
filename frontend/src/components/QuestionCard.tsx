import { useState } from 'react'
import { Question, passages } from '../data/index'
import { aiApi } from '../api'

interface VariantQuestion {
  question: string
  options?: string[]
  answer?: string
  explanation?: string
}

interface QuestionCardProps {
  question: Question
  onAnswerSelect?: (answer: string) => void
  onPracticeVariant?: (variant: VariantQuestion, originalQuestion: Question) => void
  isPractice?: boolean
  selectedAnswer?: string
  showResult?: boolean
  onAnalyzeClick?: () => void
  hidePassage?: boolean
}

const optionLabels = ['A', 'B', 'C', 'D']

export default function QuestionCard({
  question,
  onAnswerSelect,
  onPracticeVariant,
  isPractice = false,
  selectedAnswer,
  showResult = false,
  onAnalyzeClick,
  hidePassage = false
}: QuestionCardProps) {
  const [variantsLoading, setVariantsLoading] = useState(false)

  const handleOptionClick = (option: string) => {
    if (isPractice && !showResult) {
      onAnswerSelect?.(option)
    }
  }

  const [variantsError, setVariantsError] = useState('')

  const handleVariants = async () => {
    setVariantsLoading(true)
    setVariantsError('')
    try {
      console.log('开始生成举一反三题目...')
      const response = await aiApi.generateVariants({
        question: question.question,
        options: question.options,
        correct_answer: question.answer,
        module: question.module,
        knowledge_point: question.knowledgePoint,
        count: 1
      })
      console.log('API响应:', response)

      let content = response.content
      console.log('原始内容:', content)
      if (content.includes('```json')) {
        content = content.split('```json')[1].split('```')[0].trim()
      } else if (content.includes('```')) {
        content = content.split('```')[1].split('```')[0].trim()
      }
      console.log('处理后内容:', content)

      const parsed = JSON.parse(content)
      console.log('解析后数据:', parsed)
      const variantData = Array.isArray(parsed) ? parsed[0] : parsed
      const variant = {
        question: variantData.question || variantData.题目 || '',
        options: variantData.options || variantData.选项 || [],
        answer: variantData.answer || variantData.答案 || '',
        explanation: variantData.explanation || variantData.解析 || ''
      }
      console.log('最终变式题:', variant)

      if (variant.question && variant.options.length >= 4) {
        onPracticeVariant?.(variant, question)
      } else {
        setVariantsError('生成的题目格式不完整')
      }
    } catch (error: unknown) {
      console.error('举一反三错误:', error)
      const axiosErr = error as { response?: { data?: { detail?: string } }; message?: string }
      const errorMsg = axiosErr.response?.data?.detail || axiosErr.message || '网络错误'
      setVariantsError(`生成失败: ${errorMsg}`)
    } finally {
      setVariantsLoading(false)
    }
  }

  const getOptionClass = (option: string) => {
    let classes = 'option-btn '

    if (showResult) {
      if (option === question.answer) {
        classes += 'correct '
      } else if (option === selectedAnswer && option !== question.answer) {
        classes += 'wrong '
      }
    } else if (isPractice && option === selectedAnswer) {
      classes += 'selected '
    }

    return classes
  }

  const isCorrect = selectedAnswer === question.answer
  const passage = question.passageId ? passages.find(p => p.id === question.passageId) : null

  return (
    <div className="question-card">
      <div className="question-header">
        <span className="module-tag">{question.module}</span>
        <span className="knowledge-tag">{question.knowledgePoint}</span>
      </div>

      {passage && !hidePassage && (
        <div className="passage-content">
          <h4>{passage.title}</h4>
          <div className="passage-text" dangerouslySetInnerHTML={{ __html: passage.content }} />
          {passage.image && <img src={passage.image} alt="材料图片" className="passage-image" />}
          {passage.images && passage.images.length > 0 && (
            <div className="passage-images">
              {passage.images.map((img, idx) => (
                <img key={idx} src={img} alt={`材料图片${idx + 1}`} className="passage-image" />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="question-content">
        <div className="question-number">第 {question.id % 1000} 题</div>
        <div className="question-text" dangerouslySetInnerHTML={{ __html: question.question }} />
        {question.image && (
          <div className="question-image-wrapper">
            <img src={question.image} alt="题目图片" className="question-image" />
          </div>
        )}
        {question.images && question.images.length > 0 && (() => {
          const layout = question.imageLayout
          if (layout) {
            const matrixImgs = question.images!.slice(0, layout.matrix)
            const cols = layout.cols ?? Math.ceil(Math.sqrt(layout.matrix))
            return (
              <div
                className="question-matrix-grid"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
              >
                {matrixImgs.map((img, idx) => (
                  <div key={idx} className="matrix-cell">
                    {img === '?' ? (
                      <span className="matrix-placeholder">?</span>
                    ) : (
                      <img src={img} alt={`矩阵图${idx + 1}`} />
                    )}
                  </div>
                ))}
              </div>
            )
          }
          return (
            <div className="question-images-wrapper">
              {question.images!.map((img, idx) => (
                <img key={idx} src={img} alt={`题目图片${idx + 1}`} className="question-image" />
              ))}
            </div>
          )
        })()}
      </div>

      <div className="options-container">
        {question.options.map((option, index) => {
          const layout = question.imageLayout
          const optionImg = layout
            ? question.images![layout.matrix + index]
            : null
          return (
            <button
              key={index}
              className={getOptionClass(optionLabels[index])}
              onClick={() => handleOptionClick(optionLabels[index])}
              disabled={isPractice && showResult}
            >
              <span className="option-label">{optionLabels[index]}.</span>
              {optionImg
                ? <img src={optionImg} alt={`选项${optionLabels[index]}`} className="option-image" />
                : option.startsWith('/')
                  ? <img src={option} alt={`选项${optionLabels[index]}`} className="option-image" />
                  : option.includes('<img')
                    ? <span className="option-text" dangerouslySetInnerHTML={{ __html: option.replace(/^[A-D][、.\s]+/, '') }} />
                    : <span className="option-text">{option.replace(/^[A-D][、.\s]+/, '')}</span>
              }
            </button>
          )
        })}
      </div>

      
      {showResult && (
        <div className={`result-banner ${isCorrect ? 'correct' : 'wrong'}`}>
          {isCorrect ? '回答正确！' : `回答错误，正确答案是 ${question.answer}`}
        </div>
      )}

      {showResult && !isCorrect && (
        <div className="action-buttons">
          <button className="btn btn-secondary" onClick={onAnalyzeClick}>
            AI分析错题
          </button>
          <button
            className="btn btn-secondary variant-btn"
            onClick={handleVariants}
            disabled={variantsLoading}
          >
            {variantsLoading ? '生成中...' : '举一反三'}
          </button>
        </div>
      )}

      {variantsError && <div className="error-message">{variantsError}</div>}
    </div>
  )
}