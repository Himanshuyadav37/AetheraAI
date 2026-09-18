"""
NexusAI - Comprehensive Intent Verification & Anti-Accidental Token Burn Module

Prevents specialized AI agents (Engineer, Research, Education, Automation)
from triggering expensive background generation/search workflows when users send
casual greetings, test messages, or vague non-actionable prompts in English, Hinglish, or Hindi.
"""

import re
from typing import Tuple, Dict, Set

# Comprehensive Multilingual & Casual Expression Phrases
CASUAL_EXPRESSIONS: Set[str] = {
    # English Greetings & Fillers
    "hello", "hi", "hey", "hii", "hy", "helo", "greetings", "good morning",
    "good afternoon", "good evening", "good night", "whats up", "what's up",
    "sup", "yo", "howdy", "hey there", "hello there", "hi ai", "hello ai",
    "hey bot", "hello bot", "hi engineer", "hello engineer", "hi research",
    "hello research", "hi tutor", "hello tutor", "hi automation",

    # Hinglish & Hindi Greetings / Conversational Fillers
    "kaise ho", "kya haal h", "kya hal hai", "kaise ho aap", "kya chal raha h",
    "kya chal raha hai", "sab badiya", "sab badiya hai", "kaun ho tum",
    "tum kaun ho", "kya kar sakte ho", "kya karte ho", "tum kya karte ho",
    "aap kaun ho", "kisne banaya", "tumhe kisne banaya", "nexusai kaun hai",
    "bhai", "bro", "hey bro", "hi brother", "kaise ho bhai", "namaste",
    "pranam", "sun", "suno", "dost", "hlo", "hlw", "kuch btao", "btao",
    "batao", "kya haal chaal", "kaise ho dosto", "radhe radhe", "jai shree ram",

    # Identity, Capability & Conversational Questions
    "who are you", "what is your name", "who made you", "who created you",
    "who built you", "what can you do", "what are your capabilities",
    "how do you work", "tell me about yourself", "introduce yourself",
    "help", "help me", "can you help me", "i need help", "please help",
    "test", "testing", "test 123", "123", "1234", "demo", "check",
    "testing prompt", "sample", "asdf", "qwerty", "test message", "ping", "pong",

    # Acknowledgments & Farewells
    "ok", "okay", "fine", "cool", "great", "awesome", "nice", "thanks",
    "thank you", "thx", "shukriya", "dhanyawad", "bye", "goodbye", "see ya",
    "cya", "ttyl"
}

# Domain-Specific Action Keywords Required for Valid Generation
ACTION_KEYWORDS: Dict[str, Set[str]] = {
    "engineer": {
        "build", "create", "make", "generate", "code", "app", "website", "application",
        "script", "fastapi", "react", "html", "css", "js", "ts", "typescript", "javascript",
        "python", "backend", "frontend", "fullstack", "full-stack", "database", "sql",
        "nosql", "mongodb", "postgres", "postgresql", "sqlite", "api", "rest", "graphql",
        "endpoint", "component", "function", "class", "module", "fix", "debug", "refactor",
        "docker", "deploy", "setup", "node", "express", "django", "flask", "nextjs", "vue",
        "angular", "tailwind", "bootstrap", "bug", "error", "exception", "program",
        "system", "feature", "ui", "ux", "landing", "page", "bot", "tool", "parser",
        "compiler", "cli", "sdk", "microservice", "auth", "login", "jwt", "oauth",
        "dashboard", "widget", "theme", "animation", "form", "chart", "state", "redux",
        "zustand", "hook", "middleware", "route", "crud", "model", "schema"
    },
    "research": {
        "research", "analyze", "analysis", "investigate", "explore", "compare", "vs",
        "versus", "overview", "deep dive", "report", "market", "technology", "paper",
        "architecture", "performance", "benchmark", "trends", "find", "search", "study",
        "evaluation", "landscape", "competitor", "pros", "cons", "case study", "state of",
        "forecast", "projection", "breakdown", "statistics", "insights", "literature",
        "survey", "tradeoffs", "tradeoff", "advantages", "disadvantages", "feasibility",
        "impact", "roadmap", "review", "discovery"
    },
    "education": {
        "learn", "teach", "explain", "lesson", "course", "tutorial", "concept", "example",
        "exercise", "quiz", "understand", "how does", "what is", "difference between",
        "architecture", "algorithm", "guide", "syllabus", "topic", "dbms", "sql",
        "data structure", "dsa", "oop", "practice", "notes", "summary", "definition",
        "basics", "fundamentals", "mastery", "roadmap", "interview", "questions", "problem",
        "solution", "pseudocode", "recursion", "sorting", "trees", "graphs", "heap",
        "stack", "queue", "pointers", "memory", "concurrency"
    },
    "automation": {
        "automate", "automation", "workflow", "n8n", "slack", "github", "webhook", "trigger",
        "integration", "sheets", "email", "sync", "cron", "schedule", "connect", "pipeline",
        "flow", "action", "node", "zapier", "make", "send", "notify", "fetch", "post",
        "http", "payload", "event", "alert", "bot", "task", "job", "schedule", "interval",
        "database sync", "airtable", "notion", "stripe", "discord", "telegram", "rss"
    }
}

