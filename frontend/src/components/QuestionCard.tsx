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

const optionLabels = ['A', 'B', 'C', 'D'] as const

type VariantRecord = Record<string, unknown>

function asRecord(value: unknown): VariantRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as VariantRecord : null
}

function getValue(record: VariantRecord, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key]
  }
  return undefined
}

function getString(record: VariantRecord, keys: string[]) {
  const value = getValue(record, keys)
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}

function stripOptionLabel(option: string) {
  return option.replace(/^\s*[A-D][、.．:：\s]+/i, '').trim()
}

function normalizeOptions(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map(item => stripOptionLabel(String(item ?? '')))
      .filter(Boolean)
  }

  const record = asRecord(value)
  if (record) {
    return optionLabels
      .map(label => record[label] ?? record[label.toLowerCase()] ?? record[`选项${label}`])
      .map(item => stripOptionLabel(String(item ?? '')))
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    const chunks = value
      .split(/(?=\s*[A-D][、.．:：]\s*)/i)
      .map(stripOptionLabel)
      .filter(Boolean)

    if (chunks.length >= 4) return chunks

    return value
      .split(/\r?\n|[；;]/)
      .map(stripOptionLabel)
      .filter(Boolean)
  }

  return []
}

function normalizeAnswer(value: unknown) {
  const text = String(value ?? '').trim()
  const match = text.match(/[A-D]/i)
  return match ? match[0].toUpperCase() : ''
}

function stripCodeFence(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fenced?.[1] || content).trim()
}

function parseJsonLike(content: string): unknown {
  const clean = stripCodeFence(content)
  const candidates = [clean]
  const arrayStart = clean.indexOf('[')
  const arrayEnd = clean.lastIndexOf(']')
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    candidates.push(clean.slice(arrayStart, arrayEnd + 1))
  }

  const objectStart = clean.indexOf('{')
  const objectEnd = clean.lastIndexOf('}')
  if (objectStart !== -1 && objectEnd > objectStart) {
    candidates.push(clean.slice(objectStart, objectEnd + 1))
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // Try the next likely JSON segment.
    }
  }

  throw new Error('AI返回不是有效JSON，请重试')
}

function unwrapVariant(value: unknown): unknown {
  if (Array.isArray(value)) return value[0]

  const record = asRecord(value)
  if (!record) return value

  for (const key of ['variants', 'questions', 'items', 'data', 'result', '变式题', '题目列表']) {
    const nested = record[key]
    if (nested !== undefined) return unwrapVariant(nested)
  }

  return value
}

function normalizeVariantPayload(content: string): VariantQuestion {
  const parsed = parseJsonLike(content)
  const data = asRecord(unwrapVariant(parsed))
  if (!data) throw new Error('AI返回格式不完整，请重试')

  const question = getString(data, ['question', '题目', 'stem', '题干', 'content'])
  const options = normalizeOptions(getValue(data, ['options', '选项', 'choices', '选项列表']))
  const answer = normalizeAnswer(getValue(data, ['answer', '答案', 'correct_answer', 'correctAnswer', '正确答案']))
  const explanation = getString(data, ['explanation', '解析', 'analysis', 'solution', '解题思路'])

  if (!question) throw new Error('AI返回的题干为空，请重试')
  if (options.length < 4) throw new Error('AI返回的选项不足4个，请重试')
  if (!optionLabels.some(label => label === answer)) throw new Error('AI返回的答案不是A-D，请重试')

  return {
    question,
    options: options.slice(0, 4),
    answer,
    explanation
  }
}

function getVariantErrorMessage(error: unknown) {
  const axiosErr = error as { code?: string; response?: { status?: number; data?: { detail?: string } }; message?: string }
  const status = axiosErr.response?.status
  const detail = axiosErr.response?.data?.detail

  if (status === 504 || status === 502 || status === 503 || axiosErr.code === 'ECONNABORTED') {
    return 'AI响应超时，系统已自动重试但仍未完成。请稍后再点一次举一反三。'
  }

  if (status === 429) {
    return 'AI请求过于频繁，请稍等片刻后重试。'
  }

  return detail || (error instanceof Error ? error.message : axiosErr.message) || '网络错误'
}

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
      const response = await aiApi.generateVariants({
        question: question.question,
        options: question.options,
        correct_answer: question.answer,
        module: question.module,
        knowledge_point: question.knowledgePoint,
        passage: passage?.content,
        count: 1
      })
      const variant = normalizeVariantPayload(response.content)
      onPracticeVariant?.(variant, question)
    } catch (error: unknown) {
      console.error('举一反三错误:', error)
      const errorMsg = getVariantErrorMessage(error)
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

      {showResult && (onAnalyzeClick || onPracticeVariant) && (
        <div className="action-buttons">
          {onAnalyzeClick && (
            <button className="btn btn-secondary" onClick={onAnalyzeClick}>
              AI分析
            </button>
          )}
          {onPracticeVariant && (
            <button
              className="btn btn-secondary variant-btn"
              onClick={handleVariants}
              disabled={variantsLoading}
            >
              {variantsLoading ? '生成中...' : '举一反三'}
            </button>
          )}
        </div>
      )}

      {variantsError && <div className="error-message">{variantsError}</div>}
    </div>
  )
}
