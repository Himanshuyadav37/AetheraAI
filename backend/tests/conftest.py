import sys
import os
import pytest
from fastapi.testclient import TestClient

# Add backend directory to sys.path so we can import modules correctly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

@pytest.fixture(scope="module")
def test_client():
    """
    FastAPI TestClient fixture.
    """
    with TestClient(app) as client:
        yield client
