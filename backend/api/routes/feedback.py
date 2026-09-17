import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, EmailStr
from db.mongo_client import feedbacks_collection

logger = logging.getLogger("nexusai.feedback")
router = APIRouter(prefix="/feedback", tags=["Feedback"])


class FeedbackSubmission(BaseModel):
    name: str = "Anonymous"
    email: EmailStr
    rating: Optional[str] = None
    primary_feature: Optional[str] = None
    suggestions: str
    feature_requests: Optional[str] = None
    encountered_bugs: Optional[str] = None
    bug_details: Optional[str] = None
    nps_score: Optional[int] = None
    source: Optional[str] = "n8n_workflow"


@router.post("")
def submit_feedback(payload: FeedbackSubmission):
    """
    Receives feedback from the n8n feedback form or in-app submission,
    stores it in MongoDB, and logs for analytics.
    """
    try:
        feedback_doc = {
            "name": payload.name.strip(),
            "email": payload.email.lower().strip(),
            "rating": payload.rating,
            "primary_feature": payload.primary_feature,
            "suggestions": payload.suggestions.strip(),
            "feature_requests": payload.feature_requests.strip() if payload.feature_requests else None,
            "encountered_bugs": payload.encountered_bugs,
            "bug_details": payload.bug_details.strip() if payload.bug_details else None,
            "nps_score": payload.nps_score,
            "source": payload.source,
            "created_at": datetime.utcnow()
        }
        res = feedbacks_collection.insert_one(feedback_doc)
        logger.info(f"Feedback successfully recorded for {payload.email} (ID: {res.inserted_id})")
        return {
            "status": "success",
            "message": "Thank you! Your feedback has been recorded.",
            "feedback_id": str(res.inserted_id)
        }
    except Exception as e:
        logger.error(f"Error saving feedback: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save feedback")


@router.get("")
def list_feedbacks(limit: int = Query(50, le=200)):
    """Retrieve recent feedbacks for admin inspection."""
    try:
        cursor = feedbacks_collection.find({}).sort("created_at", -1)
        feedbacks = []
        count = 0
        for doc in cursor:
            feedbacks.append({
                "id": str(doc.get("_id", "")),
                "name": doc.get("name"),
                "email": doc.get("email"),
                "rating": doc.get("rating"),
                "primary_feature": doc.get("primary_feature"),
                "suggestions": doc.get("suggestions"),
                "feature_requests": doc.get("feature_requests"),
                "encountered_bugs": doc.get("encountered_bugs"),
                "bug_details": doc.get("bug_details"),
                "nps_score": doc.get("nps_score"),
                "source": doc.get("source"),
                "created_at": doc.get("created_at").isoformat() if isinstance(doc.get("created_at"), datetime) else str(doc.get("created_at"))
            })
            count += 1
            if count >= limit:
                break
        return {"status": "success", "count": len(feedbacks), "feedbacks": feedbacks}
    except Exception as e:
        logger.error(f"Error fetching feedbacks: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch feedbacks")
