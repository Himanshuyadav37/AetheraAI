import re
import urllib.parse
from datetime import datetime
from html import unescape
import xml.etree.ElementTree as ET
import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def search_google_news(query: str, max_results: int = 6) -> list[dict]:
    """Fetch live breaking news, headlines, dates, and sources from Google News RSS."""
    results = []
    try:
        encoded_query = urllib.parse.quote_plus(query)
        url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-US&gl=US&ceid=US:en"
        response = requests.get(url, headers=HEADERS, timeout=8)
        if response.status_code == 200:
            root = ET.fromstring(response.text)
            items = root.findall(".//item")
            for item in items[:max_results]:
                title = item.find("title").text if item.find("title") is not None else ""
                link = item.find("link").text if item.find("link") is not None else ""
                pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""
                source_elem = item.find("source")
                source_name = source_elem.text if source_elem is not None else "News Source"
                
                # Extract clean title and publisher
                clean_title = title
                if " - " in title:
                    parts = title.rsplit(" - ", 1)
                    clean_title = parts[0]
                    if not source_name or source_name == "News Source":
                        source_name = parts[1]

                results.append({
                    "title": clean_title.strip(),
                    "source": source_name.strip(),
                    "url": link.strip(),
                    "snippet": f"Live coverage from {source_name} ({pub_date}): {clean_title}",
                    "published": pub_date,
                    "type": "news",
                })
    except Exception as e:
        print(f"[Search] Google News RSS error: {e}")
    return results


def search_duckduckgo_html(query: str, max_results: int = 6) -> list[dict]:
    """Scrape DuckDuckGo HTML search for real web search results and snippets."""
    results = []
    try:
        url = "https://html.duckduckgo.com/html/"
        response = requests.post(url, data={"q": query}, headers=HEADERS, timeout=8)
        if response.status_code == 200:
            html = response.text
            # Find result blocks
            blocks = re.findall(
                r'<div class="result__body">.*?<a class="result__url" href="([^"]+)".*?<a class="result__snippet[^>]*>(.*?)</a>',
                html,
                re.DOTALL,
            )
            if not blocks:
                # Fallback pattern
                snippets = re.findall(r'<a class="result__snippet[^"]*" href="([^"]+)"[^>]*>(.*?)</a>', html, re.DOTALL)
                titles = re.findall(r'<a class="result__a" href="([^"]+)"[^>]*>(.*?)</a>', html, re.DOTALL)
                for i in range(min(len(snippets), len(titles), max_results)):
                    raw_url, snippet_html = snippets[i]
                    _, title_html = titles[i]
                    
                    actual_url = raw_url
                    if "uddg=" in raw_url:
                        m = re.search(r"uddg=([^&]+)", raw_url)
                        if m:
                            actual_url = urllib.parse.unquote(m.group(1))

                    clean_title = unescape(re.sub(r"<[^>]+>", "", title_html)).strip()
                    clean_snip = unescape(re.sub(r"<[^>]+>", "", snippet_html)).strip()

                    # Infer domain name
                    domain = urllib.parse.urlparse(actual_url).netloc.replace("www.", "")
                    results.append({
                        "title": clean_title or f"Result from {domain}",
                        "source": domain or "Web Source",
                        "url": actual_url,
                        "snippet": clean_snip,
                        "type": "web",
                    })
            else:
                for raw_url, snippet_html in blocks[:max_results]:
                    actual_url = raw_url
                    if "uddg=" in raw_url:
                        m = re.search(r"uddg=([^&]+)", raw_url)
                        if m:
                            actual_url = urllib.parse.unquote(m.group(1))

                    clean_snip = unescape(re.sub(r"<[^>]+>", "", snippet_html)).strip()
                    domain = urllib.parse.urlparse(actual_url).netloc.replace("www.", "")
                    
                    results.append({
                        "title": f"Intelligence report: {domain}",
                        "source": domain,
                        "url": actual_url,
                        "snippet": clean_snip,
                        "type": "web",
                    })
    except Exception as e:
        print(f"[Search] DuckDuckGo HTML error: {e}")
    return results


def search_wikipedia_summary(query: str) -> list[dict]:
    """Query Wikipedia API for factual entity definitions and structural baselines."""
    results = []
    try:
        clean_q = re.sub(r"(latest|today|summit|update|news|2026|analysis)", "", query, flags=re.IGNORECASE).strip()
        if not clean_q:
            clean_q = query
        url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(clean_q)}&format=json&utf8=1&srlimit=2"
        resp = requests.get(url, headers=HEADERS, timeout=6)
        if resp.status_code == 200:
            data = resp.json()
            search_items = data.get("query", {}).get("search", [])
            for item in search_items:
                title = item.get("title", "")
                snippet = unescape(re.sub(r"<[^>]+>", "", item.get("snippet", "")))
                page_url = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}"
                results.append({
                    "title": f"Wikipedia: {title}",
                    "source": "Wikipedia",
                    "url": page_url,
                    "snippet": f"Encyclopedia record: {snippet}",
                    "type": "reference",
                })
    except Exception as e:
        print(f"[Search] Wikipedia error: {e}")
    return results


def live_multi_search(query: str, depth: str = "normal") -> list[dict]:
    """Aggregate multi-source web intelligence, deduplicate, and return structured sources."""
    all_results = []
    seen_urls = set()

    # 1. Search Google News for latest breaking facts, live updates, and official statements
    news_res = search_google_news(query, max_results=8)
    for r in news_res:
        if r["url"] and r["url"] not in seen_urls:
            seen_urls.add(r["url"])
            all_results.append(r)

    # 2. Search specific sub-queries for deep context
    sub_queries = [
        f"{query} latest news outcome",
        f"{query} official declaration details",
    ]
    if depth == "deep":
        sub_queries.extend([
            f"{query} key agreements facts",
            f"{query} analysis risks",
        ])

    for sq in sub_queries:
        more_news = search_google_news(sq, max_results=4)
        for r in more_news:
            if r["url"] and r["url"] not in seen_urls:
                seen_urls.add(r["url"])
                all_results.append(r)

    # 3. Search DuckDuckGo HTML for web dossiers, articles, think tanks
    ddg_res = search_duckduckgo_html(query, max_results=6)
    for r in ddg_res:
        if r["url"] and r["url"] not in seen_urls:
            seen_urls.add(r["url"])
            all_results.append(r)

    # 4. Wikipedia baseline check
    wiki_res = search_wikipedia_summary(query)
    for r in wiki_res:
        if r["url"] and r["url"] not in seen_urls:
            seen_urls.add(r["url"])
            all_results.append(r)

    return all_results
