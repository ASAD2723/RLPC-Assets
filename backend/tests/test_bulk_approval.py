"""Tests for bulk approval endpoint: PATCH /api/purchases/approval/bulk."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"username": "158", "password": "Rlpc_974"}, timeout=10)
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _payload(emp_id, approved=False):
    return {
        "employee_id": emp_id,
        "employee_name": "TEST_BulkUser",
        "purchase_type": "Mobile Purchase",
        "payment_mode": "Cash",
        "payment_by": "Jogy Joseph",
        "business_manager_approved": approved,
    }


@pytest.fixture
def seeded_ids():
    ids = []
    for i in range(3):
        r = requests.post(f"{API}/purchases", json=_payload(f"TEST_BLK{i}"), timeout=10)
        assert r.status_code == 201
        ids.append(r.json()["id"])
    yield ids
    for pid in ids:
        try:
            requests.delete(f"{API}/purchases/{pid}", timeout=10)
        except Exception:
            pass


class TestBulkApproval:
    def test_bulk_without_token_403(self, seeded_ids):
        r = requests.patch(
            f"{API}/purchases/approval/bulk",
            json={"ids": seeded_ids, "approved": True},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        assert r.status_code == 403

    def test_bulk_with_token_updates(self, seeded_ids, auth_headers):
        r = requests.patch(
            f"{API}/purchases/approval/bulk",
            json={"ids": seeded_ids, "approved": True},
            headers=auth_headers, timeout=10,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["updated"] == 3
        # verify persistence
        lr = requests.get(f"{API}/purchases", params={"search": "TEST_BLK"}, timeout=10)
        items = lr.json()["items"]
        rec_by_id = {x["id"]: x for x in items}
        for pid in seeded_ids:
            assert rec_by_id[pid]["business_manager_approved"] is True

    def test_bulk_empty_ids_returns_zero(self, auth_headers):
        r = requests.patch(
            f"{API}/purchases/approval/bulk",
            json={"ids": [], "approved": True},
            headers=auth_headers, timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["updated"] == 0

    def test_bulk_mixed_valid_and_invalid(self, seeded_ids, auth_headers):
        # only 2 of 3 valid ids + 2 fake ids
        ids = seeded_ids[:2] + ["nonexistent-1", "nonexistent-2"]
        r = requests.patch(
            f"{API}/purchases/approval/bulk",
            json={"ids": ids, "approved": True},
            headers=auth_headers, timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["updated"] == 2

    def test_bulk_unapprove(self, seeded_ids, auth_headers):
        # First approve all
        requests.patch(
            f"{API}/purchases/approval/bulk",
            json={"ids": seeded_ids, "approved": True},
            headers=auth_headers, timeout=10,
        )
        # Now unapprove
        r = requests.patch(
            f"{API}/purchases/approval/bulk",
            json={"ids": seeded_ids, "approved": False},
            headers=auth_headers, timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["updated"] == 3
        lr = requests.get(f"{API}/purchases", params={"search": "TEST_BLK", "approved": "false"}, timeout=10)
        matched = [x for x in lr.json()["items"] if x["id"] in seeded_ids]
        assert len(matched) == 3

    def test_single_approval_still_works_without_token_403(self, seeded_ids):
        r = requests.patch(
            f"{API}/purchases/{seeded_ids[0]}/approval",
            json={"approved": True},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        assert r.status_code == 403

    def test_single_approval_with_token_200(self, seeded_ids, auth_headers):
        r = requests.patch(
            f"{API}/purchases/{seeded_ids[0]}/approval",
            json={"approved": True},
            headers=auth_headers, timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["business_manager_approved"] is True
