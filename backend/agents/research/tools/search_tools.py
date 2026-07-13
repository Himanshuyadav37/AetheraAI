"""Research tool registry for NexusAI Research AI.

These tools produce direct, clickable investigation URLs. They are intentionally
side-effect free so the UI can show the user exactly which external research
surface to open for verification.
"""

from urllib.parse import quote_plus


def _tool(name: str, category: str, description: str, url: str, query: str):
    return {
        "name": name,
        "title": name,
        "type": category,
        "category": category,
        "description": description,
        "url": url,
        "query": query,
        "status": "ready",
        "action_label": "Open Tool",
    }


def build_research_tools(prompt: str):
    query = quote_plus(prompt)
    docs_query = quote_plus(f"{prompt} official documentation")
    fact_query = quote_plus(f"{prompt} facts evidence sources")
    dataset_query = quote_plus(f"{prompt} dataset")
    patent_query = quote_plus(prompt)
    company_query = quote_plus(f"{prompt} company market competitors")

    return [
        _tool(
            "Official Docs Tool",
            "documentation",
            "Find official documentation, API references, standards, and product pages.",
            f"https://www.google.com/search?q={docs_query}",
            prompt,
        ),
        _tool(
            "Academic Paper Tool",
            "academic",
            "Search Google Scholar for papers, citations, and literature reviews.",
            f"https://scholar.google.com/scholar?q={query}",
            prompt,
        ),
        _tool(
            "Semantic Scholar Tool",
            "academic",
            "Inspect paper abstracts, authors, related work, and citation trails.",
            f"https://www.semanticscholar.org/search?q={query}",
            prompt,
        ),
        _tool(
            "arXiv Tool",
            "papers",
            "Check recent technical and AI preprints.",
            f"https://arxiv.org/search/?query={query}&searchtype=all",
            prompt,
        ),
        _tool(
            "GitHub Tool",
            "code",
            "Find open-source implementations, examples, libraries, and adoption signals.",
            f"https://github.com/search?q={query}&type=repositories",
            prompt,
        ),
        _tool(
            "Stack Overflow Tool",
            "developer",
            "Check practical implementation issues and developer discussion.",
            f"https://stackoverflow.com/search?q={query}",
            prompt,
        ),
        _tool(
            "News Tool",
            "news",
            "Check latest market movement, launches, announcements, and trend signals.",
            f"https://www.google.com/search?q={query}&tbm=nws",
            prompt,
        ),
        _tool(
            "Reddit Tool",
            "community",
            "Read community opinions, practical pain points, and user discussions.",
            f"https://www.reddit.com/search/?q={query}",
            prompt,
        ),
        _tool(
            "YouTube Tool",
            "video",
            "Find demos, talks, reviews, tutorials, and product walkthroughs.",
            f"https://www.youtube.com/results?search_query={query}",
            prompt,
        ),
        _tool(
            "Dataset Tool",
            "data",
            "Search public datasets that can support the research.",
            f"https://datasetsearch.research.google.com/search?query={dataset_query}",
            prompt,
        ),
        _tool(
            "Company Research Tool",
            "market",
            "Research competitors, companies, positioning, and business signals.",
            f"https://www.google.com/search?q={company_query}",
            prompt,
        ),
        _tool(
            "Patent Tool",
            "patents",
            "Search patents and prior art for product or technical innovation research.",
            f"https://patents.google.com/?q={patent_query}",
            prompt,
        ),
        _tool(
            "Fact Check Tool",
            "verification",
            "Open a broad evidence search to validate claims before trusting the report.",
            f"https://www.google.com/search?q={fact_query}",
            prompt,
        ),
    ]