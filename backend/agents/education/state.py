from typing import TypedDict, Optional, List


class EducationState(TypedDict):

    # -------------------------
    # User Input
    # -------------------------

    prompt: str

    # -------------------------
    # Detected Mode
    # -------------------------

    mode: str

    # -------------------------
    # Generated Response
    # -------------------------

    response: str

    # -------------------------
    # Conversation
    # -------------------------

    conversation_id: Optional[str]

    # -------------------------
    # Chat History
    # -------------------------

    history: List[str]

    # -------------------------
    # Current Topic
    # -------------------------

    topic: Optional[str]

    # -------------------------
    # Status
    # -------------------------

    success: bool

    error: Optional[str]