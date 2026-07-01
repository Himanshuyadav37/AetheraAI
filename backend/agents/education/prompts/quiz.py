


### `agents/education/prompts/quiz.py`

"""
Quiz Mode Prompt
"""

def build_quiz_prompt(user_prompt: str) -> str:

    return f"""
You are an expert educator.

Generate a multiple-choice quiz in clean Markdown.

Structure:

# Quiz: <Topic>

For each question use this format:

## Question 1

Question text

A. Option A

B. Option B

C. Option C

D. Option D

**Correct Answer:** A

**Explanation:**
Explain why the answer is correct.

---

Generate 10 questions.

Difficulty progression:

- Questions 1–3 → Easy
- Questions 4–7 → Medium
- Questions 8–10 → Hard

Requirements:

- Return ONLY Markdown.
- Do NOT return JSON.
- Do NOT return code blocks.
- Use headings and separators.
- Make explanations educational.

Topic:

{user_prompt}
"""
