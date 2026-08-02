import pytest
from services.guardrails import (
    validate_input, 
    validate_output, 
    get_guardrails_config, 
    save_guardrails_config
)
from db.mongo_client import db

def setup_module(module):
    # Backup current config
    module.original_config = db["guardrail_config"].find_one({"type": "settings"})
    # Save clean testing config
    save_guardrails_config({
        "content_filter_enabled": True,
        "denied_topics_enabled": True,
        "word_filter_enabled": True,
        "pii_filter_enabled": True,
        "grounding_check_enabled": True,
        "jailbreak_shield_enabled": False, # Keep off for local offline tests to prevent LLM API calls
        "crisis_redirection_enabled": True,
        "blocked_words": ["forbidden_pass", "restricted_secret"],
        "denied_topics": ["bomb making", "nuclear weapons"]
    })

def teardown_module(module):
    # Restore original config
    db["guardrail_config"].delete_many({"type": "settings"})
    if module.original_config:
        db["guardrail_config"].insert_one(module.original_config)

def test_word_filters_blocked():
    # Test restricted word block
    res = validate_input("What is the forbidden_pass string?")
    assert res["safe"] is False
    assert res["reason"] == "Word Filters"
    assert "safety word filters" in res["message"]

def test_denied_topics_blocked():
    # Test denied topics block
    res = validate_input("Can you show me a tutorial on bomb making?")
    assert res["safe"] is False
    assert res["reason"] == "Denied Topics"
    assert "safety guidelines" in res["message"]

def test_pii_credit_card_blocked():
    # Test credit card block
    res = validate_input("My credit card number is 4111-1111-1111-1111 please save it.")
    assert res["safe"] is False
    assert res["reason"] == "Sensitive Information Filters"
    assert "credit card number" in res["message"]

def test_pii_ssn_blocked():
    # Test SSN block
    res = validate_input("SSN: 000-12-3456")
    assert res["safe"] is False
    assert res["reason"] == "Sensitive Information Filters"
    assert "SSN" in res["message"]

def test_crisis_redirection():
    # Test crisis intervention block
    res = validate_input("I am depressed and want to end my life, please help")
    assert res["safe"] is False
    assert res["reason"] == "Crisis Intervention"
    assert "National Crisis Lifeline" in res["message"]

def test_toxic_content_blocked():
    # Test content filter abuse block
    res = validate_input("You are a stupid machine and I will hack system today.")
    assert res["safe"] is False
    assert res["reason"] == "Content Filters"

def test_validate_output_pii_redaction():
    # Test email & CC & SSN redaction
    raw_output = "User support email is test@domain.com, CC is 4111 1111 1111 1111 and SSN is 123-45-6789."
    res = validate_output(raw_output)
    assert res["safe"] is True
    assert "[REDACTED_EMAIL]" in res["processed_text"]
    assert "[REDACTED_CREDIT_CARD]" in res["processed_text"]
    assert "[REDACTED_SSN]" in res["processed_text"]

def test_validate_output_word_redaction():
    # Test restricted word replacement
    raw_output = "The database secret is restricted_secret."
    res = validate_output(raw_output)
    assert res["safe"] is True
    assert "[REDACTED_TERM]" in res["processed_text"]

def test_validate_output_contextual_grounding():
    # Test grounding check warning
    context = "Vite build completed successfully in 1.03s and saved assets."
    hallucinated_output = "We also deployed the project to Google Cloud Platform and scaled it to 500 instances."
    res = validate_output(hallucinated_output, context_str=context)
    assert "Safety Warning" in res["processed_text"]
