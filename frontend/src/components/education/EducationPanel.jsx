import { useState } from "react";
import "./EducationPanel.css";

function EducationPanel({ result }) {

  const [activeSection, setActiveSection] = useState("content");
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  if (!result) return null;

  const data = result.response || result;

  // Handle answer selection for quiz
  const handleSelectAnswer = (questionIndex, answer) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  // Handle quiz submission
  const handleSubmitQuiz = () => {
    setShowResults(true);
  };

  // Calculate quiz results
  const correctCount = data.questions ? data.questions.reduce((count, q, i) => {
    return count + (userAnswers[i] === q.correct_answer ? 1 : 0);
  }, 0) : 0;
  const incorrectCount = data.questions ? data.questions.length - correctCount : 0;

  // Handle error case
  if (data.error) {
    return (
      <div className="education-panel">
        <div className="error-box">
          <h3>Error</h3>
          <p>{data.error}</p>
        </div>
      </div>
    );
  }

  // Render different sections based on mode
  const renderContent = () => {
    if (!data || typeof data !== 'object') {
      return <div className="raw-content">{String(data)}</div>;
    }

    // Learn Mode
    if (data.topic && data.introduction && data.definition) {
      return (
        <div className="learn-content">
          <h2 className="topic-title">{data.topic}</h2>
          
          <div className="section">
            <h3>📘 Introduction</h3>
            <p>{data.introduction}</p>
          </div>

          <div className="section">
            <h3>📖 Definition</h3>
            <p>{data.definition}</p>
          </div>

          {data.explanation && (
            <div className="section">
              <h3>📝 Step-by-Step Explanation</h3>
              <ul>
                {data.explanation.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          )}

          {data.real_life_example && (
            <div className="section">
              <h3>🌍 Real-Life Example</h3>
              <p>{data.real_life_example}</p>
            </div>
          )}

          {data.analogy && (
            <div className="section">
              <h3>💡 Simple Analogy</h3>
              <p>{data.analogy}</p>
            </div>
          )}

          {data.advantages && data.advantages.length > 0 && (
            <div className="section">
              <h3>✅ Advantages</h3>
              <ul>
                {data.advantages.map((adv, i) => (
                  <li key={i}>{adv}</li>
                ))}
              </ul>
            </div>
          )}

          {data.disadvantages && data.disadvantages.length > 0 && (
            <div className="section">
              <h3>❌ Disadvantages</h3>
              <ul>
                {data.disadvantages.map((dis, i) => (
                  <li key={i}>{dis}</li>
                ))}
              </ul>
            </div>
          )}

          {data.summary && (
            <div className="section highlight">
              <h3>📌 Summary</h3>
              <p>{data.summary}</p>
            </div>
          )}

          {data.practice_question && (
            <div className="section practice-box">
              <h3>🎯 Practice Question</h3>
              <p><strong>Q:</strong> {data.practice_question.question}</p>
              <p><strong>A:</strong> {data.practice_question.answer}</p>
            </div>
          )}
        </div>
      );
    }

    // Quiz Mode
    if (data.questions && Array.isArray(data.questions)) {
      return (
        <div className="quiz-content">
          <h2 className="topic-title">{data.topic}</h2>
          {data.questions.map((q, i) => (
            <div key={i} className="quiz-item">
              <h3>Q{i + 1}: {q.question}</h3>
              <div className="options">
                {q.options.map((opt, j) => (
                  <div 
                    key={j} 
                    className={`option ${userAnswers[i] === String.fromCharCode(65 + j) ? 'selected' : ''} ${showResults && q.correct_answer === String.fromCharCode(65 + j) ? 'correct' : ''} ${showResults && userAnswers[i] === String.fromCharCode(65 + j) && userAnswers[i] !== q.correct_answer ? 'incorrect' : ''}`}
                    onClick={() => !showResults && handleSelectAnswer(i, String.fromCharCode(65 + j))}
                  >
                    {String.fromCharCode(65 + j)}. {opt}
                  </div>
                ))}
              </div>
              {showResults && (
                <div className="quiz-explanation">
                  <strong>Correct Answer:</strong> {q.correct_answer}<br/>
                  <strong>Explanation:</strong> {q.explanation}
                </div>
              )}
            </div>
          ))}
          {!showResults ? (
            <button className="quiz-submit-btn" onClick={handleSubmitQuiz}>
              Submit Quiz
            </button>
          ) : (
            <div className="quiz-results">
              <h3>Quiz Results</h3>
              <div className="quiz-stats">
                <div className="quiz-stat">
                  <div className="quiz-stat-value">{correctCount}</div>
                  <div className="quiz-stat-label">Correct</div>
                </div>
                <div className="quiz-stat">
                  <div className="quiz-stat-value">{incorrectCount}</div>
                  <div className="quiz-stat-label">Incorrect</div>
                </div>
                <div className="quiz-stat">
                  <div className="quiz-stat-value">{Math.round((correctCount / data.questions.length) * 100)}%</div>
                  <div className="quiz-stat-label">Score</div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Coding Mode
    if (data.code && data.algorithm) {
      return (
        <div className="coding-content">
          <h2 className="topic-title">{data.topic}</h2>
          
          <div className="section">
            <h3>💻 Concept</h3>
            <p>{data.concept}</p>
          </div>

          <div className="section">
            <h3>🧠 Logic</h3>
            <p>{data.logic}</p>
          </div>

          <div className="section">
            <h3>📋 Algorithm</h3>
            <ol>
              {data.algorithm.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          <div className="section code-section">
            <h3>💾 Code</h3>
            <pre>{data.code}</pre>
          </div>

          {data.dry_run && (
            <div className="section">
              <h3>🔄 Dry Run</h3>
              <pre>{data.dry_run}</pre>
            </div>
          )}

          <div className="section">
            <h3>⏱️ Time Complexity: {data.time_complexity}</h3>
            <h3>💾 Space Complexity: {data.space_complexity}</h3>
          </div>

          {data.common_mistakes && (
            <div className="section">
              <h3>⚠️ Common Mistakes</h3>
              <ul>
                {data.common_mistakes.map((mistake, i) => (
                  <li key={i}>{mistake}</li>
                ))}
              </ul>
            </div>
          )}

          {data.practice_question && (
            <div className="section practice-box">
              <h3>🎯 Practice Question</h3>
              <p><strong>Q:</strong> {data.practice_question.question}</p>
              <p><strong>Hint:</strong> {data.practice_question.hint}</p>
            </div>
          )}
        </div>
      );
    }

    // Interview Mode
    if (data.beginner_questions || data.intermediate_questions || data.advanced_questions) {
      return (
        <div className="interview-content">
          <h2 className="topic-title">{data.topic}</h2>
          
          {data.beginner_questions && (
            <div className="section">
              <h3>🟢 Beginner Questions</h3>
              {data.beginner_questions.map((q, i) => (
                <div key={i} className="interview-item">
                  <p><strong>Q{i + 1}:</strong> {q.question}</p>
                  <p><strong>Answer:</strong> {q.answer}</p>
                  <p><strong>Explanation:</strong> {q.explanation}</p>
                  <p><strong>Follow-up:</strong> {q.follow_up}</p>
                  <p><strong>💡 Tip:</strong> {q.tip}</p>
                </div>
              ))}
            </div>
          )}

          {data.intermediate_questions && (
            <div className="section">
              <h3>🟡 Intermediate Questions</h3>
              {data.intermediate_questions.map((q, i) => (
                <div key={i} className="interview-item">
                  <p><strong>Q{i + 1}:</strong> {q.question}</p>
                  <p><strong>Answer:</strong> {q.answer}</p>
                  <p><strong>Explanation:</strong> {q.explanation}</p>
                  <p><strong>Follow-up:</strong> {q.follow_up}</p>
                  <p><strong>💡 Tip:</strong> {q.tip}</p>
                </div>
              ))}
            </div>
          )}

          {data.advanced_questions && (
            <div className="section">
              <h3>🔴 Advanced Questions</h3>
              {data.advanced_questions.map((q, i) => (
                <div key={i} className="interview-item">
                  <p><strong>Q{i + 1}:</strong> {q.question}</p>
                  <p><strong>Answer:</strong> {q.answer}</p>
                  <p><strong>Explanation:</strong> {q.explanation}</p>
                  <p><strong>Follow-up:</strong> {q.follow_up}</p>
                  <p><strong>💡 Tip:</strong> {q.tip}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Roadmap Mode
    if (data.weeks && Array.isArray(data.weeks)) {
      return (
        <div className="roadmap-content">
          <h2 className="topic-title">{data.topic}</h2>
          <p className="duration">⏱️ Estimated Duration: {data.duration}</p>
          
          {data.prerequisites && (
            <div className="section">
              <h3>📚 Prerequisites</h3>
              <ul>
                {data.prerequisites.map((pre, i) => (
                  <li key={i}>{pre}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="section">
            <h3>🗺️ Week-wise Plan</h3>
            {data.weeks.map((week, i) => (
              <div key={i} className="week-item">
                <h4>Week {week.week}: {week.title}</h4>
                <p><strong>Skills:</strong> {week.skills.join(", ")}</p>
                <p><strong>Resources:</strong> {week.resources.join(", ")}</p>
                <p><strong>Project:</strong> {week.project}</p>
              </div>
            ))}
          </div>

          {data.interview_preparation && (
            <div className="section">
              <h3>🎤 Interview Preparation</h3>
              <ul>
                {data.interview_preparation.map((topic, i) => (
                  <li key={i}>{topic}</li>
                ))}
              </ul>
            </div>
          )}

          {data.career_opportunities && (
            <div className="section">
              <h3>💼 Career Opportunities</h3>
              <ul>
                {data.career_opportunities.map((role, i) => (
                  <li key={i}>{role}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    // Fallback for other modes or raw text
    return (
      <div className="raw-content">
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    );
  };

  return (
    <div className="output-card education-panel">
      <div className="education-header">
        <h2>{result.title || "Education Output"}</h2>
        {result.mode && <span className="mode-badge">{result.mode}</span>}
      </div>
      {renderContent()}
    </div>
  );
}

export default EducationPanel;