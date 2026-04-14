import { questions } from './data/questions'

export default function Debug() {
  return (
    <div style={{padding: '20px'}}>
      <h1>题目调试信息</h1>
      <p>题目总数: {questions.length}</p>
      <p>题目ID范围: {questions[0]?.id} - {questions[questions.length-1]?.id}</p>
      <h2>所有题目ID:</h2>
      <div>{questions.map(q => q.id).join(', ')}</div>
    </div>
  )
}
