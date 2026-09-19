from datetime import datetime
from llm.groq_client import generate_response


def write_report(prompt: str, plan: str, findings: str, sources_list: list[dict] = None):
    today_str = datetime.utcnow().strftime("%d %B %Y")
    
    # Format source links for writer context
    sources_text = ""
    if sources_list:
        sources_text = "\n".join([
            f"- [{s.get('source', 'Source')}: {s.get('title', 'Article')}]({s.get('url', '#')}) (Published: {s.get('published', 'Recent')})"
            for s in sources_list[:12]
        ])

    prompt_str = f"""
You are the Principal Executive Intelligence Writer inside NexusAI Research AI.
Current Date: {today_str}

Craft a publication-ready, deeply analytical, and rigorously fact-checked Strategic Intelligence Report based on the research findings and live evidence.

User Topic / Request:
{prompt}

Synthesized Findings & Evidence:
{findings}

Verified Live Sources Available:
{sources_text}

MANDATORY EDITORIAL STANDARDS:
1. FACTUAL PRECISION & ZERO HALLUCINATION:
   - Base all claims on verified reality as of {today_str}.
   - Embed active markdown source links throughout the body text (e.g. "...according to [Reuters](URL)...").
2. EVIDENCE RANKING TABLE:
   - The 'Key Findings' section MUST use a clean GFM markdown table where each row is on its own separate line.
   - Every row MUST have an explicit Evidence Classification column: [Confirmed], [Reported], [Developing], or [Analytical Inference].
3. STRATEGIC & BUSINESS RELEVANCE:
   - Provide concrete insights for startups, technology leaders, and enterprises.
4. COMPLETE SOURCES APPENDIX:
   - The report MUST conclude with a comprehensive `## Sources & Evidence Appendix` that lists every referenced article, publisher name, publication date, and clickable Markdown URL.

REQUIRED DOCUMENT STRUCTURE:
# [Accurate, Authoritative Report Title]
**Temporal Baseline:** {today_str} | **Intelligence Status:** Multi-Source Verified | **Scope:** Global Strategic Analysis

---

## Executive Summary
Concise synthesis of the core verified development, strategic context, and primary significance.

---

## Key Findings & Evidence Matrix
| Focus Area | Verified Finding | Evidence Grade | Source Reference |
|---|---|---|---|
| Core Development | Detail | [Confirmed] | [Publisher](URL) |
| Strategic Impact | Detail | [Reported] | [Publisher](URL) |

---

## Geopolitical & Strategic Analysis
In-depth breakdown of positioning, bloc cohesion, frictions, and multilateral dynamics.

---

## Technology, Digital Infrastructure & Business Implications
- **Fintech & Payment Rails**: (Payment systems, CBDCs, interoperability)
- **AI & Data Infrastructure**: (Compute sharing, ethical frameworks, sovereign tech)
- **Enterprise & Startup Opportunities**: (Trade corridors, incubator networks)

---

## Critical Risks & Strategic Uncertainties
| Strategic Risk | Probability / Impact | Key Drivers | Mitigation Strategy |
|---|---|---|---|
| Risk 1 | High / Medium | Driver description | Mitigation plan |

---

## Actionable Recommendations
1. **Priority Action 1**: Strategic decision takeaway.
2. **Priority Action 2**: Technical or governance takeaway.
3. **Priority Action 3**: Risk mitigation takeaway.

---

## Sources & Evidence Appendix
List all verified sources as clickable Markdown links with publisher and date:
- [Publisher: Title](URL) - Date
"""
    return generate_response(prompt_str, max_tokens=8192)