"""
Unit and Integration Tests for Smart Semantic LLM Router & Departmental Cost Vault
"""

import pytest
from services.llm_router import (
    classify_query_complexity,
    select_optimal_model,
    estimate_token_count,
    calculate_token_cost,
    calculate_developer_time_saved,
    check_department_budget,
    record_llm_usage,
    get_cost_vault_analytics,
    MODEL_PRICING
)

def test_semantic_complexity_classifier_fast():
    # Casual greeting
    tier, score, reason = classify_query_complexity("Hi, my name is Alex", "conversational")
    assert tier == "fast"
    assert score < 0.5

    # Simple factual question
    tier, score, reason = classify_query_complexity("What is the capital of France?", "conversational")
    assert tier == "fast"
    assert score < 0.6


def test_semantic_complexity_classifier_frontier():
    # Complex project engineering
    tier, score, reason = classify_query_complexity("Build a full-stack microservices app with Docker and PostgreSQL", "engineer")
    assert tier == "frontier"
    assert score >= 0.75

    # Complex architecture keywords
    tier, score, reason = classify_query_complexity("How to avoid deadlocks in distributed transactions with microservice architecture and concurrency?", "conversational")
    assert tier == "frontier"
    assert score >= 0.7


def test_model_selection():
    fast_model = select_optimal_model("fast")
    assert "gpt-oss" in fast_model or "llama" in fast_model

    frontier_model = select_optimal_model("frontier")
    assert "gemini" in frontier_model or "claude" in frontier_model

    vision_model = select_optimal_model("fast", has_image=True)
    assert "qwen" in vision_model


def test_token_cost_and_savings_calculation():
    prompt_tokens = 1000
    completion_tokens = 500
    
    # Fast model: Groq GPT-OSS 120B
    cost_info = calculate_token_cost("openai/gpt-oss-120b", prompt_tokens, completion_tokens)
    assert cost_info["actual_cost_usd"] > 0.0
    assert cost_info["baseline_cost_usd"] > cost_info["actual_cost_usd"]
    assert cost_info["net_savings_usd"] > 0.0
    assert cost_info["savings_percentage"] > 80.0  # Over 80% cheaper than legacy GPT-4 baseline


def test_developer_hours_saved():
    # Simple chat
    short_hours = calculate_developer_time_saved("conversational", "Here is a brief answer.")
    assert short_hours <= 0.5

    # Multi-file engineering code
    long_code = "\n".join([f"line {i}" for i in range(250)])
    eng_hours = calculate_developer_time_saved("engineer", long_code, iterations=2)
    assert eng_hours >= 2.0


def test_department_budget_checker():
    # Mock collection
    class MockCollection:
        def find_one(self, query):
            if query.get("department") == "Engineering":
                return {
                    "department": "Engineering",
                    "monthly_budget_usd": 1000.0,
                    "current_spend_usd": 150.0,
                    "hard_cap": True,
                    "alert_threshold": 80.0
                }
            elif query.get("department") == "Marketing":
                return {
                    "department": "Marketing",
                    "monthly_budget_usd": 100.0,
                    "current_spend_usd": 105.0,
                    "hard_cap": True,
                    "alert_threshold": 80.0
                }
            return None

    mock_db_col = MockCollection()

    # Engineering: Under budget -> Safe
    eng_status = check_department_budget("Engineering", mock_db_col)
    assert eng_status["allowed"] is True
    assert eng_status["status"] == "safe"

    # Marketing: Over budget with hard cap -> Capped
    mkt_status = check_department_budget("Marketing", mock_db_col)
    assert mkt_status["allowed"] is False
    assert mkt_status["status"] == "capped"


def test_cost_vault_analytics_fallback():
    analytics = get_cost_vault_analytics(None)
    assert "summary" in analytics
    assert analytics["summary"]["total_enterprise_value_usd"] > 0
    assert "tier_distribution" in analytics
    assert "department_spend" in analytics
