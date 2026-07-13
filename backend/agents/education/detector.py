"""
NexusAI AI - Education Mode Detector

Detects the most suitable learning mode
based on the user's intent.
"""

import re


MODE_KEYWORDS = {

    "exam": [

        "exam",
        "marks",
        "2 mark",
        "5 mark",
        "7 mark",
        "10 mark",
        "15 mark",
        "university",
        "semester",
        "important question",
        "long answer",
        "short answer",
        "write an answer",
        "exam preparation",

    ],

    "quiz": [

        "quiz",
        "mcq",
        "multiple choice",
        "true false",
        "fill in the blanks",
        "test me",
        "practice test",

    ],

    "coding": [

        "code",
        "coding",
        "program",
        "programming",
        "implement",
        "algorithm",
        "debug",
        "bug",
        "optimize",
        "solution",
        "python",
        "java",
        "c++",
        "c language",
        "javascript",
        "typescript",
        "go",
        "rust",

    ],

    "interview": [

        "interview",
        "technical interview",
        "hr interview",
        "mock interview",
        "viva",
        "interview questions",

    ],

    "roadmap": [

        "roadmap",
        "learning path",
        "study plan",
        "career path",
        "become",
        "how to learn",
        "complete roadmap",

    ],

    "revision": [

        "revision",
        "revise",
        "last minute",
        "quick revision",
        "revision notes",

    ],

    "notes": [

        "notes",
        "study notes",
        "cheat sheet",
        "summary",
        "short notes",

    ],

    "learn": [

        "learn",
        "teach",
        "explain",
        "understand",
        "what is",
        "why",
        "how",
        "guide",

    ],

}


def detect_mode(prompt: str) -> str:
    """
    Detect the most appropriate
    Education AI mode.

    Returns

    learn
    exam
    quiz
    coding
    interview
    roadmap
    revision
    notes
    """

    if not prompt:
        return "learn"

    text = prompt.lower().strip()

    scores = {}

    for mode, keywords in MODE_KEYWORDS.items():

        score = 0

        for keyword in keywords:

            if keyword in text:

                score += 1

        scores[mode] = score

    # --------------------------
    # Priority Rules
    # --------------------------

    priority = [

        "exam",
        "quiz",
        "interview",
        "roadmap",
        "revision",
        "notes",
        "coding",
        "learn",

    ]

    highest_score = max(
        scores.values()
    )

    if highest_score == 0:
        return "learn"

    for mode in priority:

        if scores[mode] == highest_score:
            return mode

    return "learn"