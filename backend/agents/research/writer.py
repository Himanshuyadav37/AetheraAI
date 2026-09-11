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

    return generate_response(
        f"""
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
   - If the user asks about current events (e.g. BRICS 2026), ensure the host nation (India, New Delhi), current dates, and expanded 2026 member composition are accurately stated.
   - Embed active markdown source links throughout the body text (e.g. "...according to [Reuters](URL)...").
2. EVIDENCE RANKING TABLE:
   - The 'Key Findings' section MUST use a clean GFM markdown table where each row is on its own separate line.
   - Every row MUST have an explicit Evidence Classification column: [Confirmed], [Reported], [Developing], or [Analytical Inference].
3. STRATEGIC & BUSINESS RELEVANCE:
   - Provide concrete insights for startups, technology leaders, and enterprises (e.g., Cross-border payments, Digital Public Infrastructure, AI Governance, Supply Chains, Trade corridors).
4. COMPLETE SOURCES APPENDIX:
   - The report MUST conclude with a comprehensive `## Sources & Evidence Appendix` that lists every referenced article, publisher name, publication date, and clickable Markdown URL. DO NOT leave it as a placeholder.

REQUIRED DOCUMENT STRUCTURE:
# [Accurate, Authoritative Report Title]
**Temporal Baseline:** {today_str} | **Intelligence Status:** Multi-Source Verified | **Scope:** Global Strategic Analysis

## Executive Summary
Concise synthesis of the core verified development, strategic context, and primary significance.

## Key Findings & Evidence Matrix
Each table row on its own line:
| Focus Area | Verified Finding | Evidence Grade | Source Reference |
|---|---|---|---|
| ... | ... | [Confirmed] / [Reported] | [Source Name](URL) |

## Geopolitical & Strategic Analysis
In-depth breakdown of diplomatic positioning, bloc cohesion, internal frictions (e.g. regional tensions, sanctions impacts), and multilateral dynamics.

## Technology, Digital Infrastructure & Business Implications
Actionable breakdown covering:
- **Digital Economy & Fintech Rails:** (Payment systems, CBDCs, interoperability)
- **AI Governance & Data Infrastructure:** (Compute sharing, ethical AI frameworks, sovereign tech)
- **Enterprise & Startup Opportunities:** (Incubator networks, trade risk monitoring, cross-border analytics)

## Critical Risks & Strategic Uncertainties
Table format with each row on its own line:
| Strategic Risk | Probability / Impact | Key Drivers | Mitigation Strategy |
|---|---|---|---|
| ... | High/Medium | ... | ... |

## Actionable Recommendations
Numbered, executive-grade takeaways for decision-makers and technology leaders.

## Strategic Limitations & Intelligence Gaps
Clear boundary analysis of what is confirmed vs pending official summit communiqués / central bank disclosures.

## Sources & Evidence Appendix
List all verified sources as clickable Markdown links with publisher and date:
- [Publisher: Title](URL) - Date
"""
    )