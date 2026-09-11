from datetime import datetime
from llm.groq_client import generate_response


def review_report(prompt: str, report: str, live_context: str = ""):
    today_str = datetime.utcnow().strftime("%d %B %Y")
    return generate_response(
        f"""
You are the Chief Fact-Check & Quality Auditor inside NexusAI Autonomous Research AI.
Current Date: {today_str}

Objective: Audit the draft research report for factual accuracy, verification integrity, source groundings, and absence of hallucinations.

User Request:
{prompt}

Live Web Context / Ground Truth:
{live_context[:3000]}

Draft Report to Audit:
{report}

Audit Instructions:
1. Verify if all core entities, dates, host locations, and member nations match verified facts as of {today_str}.
2. Check if figures or statistics are grounded in real reporting or appropriately flagged as estimates/unverified.
3. Confirm that the report includes proper source citations and distinguishes facts from speculative projections.
4. Output clean Markdown with bullet points and clear sections.

Output Format:
### Verification Audit Summary
**Confidence Level:** [High (90%+) / Medium (70-90%) / Low (<70%)]
**Temporal Alignment:** Verified against live {today_str} global reporting.
**Overall Quality Assessment:** Concise assessment of factual rigor and depth.

### Verified Strengths
- Bulleted key strengths

### Critical Quality Checks & Verification Notes
- Evaluation of dates, locations, numbers, and evidence grading
- Debunked/checked claims

### Actionable Intelligence Rating
- Practical utility for analysts and enterprise decision-makers
"""
    )