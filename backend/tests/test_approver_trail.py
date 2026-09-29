"""Tests for Business/Safety approver trail (by/at) fields."""
import os
import re
import pytest
import requests
from datetime import datetime

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

BUSINESS_USER = ("158", "Rlpc_974")
IT_ADMIN = ("IT admin", "Rlpc_974")
SAFETY_USER = ("170", "Safety_91")
SAFETY_USER2 = ("121", "Safety_974")
EDITOR = ("16", "Roc_974")

ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")


def _login(u, p):
    r = requests.post(f"{API}/auth/login", json={"username": u, "password": p})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def biz_token():
    return _login(*BUSINESS_USER)


@pytest.fixture(scope="module")
def safety_token():
    return _login(*SAFETY_USER)


@pytest.fixture(scope="module")
def editor_token():
    return _login(*EDITOR)


def _create_basic(auth_hdr=None, **overrides):
    body = {
        "employee_id": "TEST_TRAIL",
        "employee_name": "TEST Trail User",
        "purchase_type": "Tech Device",
        "payment_mode": "",
        "payment_by": "",
        "business_manager_approved": False,
        "safety_team_approved": False,
    }
    body.update(overrides)
    r = requests.post(f"{API}/purchases", json=body, headers=auth_hdr or {})
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def new_record(biz_token):
    rec = _create_basic(_hdr(biz_token))
    yield rec
    # Cleanup
    requests.delete(f"{API}/purchases/{rec['id']}", headers=_hdr(biz_token))


# --- PATCH business approval trail ---
def test_patch_business_approval_sets_trail(new_record, biz_token):
    r = requests.patch(
        f"{API}/purchases/{new_record['id']}/approval",
        json={"approved": True}, headers=_hdr(biz_token),
    )
    assert r.status_code == 200
    data = r.json()
    assert data["business_manager_approved"] is True
    assert data["business_approved_by"] == "158"
    assert ISO_RE.match(data["business_approved_at"] or "")
    # Safety trail untouched
    assert data["safety_approved_by"] is None
    assert data["safety_approved_at"] is None


def test_patch_business_unapprove_clears_trail(new_record, biz_token):
    # Approve then unapprove
    requests.patch(f"{API}/purchases/{new_record['id']}/approval",
                   json={"approved": True}, headers=_hdr(biz_token))
    r = requests.patch(f"{API}/purchases/{new_record['id']}/approval",
                       json={"approved": False}, headers=_hdr(biz_token))
    assert r.status_code == 200
    d = r.json()
    assert d["business_manager_approved"] is False
    assert d["business_approved_by"] is None
    assert d["business_approved_at"] is None


# --- PATCH safety approval trail ---
def test_patch_safety_approval_sets_trail(new_record, safety_token, biz_token):
    # First business-approve to ensure independence
    requests.patch(f"{API}/purchases/{new_record['id']}/approval",
                   json={"approved": True}, headers=_hdr(biz_token))
    r = requests.patch(
        f"{API}/purchases/{new_record['id']}/safety-approval",
        json={"approved": True}, headers=_hdr(safety_token),
    )
    assert r.status_code == 200
    d = r.json()
    assert d["safety_team_approved"] is True
    assert d["safety_approved_by"] == "170"
    assert ISO_RE.match(d["safety_approved_at"] or "")
    # Business trail must remain
    assert d["business_approved_by"] == "158"
    assert d["business_approved_at"] is not None


def test_patch_safety_unapprove_clears_trail(new_record, safety_token):
    requests.patch(f"{API}/purchases/{new_record['id']}/safety-approval",
                   json={"approved": True}, headers=_hdr(safety_token))
    r = requests.patch(f"{API}/purchases/{new_record['id']}/safety-approval",
                       json={"approved": False}, headers=_hdr(safety_token))
    assert r.status_code == 200
    d = r.json()
    assert d["safety_team_approved"] is False
    assert d["safety_approved_by"] is None
    assert d["safety_approved_at"] is None