MULTI_LANG_RESPONSES = {
    "english": {
        "engineer": (
            "Hello! I am your **Aethera Senior Autonomous Software Engineer**.\n\n"
            "Please describe the project, website, API, or script you would like me to build! "
            "\n*For example: 'Build a full-stack React and FastAPI todo application with dark mode.'*"
        ),
        "research": (
            "Hello! I am the **Aethera Autonomous Research Agent**.\n\n"
            "What technology, company, market trend, or technical paper would you like me to research today? "
            "\n*For example: 'Conduct a deep technical comparison of WebAssembly vs eBPF.'*"
        ),
        "education": (
            "Hello! I am your **Aethera Interactive AI Tutor**.\n\n"
            "What programming language, system design concept, or technical subject would you like to master today? "
            "\n*For example: 'Explain B-Trees vs LSM-Trees in database engines with visual diagrams.'*"
        ),
        "automation": (
            "Hello! I am your **Aethera Workflow Automation Architect**.\n\n"
            "Please specify the services you want to connect and the automation flow you need! "
            "\n*For example: 'Create an n8n workflow that triggers on new GitHub issues and posts alerts to Slack.'*"
        )
    },
    "hinglish": {
        "engineer": (
            "Hello! Main aapka **Aethera Senior Autonomous Software Engineer** hoon.\n\n"
            "Aap mujhe batayein ki aapko konsa project, website, app, backend API, ya script banwana hai! "
            "\n*Jaise ki: 'Build a full-stack React and FastAPI todo app with dark mode.'*"
        ),
        "research": (
            "Hello! Main **Aethera Autonomous Research Agent** hoon.\n\n"
            "Aaj aap kis technology, company, market trend, ya research topic ke baare me deep analysis karwana chahte hain? "
            "\n*Jaise ki: 'Conduct a deep technical comparison of WebAssembly vs eBPF.'*"
        ),
        "education": (
            "Hello! Main aapka **Aethera Interactive AI Tutor** hoon.\n\n"
            "Aaj aap konsa programming topic, DBMS concept, ya system design seekhna chahte hain? "
            "\n*Jaise ki: 'Explain B-Trees vs LSM-Trees in database engines.'*"
        ),
        "automation": (
            "Hello! Main aapka **Aethera Workflow Automation Architect** hoon.\n\n"
            "Aap kin tools/services ko connect karke automation workflow banana chahte hain? "
            "\n*Jaise ki: 'Create an n8n workflow that triggers on GitHub issues and posts alerts to Slack.'*"
        )
    },
    "hindi": {
        "engineer": (
            "नमस्ते! मैं आपका **Aethera Senior Autonomous Software Engineer** हूँ।\n\n"
            "कृपया मुझे बताएं कि आप कौन सा प्रोजेक्ट, वेबसाइट, ऐप, या स्क्रिप्ट बनवाना चाहते हैं! "
            "\n*उदाहरण: 'Build a full-stack React and FastAPI todo application with dark mode.'*"
        ),
        "research": (
            "नमस्ते! मैं **Aethera Autonomous Research Agent** हूँ।\n\n"
            "आज आप किस तकनीक, कंपनी, या मार्केट ट्रेंड पर विस्तृत रिसर्च करवाना चाहते हैं?"
        ),
        "education": (
            "नमस्ते! मैं आपका **Aethera Interactive AI Tutor** हूँ।\n\n"
            "आज आप कौन सा प्रोग्रामिंग विषय या सिस्टम डिजाइन अवधारणा सीखना चाहते हैं?"
        ),
        "automation": (
            "नमस्ते! मैं आपका **Aethera Workflow Automation Architect** हूँ।\n\n"
            "कृपया उन सेवाओं को निर्दिष्ट करें जिन्हें आप ऑटोमेशन वर्कफ़्लो से कनेक्ट करना चाहते हैं!"
        )
    }
}


