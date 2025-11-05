import os
import sys
from pathlib import Path
import urllib.parse
import copy

import pytest
from fastapi.testclient import TestClient

# Ensure src is importable as a module path (adds src/ to sys.path)
ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "src"
sys.path.insert(0, str(SRC_DIR))

# Import the FastAPI app and the in-memory activities store
import app as app_module  # noqa: E402

client = TestClient(app_module.app)


@pytest.fixture(autouse=True)
def restore_activities():
    """Backup and restore the in-memory activities dict around each test."""
    orig = copy.deepcopy(app_module.activities)
    yield
    app_module.activities.clear()
    app_module.activities.update(orig)


def test_get_activities_returns_dict():
    resp = client.get("/activities")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    # Basic sanity check that a known activity exists
    assert "Chess Club" in data


def test_signup_and_unregister_flow():
    activity_name = "Chess Club"
    # Use a unique test email
    test_email = "pytest-user@example.com"

    # Ensure the test email is not already present
    participants = app_module.activities[activity_name]["participants"]
    if test_email in participants:
        participants.remove(test_email)

    # Signup
    resp = client.post(f"/activities/{urllib.parse.quote(activity_name)}/signup", params={"email": test_email})
    assert resp.status_code == 200
    body = resp.json()
    assert "Signed up" in body.get("message", "")

    # Confirm participant added in in-memory store
    assert test_email in app_module.activities[activity_name]["participants"]

    # Unregister
    resp2 = client.post(f"/activities/{urllib.parse.quote(activity_name)}/unregister", params={"email": test_email})
    assert resp2.status_code == 200
    body2 = resp2.json()
    assert "Unregistered" in body2.get("message", "")

    # Confirm participant removed
    assert test_email not in app_module.activities[activity_name]["participants"]


def test_signup_existing_returns_400():
    activity_name = "Chess Club"
    # Use an existing participant from initial data
    existing = app_module.activities[activity_name]["participants"][0]

    resp = client.post(f"/activities/{urllib.parse.quote(activity_name)}/signup", params={"email": existing})
    assert resp.status_code == 400


def test_unregister_not_registered_returns_400():
    activity_name = "Chess Club"
    fake_email = "not-registered@example.com"

    # Ensure it's not registered
    if fake_email in app_module.activities[activity_name]["participants"]:
        app_module.activities[activity_name]["participants"].remove(fake_email)

    resp = client.post(f"/activities/{urllib.parse.quote(activity_name)}/unregister", params={"email": fake_email})
    assert resp.status_code == 400