# --- Bulk approval trail ---
def test_bulk_approval_sets_and_clears_trail(biz_token):
    ids = []
    for _ in range(3):
        r = _create_basic(_hdr(biz_token))
        ids.append(r["id"])
    try:
        r = requests.patch(f"{API}/purchases/approval/bulk",
                           json={"ids": ids, "approved": True}, headers=_hdr(biz_token))
        assert r.status_code == 200
        assert r.json()["updated"] == 3
        # Verify via GET
        for pid in ids:
            g = requests.get(f"{API}/purchases", params={"search": "TEST_TRAIL"})
            item = next(x for x in g.json()["items"] if x["id"] == pid)
            assert item["business_manager_approved"] is True
            assert item["business_approved_by"] == "158"
            assert item["business_approved_at"] is not None
        # Bulk clear
        r = requests.patch(f"{API}/purchases/approval/bulk",
                           json={"ids": ids, "approved": False}, headers=_hdr(biz_token))
        assert r.status_code == 200
        for pid in ids:
            g = requests.get(f"{API}/purchases", params={"search": "TEST_TRAIL"})
            item = next(x for x in g.json()["items"] if x["id"] == pid)
            assert item["business_manager_approved"] is False
            assert item["business_approved_by"] is None
            assert item["business_approved_at"] is None
    finally:
        for pid in ids:
            requests.delete(f"{API}/purchases/{pid}", headers=_hdr(biz_token))


# --- Create trail ---
def test_create_by_business_with_both_approvals_records_both(biz_token):
    rec = _create_basic(_hdr(biz_token),
                        business_manager_approved=True, safety_team_approved=True)
    try:
        assert rec["business_approved_by"] == "158"
        assert rec["business_approved_at"] is not None
        assert rec["safety_approved_by"] == "158"
        assert rec["safety_approved_at"] is not None
    finally:
        requests.delete(f"{API}/purchases/{rec['id']}", headers=_hdr(biz_token))


def test_create_by_safety_only_records_safety_trail(safety_token, biz_token):
    rec = _create_basic(_hdr(safety_token),
                        business_manager_approved=True, safety_team_approved=True)
    try:
        # Safety user cannot business-approve
        assert rec["business_manager_approved"] is False
        assert rec["business_approved_by"] is None
        assert rec["safety_team_approved"] is True
        assert rec["safety_approved_by"] == "170"
        assert rec["safety_approved_at"] is not None
    finally:
        requests.delete(f"{API}/purchases/{rec['id']}", headers=_hdr(biz_token))


def test_create_by_editor_no_trail(editor_token, biz_token):
    rec = _create_basic(_hdr(editor_token),
                        business_manager_approved=True, safety_team_approved=True)
    try:
        assert rec["business_manager_approved"] is False
        assert rec["safety_team_approved"] is False
        assert rec["business_approved_by"] is None
        assert rec["safety_approved_by"] is None
    finally:
        requests.delete(f"{API}/purchases/{rec['id']}", headers=_hdr(biz_token))


def test_create_anonymous_no_trail(biz_token):
    rec = _create_basic(None,
                        business_manager_approved=True, safety_team_approved=True)
    try:
        assert rec["business_manager_approved"] is False
        assert rec["safety_team_approved"] is False
        assert rec["business_approved_by"] is None
        assert rec["safety_approved_by"] is None
    finally:
        requests.delete(f"{API}/purchases/{rec['id']}", headers=_hdr(biz_token))


# --- PUT trail ---
def test_put_business_approver_flips_both_trails(new_record, biz_token):
    payload = {
        "employee_id": new_record["employee_id"],
        "employee_name": new_record["employee_name"],
        "purchase_type": new_record["purchase_type"],
        "payment_mode": "Cash",
        "payment_by": "Jogy Joseph",
        "business_manager_approved": True,
        "safety_team_approved": True,
    }
    r = requests.put(f"{API}/purchases/{new_record['id']}", json=payload, headers=_hdr(biz_token))
    assert r.status_code == 200
    d = r.json()
    assert d["business_approved_by"] == "158"
    assert d["safety_approved_by"] == "158"
    assert d["business_approved_at"] is not None
    assert d["safety_approved_at"] is not None

    # Flip off both
    payload["business_manager_approved"] = False
    payload["safety_team_approved"] = False
    r = requests.put(f"{API}/purchases/{new_record['id']}", json=payload, headers=_hdr(biz_token))
    d = r.json()
    assert d["business_approved_by"] is None
    assert d["business_approved_at"] is None
    assert d["safety_approved_by"] is None
    assert d["safety_approved_at"] is None


