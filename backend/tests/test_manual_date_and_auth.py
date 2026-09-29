"""Tests: manual purchase_date, two-user login regression, edit/delete auth."""
import os
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


def _payload(**kw):
    base = {
        "employee_id": "TEST_MD1",
        "employee_name": "TEST_ManualDate",
        "purchase_type": "Mobile Purchase",
        "payment_mode": "Cash",
        "payment_by": "Jogy Joseph",
        "business_manager_approved": False,
    }
    base.update(kw)
    return base


@pytest.fixture(scope="module")
def tok_158():
    r = requests.post(f"{API}/auth/login", json={"username": "158", "password": "Rlpc_974"}, timeout=10)
    return r.json()["token"]


@pytest.fixture(scope="module")
def tok_admin():
    r = requests.post(f"{API}/auth/login", json={"username": "IT admin", "password": "Rlpc_974"}, timeout=10)
    return r.json()["token"]


@pytest.fixture(scope="module")
def h_158(tok_158):
    return {"Authorization": f"Bearer {tok_158}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def h_admin(tok_admin):
    return {"Authorization": f"Bearer {tok_admin}", "Content-Type": "application/json"}


# ----- Login regression -----
class TestLoginBothUsers:
    def test_login_user_158(self):
        r = requests.post(f"{API}/auth/login", json={"username": "158", "password": "Rlpc_974"}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["username"] == "158"
        assert d["can_approve"] is True

    def test_login_user_it_admin(self):
        r = requests.post(f"{API}/auth/login", json={"username": "IT admin", "password": "Rlpc_974"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["can_approve"] is True

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"username": "158", "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_login_unknown_user(self):
        r = requests.post(f"{API}/auth/login", json={"username": "ghost", "password": "Rlpc_974"}, timeout=10)
        assert r.status_code == 401


# ----- Manual purchase date -----
class TestManualPurchaseDate:
    def test_create_with_manual_date(self, h_158):
        chosen = "2026-01-15T00:00:00"
        r = requests.post(f"{API}/purchases", json=_payload(employee_id="TEST_MD_A", purchase_date=chosen), headers=h_158, timeout=10)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["purchase_date"] == chosen
        pid = d["id"]
        g = requests.get(f"{API}/purchases", params={"search": "TEST_MD_A"}, timeout=10)
        found = [x for x in g.json()["items"] if x["id"] == pid][0]
        assert found["purchase_date"] == chosen
        requests.delete(f"{API}/purchases/{pid}", headers=h_158, timeout=10)

    def test_create_without_date_defaults_to_now(self, h_158):
        before = datetime.now(timezone.utc)
        r = requests.post(f"{API}/purchases", json=_payload(employee_id="TEST_MD_B"), headers=h_158, timeout=10)
        assert r.status_code == 201
        d = r.json()
        dt = datetime.fromisoformat(d["purchase_date"])
        assert abs((dt - before).total_seconds()) < 60
        requests.delete(f"{API}/purchases/{d['id']}", headers=h_158, timeout=10)

    def test_create_malformed_date_422(self, h_158):
        p = _payload(employee_id="TEST_MD_BAD", purchase_date="not-a-date")
        r = requests.post(f"{API}/purchases", json=p, headers=h_158, timeout=10)
        assert r.status_code == 422


# ----- PUT / DELETE auth -----
class TestEditDeleteAuth:
    @pytest.fixture
    def created_id(self, h_158):
        r = requests.post(f"{API}/purchases", json=_payload(employee_id="TEST_ED1"), headers=h_158, timeout=10)
        pid = r.json()["id"]
        yield pid
        requests.delete(f"{API}/purchases/{pid}", headers=h_158, timeout=10)

    def test_put_without_auth_401(self, created_id):
        r = requests.put(f"{API}/purchases/{created_id}", json=_payload(employee_id="TEST_ED1", employee_name="X"), timeout=10)
        assert r.status_code == 401

    def test_put_with_158_token_200(self, created_id, h_158):
        r = requests.put(f"{API}/purchases/{created_id}", json=_payload(employee_id="TEST_ED1", employee_name="TEST_Updated_158", purchase_date="2026-02-01T00:00:00"), headers=h_158, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["employee_name"] == "TEST_Updated_158"
        assert d["purchase_date"] == "2026-02-01T00:00:00"

    def test_put_with_admin_token_200(self, created_id, h_admin):
        r = requests.put(f"{API}/purchases/{created_id}", json=_payload(employee_id="TEST_ED1", employee_name="TEST_Updated_admin"), headers=h_admin, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["employee_name"] == "TEST_Updated_admin"

    def test_delete_without_auth_401(self, h_158):
        r = requests.post(f"{API}/purchases", json=_payload(employee_id="TEST_ED_DEL"), headers=h_158, timeout=10)
        pid = r.json()["id"]
        try:
            r2 = requests.delete(f"{API}/purchases/{pid}", timeout=10)
            assert r2.status_code == 401
        finally:
            requests.delete(f"{API}/purchases/{pid}", headers=h_158, timeout=10)

    def test_delete_with_admin_token_200(self, h_admin):
        r = requests.post(f"{API}/purchases", json=_payload(employee_id="TEST_ED_DEL2"), headers=h_admin, timeout=10)
        pid = r.json()["id"]
        r2 = requests.delete(f"{API}/purchases/{pid}", headers=h_admin, timeout=10)
        assert r2.status_code == 200


# ----- Approval still enforced -----
class TestApprovalAuth:
    def test_create_approved_no_token_401(self):
        r = requests.post(f"{API}/purchases", json=_payload(employee_id="TEST_APV_NA", business_manager_approved=True), timeout=10)
        assert r.status_code == 401

    def test_create_approved_with_approver_201(self, h_admin):
        r = requests.post(f"{API}/purchases", json=_payload(employee_id="TEST_APV_OK", business_manager_approved=True), headers=h_admin, timeout=10)
        assert r.status_code == 201
        pid = r.json()["id"]
        requests.delete(f"{API}/purchases/{pid}", headers=h_admin, timeout=10)

    def test_single_approval_no_token_401(self, h_158):
        r = requests.post(f"{API}/purchases", json=_payload(employee_id="TEST_APV_S"), headers=h_158, timeout=10)
        pid = r.json()["id"]
        try:
            r2 = requests.patch(f"{API}/purchases/{pid}/approval", json={"approved": True}, timeout=10)
            assert r2.status_code == 401
        finally:
            requests.delete(f"{API}/purchases/{pid}", headers=h_158, timeout=10)

    def test_bulk_approval_no_token_401(self):
        r = requests.patch(f"{API}/purchases/approval/bulk", json={"ids": ["x"], "approved": True}, timeout=10)
        assert r.status_code == 401
