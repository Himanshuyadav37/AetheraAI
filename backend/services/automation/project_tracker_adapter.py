"""Project tracker adapter for verified automation task creation."""

import logging
import time
from typing import Any, Dict

import httpx

from config import settings
from core.ssrf_protection import validate_url

logger = logging.getLogger("aethera.automation.project_tracker")
LINEAR_URL = "https://api.linear.app/graphql"
validate_url(LINEAR_URL, require_https=True, use_allowlist=True)


def _linear_request(query: str, variables: Dict[str, Any]) -> Dict[str, Any]:
    token = settings.LINEAR_API_KEY
    if not token:
        raise RuntimeError("LINEAR_API_KEY is not configured")

    last_error = None
    for attempt in range(1, settings.AUTOMATION_MAX_RETRIES + 1):
        try:
            response = httpx.post(
                LINEAR_URL,
                json={"query": query, "variables": variables},
                headers={"Authorization": token, "Content-Type": "application/json"},
                timeout=settings.AUTOMATION_HTTP_TIMEOUT,
            )
            if response.status_code in {400, 401, 403, 404, 422}:
                raise RuntimeError(f"Project tracker rejected request ({response.status_code})")
            if response.status_code >= 500 or response.status_code == 429:
                last_error = RuntimeError(f"Project tracker temporary error ({response.status_code})")
                if attempt < settings.AUTOMATION_MAX_RETRIES:
                    time.sleep(2 ** (attempt - 1))
                    continue
                raise last_error
            response.raise_for_status()
            data = response.json()
            if data.get("errors"):
                raise RuntimeError("Project tracker returned a GraphQL error")
            return data
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            last_error = RuntimeError("Project tracker network failure")
            if attempt < settings.AUTOMATION_MAX_RETRIES:
                time.sleep(2 ** (attempt - 1))
                continue
            raise last_error from exc
    raise last_error or RuntimeError("Project tracker request failed")


def create_project_task(
    *,
    title: str,
    description: str,
    severity: str,
    test_mode: bool = False,
    team_id: str = "",
    project_id: str = "",
) -> Dict[str, Any]:
    """Create a Linear issue and require a returned issue ID as proof of success."""
    team_id = team_id or (settings.AUTOMATION_TEST_LINEAR_TEAM_ID if test_mode else settings.LINEAR_TEAM_ID)
    if not team_id:
        raise RuntimeError("A project tracker team is not configured")

    project_id = "" if test_mode else (project_id or settings.LINEAR_PROJECT_ID)
    mutation = """
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier url }
      }
    }
    """
    issue_input: Dict[str, Any] = {
        "teamId": team_id,
        "title": title[:200],
        "description": description[:10000],
    }
    if project_id:
        issue_input["projectId"] = project_id

    data = _linear_request(mutation, {"input": issue_input})
    result = data.get("data", {}).get("issueCreate", {})
    issue = result.get("issue") or {}
    if not result.get("success") or not issue.get("id"):
        raise RuntimeError("Project tracker did not confirm task creation")
    return {"id": issue["id"], "identifier": issue.get("identifier"), "url": issue.get("url")}