def test_put_safety_only_user_records_safety_trail(new_record, safety_token, biz_token):
    payload = {
        "employee_id": new_record["employee_id"],
        "employee_name": new_record["employee_name"],
        "purchase_type": new_record["purchase_type"],
        "payment_mode": "",
        "payment_by": "",
        "business_manager_approved": False,
        "safety_team_approved": True,
    }
    r = requests.put(f"{API}/purchases/{new_record['id']}", json=payload, headers=_hdr(safety_token))
    assert r.status_code == 200
    d = r.json()
    assert d["safety_team_approved"] is True
    assert d["safety_approved_by"] == "170"
    assert d["safety_approved_at"] is not None
    # Business trail untouched
    assert d["business_approved_by"] is None


def test_put_editor_never_sets_trail(biz_token, editor_token):
    # Business approves first (so trail exists)
    rec = _create_basic(_hdr(biz_token), business_manager_approved=True)
    try:
        payload = {
            "employee_id": rec["employee_id"],
            "employee_name": rec["employee_name"],
            "purchase_type": rec["purchase_type"],
            "payment_mode": "Cash",
            "payment_by": "Jogy Joseph",
            "business_manager_approved": False,  # editor tries to clear but branch ignores
            "safety_team_approved": True,
        }
        r = requests.put(f"{API}/purchases/{rec['id']}", json=payload, headers=_hdr(editor_token))
        assert r.status_code == 200
        d = r.json()
        # Editor branch only updates payment fields
        assert d["business_manager_approved"] is True
        assert d["business_approved_by"] == "158"  # unchanged
        assert d["safety_team_approved"] is False
        assert d["safety_approved_by"] is None
        assert d["payment_mode"] == "Cash"
        assert d["payment_by"] == "Jogy Joseph"
    finally:
        requests.delete(f"{API}/purchases/{rec['id']}", headers=_hdr(biz_token))


# --- GET returns trail fields ---
def test_get_list_includes_trail_fields(biz_token):
    rec = _create_basic(_hdr(biz_token), business_manager_approved=True)
    try:
        r = requests.get(f"{API}/purchases", params={"search": "TEST_TRAIL"})
        item = next(x for x in r.json()["items"] if x["id"] == rec["id"])
        assert "business_approved_by" in item
        assert "business_approved_at" in item
        assert "safety_approved_by" in item
        assert "safety_approved_at" in item
        assert item["business_approved_by"] == "158"
    finally:
        requests.delete(f"{API}/purchases/{rec['id']}", headers=_hdr(biz_token))


# --- RBAC regression ---
def test_editor_cannot_safety_approve(editor_token, biz_token):
    rec = _create_basic(_hdr(biz_token))
    try:
        r = requests.patch(f"{API}/purchases/{rec['id']}/safety-approval",
                           json={"approved": True}, headers=_hdr(editor_token))
        assert r.status_code == 403
    finally:
        requests.delete(f"{API}/purchases/{rec['id']}", headers=_hdr(biz_token))


def test_safety_user_cannot_business_approve(safety_token, biz_token):
    rec = _create_basic(_hdr(biz_token))
    try:
        r = requests.patch(f"{API}/purchases/{rec['id']}/approval",
                           json={"approved": True}, headers=_hdr(safety_token))
        assert r.status_code == 403
    finally:
        requests.delete(f"{API}/purchases/{rec['id']}", headers=_hdr(biz_token))


def test_safety_user_cannot_delete(safety_token, biz_token):
    rec = _create_basic(_hdr(biz_token))
    try:
        r = requests.delete(f"{API}/purchases/{rec['id']}", headers=_hdr(safety_token))
        assert r.status_code == 403
    finally:
        requests.delete(f"{API}/purchases/{rec['id']}", headers=_hdr(biz_token))


def test_no_token_mutations_401():
    r = requests.patch(f"{API}/purchases/xxx/approval", json={"approved": True})
    assert r.status_code == 401
    r = requests.patch(f"{API}/purchases/xxx/safety-approval", json={"approved": True})
    assert r.status_code == 401
    r = requests.delete(f"{API}/purchases/xxx")
    assert r.status_code == 401


def test_xlsx_export_ok():
    r = requests.get(f"{API}/purchases/export/xlsx")
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers.get("Content-Type", "")


def test_stats_ok():
    r = requests.get(f"{API}/purchases/stats")
    assert r.status_code == 200
    assert "total" in r.json()
