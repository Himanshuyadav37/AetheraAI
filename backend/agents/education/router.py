"""
NexusAI AI - Education Router

Routes the detected learning mode
to the appropriate Education AI module.
"""

from typing import Callable

from agents.education.modes.learn import learn_mode
from agents.education.modes.exam import exam_mode
from agents.education.modes.quiz import quiz_mode
from agents.education.modes.coding import coding_mode
from agents.education.modes.interview import interview_mode
from agents.education.modes.roadmap import roadmap_mode
from agents.education.modes.revision import revision_mode
from agents.education.modes.notes import notes_mode


ROUTES: dict[str, Callable[[str], str]] = {

    "learn": learn_mode,

    "exam": exam_mode,

    "quiz": quiz_mode,

    "coding": coding_mode,

    "interview": interview_mode,

    "roadmap": roadmap_mode,

    "revision": revision_mode,

    "notes": notes_mode,

}


def route_mode(
    mode: str,
    prompt: str,
) -> str:
    """
    Route the request to the
    appropriate Education AI mode.
    """

    try:

        handler = ROUTES.get(
            mode,
            learn_mode,
        )

        return handler(
            prompt
        )

    except Exception as e:

        print(
            f"[Router Error] Mode={mode} Error={e}"
        )

        return f"""
# ❌ Routing Error

Unable to process your request.

### Detected Mode

**{mode}**

### Error

```
{str(e)}
```

Please try again.
"""