def detect_language(prompt: str) -> str:
    """
    Detects whether the prompt is written in English, Hinglish (Roman Hindi), or Devanagari Hindi,
    or contains explicit user instructions like 'explain in Hinglish'.
    """
    clean_p = prompt.strip().lower()

    # 1. Check explicit user language override
    if any(phrase in clean_p for phrase in ["in hinglish", "hinglish me", "hinglish mein", "hinglish mai", "speak in hinglish", "reply in hinglish", "explain in hinglish"]):
        return "hinglish"
    if any(phrase in clean_p for phrase in ["in hindi", "hindi me", "hindi mein", "hindi mai", "speak in hindi", "reply in hindi", "explain in hindi"]):
        return "hindi"
    if any(phrase in clean_p for phrase in ["in english", "english me", "english mein", "speak in english", "reply in english"]):
        return "english"

    # 2. Devanagari script Unicode check
    if re.search(r'[\u0900-\u097F]', prompt):
        return "hindi"

    # 3. Common Hinglish vocabulary check
    hinglish_markers = {
        "kaise", "kya", "bhai", "batao", "btao", "badiya", "kisne", "banaya",
        "tumhe", "tum", "ho", "hoon", "h", "hai", "hain", "kar", "sakte", "karte",
        "aap", "chala", "raha", "baare", "me", "mein", "mai", "namaste", "suno",
        "dost", "kuch", "shukriya", "dhanyawad", "rha", "karo", "do", "ye", "vaha", "kaun"
    }
    words_set = set(re.sub(r'[^\w\s]', '', clean_p).split())
    hinglish_count = sum(1 for w in words_set if w in hinglish_markers)

    if hinglish_count >= 1:
        return "hinglish"

    return "english"


def verify_prompt_intent(prompt: str, agent_type: str = "engineer") -> Tuple[bool, str]:
    """
    Evaluates whether a prompt is a casual greeting / non-actionable expression or a genuine technical/research spec.
    Dynamically returns the response in the user's matching language (English / Hinglish / Devanagari Hindi).

    Returns:
        (is_casual, friendly_guidance_message)
    """
    agent_key = agent_type.lower() if agent_type else "engineer"
    lang = detect_language(prompt or "")
    lang_responses = MULTI_LANG_RESPONSES.get(lang, MULTI_LANG_RESPONSES["english"])
    default_msg = lang_responses.get(agent_key, lang_responses["engineer"])

    if not prompt or not prompt.strip():
        return True, default_msg

    clean_p = prompt.strip().lower()
    stripped_punct = re.sub(r'[^\w\s]', '', clean_p)
    stripped_punct = re.sub(r'\s+', ' ', stripped_punct).strip()
    words = stripped_punct.split()

    domain_keywords = ACTION_KEYWORDS.get(agent_key, ACTION_KEYWORDS["engineer"])

    # 1. Exact match with any casual expression
    if stripped_punct in CASUAL_EXPRESSIONS:
        return True, default_msg

    # 2. Starts with a casual greeting or conversational query
    for casual in CASUAL_EXPRESSIONS:
        if stripped_punct.startswith(casual + " ") or stripped_punct.startswith(casual + ","):
            has_action = any(kw in clean_p for kw in domain_keywords)
            if not has_action or len(words) <= 6:
                return True, default_msg

    # 3. Short prompt check (< 35 chars or <= 4 words) without any domain action keywords
    if len(clean_p) < 35 or len(words) <= 4:
        has_action = any(kw in clean_p for kw in domain_keywords)
        if not has_action:
            return True, default_msg

    # 4. Check if prompt consists ONLY of casual words or stop fillers
    non_casual_words = [w for w in words if w not in CASUAL_EXPRESSIONS and w not in {"is", "the", "a", "an", "this", "that", "it", "my", "your", "can", "please"}]
    if len(non_casual_words) == 0:
        return True, default_msg

    return False, ""
