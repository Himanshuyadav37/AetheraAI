# backend/services/automation/__init__.py
"""
Aethera Automation AI — Real Execution Engine

This package contains production-grade integration adapters and the
execution engine for Aethera's Automation AI.

Sub-modules
-----------
github_adapter      HMAC webhook verification + GitHub REST API calls
slack_adapter       Real Slack Web API calls with response verification
llm_analyzer        LLM-powered issue analysis with structured output
execution_engine    Full pipeline: idempotency → steps → persistence
"""
