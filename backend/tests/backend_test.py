"""Backend API tests for RLPC IT Assets Purchase Records app.

All POST/PUT/DELETE go through an authenticated (approver) session because
the RBAC iteration requires a Bearer token for any mutation.
"""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def anon():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def approver_token(anon):
    r = anon.post(f"{API}/auth/login", json={"username": "158", "password": "Rlpc_974"}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth_session(approver_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {approver_token}"})
    return s


def _payload(emp_id="TEST_E001", name="TEST_User",
             ptype="Mobile Purchase", pmode="Cash",
             pby="Jogy Joseph", approved=False):
    return {
        "employee_id": emp_id,
        "employee_name": name,
        "purchase_type": ptype,
        "payment_mode": pmode,
        "payment_by": pby,
        "business_manager_approved": approved,
    }


# ----- Config -----
class TestConfig:
    def test_get_config(self, anon):
        r = anon.get(f"{API}/config", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["org_name"] == "RLPC IT Assets Records"
        assert d["purchase_types"] == ["Mobile Purchase", "Tech Device", "Safety Shoes"]
        assert d["payment_modes"] == ["Cash", "Credit Card", "Bank Transfer"]
        assert d["payment_by"] == ["Jogy Joseph", "Mohammad Omer", "Muhammad Khaleel", "Muhammad Abdullah"]


# ----- Create / Validation -----
class TestCreate:
    def test_create_success(self, auth_session):
        r = auth_session.post(f"{API}/purchases", json=_payload(), timeout=10)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["id"]
        datetime.fromisoformat(d["purchase_date"])
        try:
            list_r = auth_session.get(f"{API}/purchases", params={"search": "TEST_E001"}, timeout=10)
            assert list_r.status_code == 200
            assert d["id"] in [x["id"] for x in list_r.json()["items"]]
        finally:
            auth_session.delete(f"{API}/purchases/{d['id']}", timeout=10)

    def test_missing_required_returns_422(self, auth_session):
        r = auth_session.post(f"{API}/purchases", json={"employee_id": ""}, timeout=10)
        assert r.status_code == 422

    def test_invalid_purchase_type(self, auth_session):
        r = auth_session.post(f"{API}/purchases", json=_payload(ptype="Invalid"), timeout=10)
        assert r.status_code == 422

    def test_invalid_payment_mode(self, auth_session):
        r = auth_session.post(f"{API}/purchases", json=_payload(pmode="Crypto"), timeout=10)
        assert r.status_code == 422

    def test_invalid_payment_by(self, auth_session):
        r = auth_session.post(f"{API}/purchases", json=_payload(pby="Someone Else"), timeout=10)
        assert r.status_code == 422


# ----- Pagination -----
class TestPagination:
    @pytest.fixture(scope="class")
    def seeded(self, auth_session):
        ids = []
        for i in range(55):
            p = _payload(emp_id=f"TEST_PG{i:03d}", name=f"TEST_PgUser{i}")
            r = auth_session.post(f"{API}/purchases", json=p, timeout=10)
            assert r.status_code == 201, r.text
            ids.append(r.json()["id"])
        yield ids
        for pid in ids:
            auth_session.delete(f"{API}/purchases/{pid}", timeout=10)

    def test_page1_has_50(self, anon, seeded):
        r = anon.get(f"{API}/purchases", params={"search": "TEST_PG", "page": 1, "page_size": 50}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 55
        assert len(d["items"]) == 50

    def test_page2_has_5(self, anon, seeded):
        r = anon.get(f"{API}/purchases", params={"search": "TEST_PG", "page": 2, "page_size": 50}, timeout=15)
        assert len(r.json()["items"]) == 5


# ----- Search & Filters -----
class TestFilters:
    @pytest.fixture(scope="class")
    def data(self, auth_session):
        recs = [
            _payload("TEST_F1", "TEST_Alice", "Mobile Purchase", "Cash", "Jogy Joseph", True),
            _payload("TEST_F2", "TEST_Bob", "Tech Device", "Credit Card", "Mohammad Omer", False),
            _payload("TEST_F3", "TEST_Carol", "Mobile Purchase", "Bank Transfer", "Muhammad Khaleel", True),
        ]
        ids = []
        for p in recs:
            r = auth_session.post(f"{API}/purchases", json=p, timeout=10)
            assert r.status_code == 201, r.text
            ids.append(r.json()["id"])
        yield ids
        for pid in ids:
            auth_session.delete(f"{API}/purchases/{pid}", timeout=10)

    def test_search_by_employee_id(self, anon, data):
        r = anon.get(f"{API}/purchases", params={"search": "TEST_F1"}, timeout=10)
        assert any(x["employee_id"] == "TEST_F1" for x in r.json()["items"])

    def test_search_by_name_case_insensitive(self, anon, data):
        r = anon.get(f"{API}/purchases", params={"search": "test_alice"}, timeout=10)
        assert any(x["employee_name"] == "TEST_Alice" for x in r.json()["items"])

    def test_filter_purchase_type(self, anon, data):
        r = anon.get(f"{API}/purchases", params={"search": "TEST_F", "purchase_type": "Tech Device"}, timeout=10)
        items = r.json()["items"]
        assert items and all(x["purchase_type"] == "Tech Device" for x in items)

    def test_filter_payment_mode(self, anon, data):
        r = anon.get(f"{API}/purchases", params={"search": "TEST_F", "payment_mode": "Cash"}, timeout=10)
        assert all(x["payment_mode"] == "Cash" for x in r.json()["items"])

    def test_filter_payment_by(self, anon, data):
        r = anon.get(f"{API}/purchases", params={"search": "TEST_F", "payment_by": "Mohammad Omer"}, timeout=10)
        assert all(x["payment_by"] == "Mohammad Omer" for x in r.json()["items"])

    def test_filter_approved_true(self, anon, data):
        r = anon.get(f"{API}/purchases", params={"search": "TEST_F", "approved": "true"}, timeout=10)
        items = r.json()["items"]
        assert all(x["business_manager_approved"] is True for x in items)
        assert len(items) >= 2

    def test_filter_approved_false(self, anon, data):
        r = anon.get(f"{API}/purchases", params={"search": "TEST_F", "approved": "false"}, timeout=10)
        assert all(x["business_manager_approved"] is False for x in r.json()["items"])

    def test_filter_combined(self, anon, data):
        r = anon.get(f"{API}/purchases", params={"search": "TEST_F", "purchase_type": "Mobile Purchase", "approved": "true"}, timeout=10)
        assert all(x["purchase_type"] == "Mobile Purchase" and x["business_manager_approved"] for x in r.json()["items"])

    def test_filter_date_range(self, anon, data):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
        r = anon.get(f"{API}/purchases", params={"search": "TEST_F", "date_from": today, "date_to": tomorrow}, timeout=10)
        assert r.status_code == 200
        assert r.json()["total"] >= 3

    def test_filter_date_range_exclude(self, anon, data):
        r = anon.get(f"{API}/purchases", params={"search": "TEST_F", "date_from": "2000-01-01", "date_to": "2000-01-01"}, timeout=10)
        assert r.json()["total"] == 0


# ----- Stats -----
class TestStats:
    def test_stats_basic(self, anon):
        r = anon.get(f"{API}/purchases/stats", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "approved", "pending", "mobile", "tech"):
            assert k in d
        assert d["total"] == d["approved"] + d["pending"]

    def test_stats_respects_filter(self, anon, auth_session):
        ids = []
        for i in range(2):
            r = auth_session.post(f"{API}/purchases", json=_payload(emp_id=f"TEST_ST{i}", approved=True), timeout=10)
            ids.append(r.json()["id"])
        try:
            r = anon.get(f"{API}/purchases/stats", params={"search": "TEST_ST", "approved": "true"}, timeout=10)
            d = r.json()
            assert d["total"] == 2 and d["approved"] == 2 and d["pending"] == 0 and d["mobile"] == 2
        finally:
            for pid in ids:
                auth_session.delete(f"{API}/purchases/{pid}", timeout=10)


# ----- Update -----
class TestUpdate:
    def test_update_keeps_purchase_date(self, auth_session):
        r = auth_session.post(f"{API}/purchases", json=_payload(emp_id="TEST_UPD1"), timeout=10)
        rec = r.json()
        pid = rec["id"]
        orig_date = rec["purchase_date"]
        orig_updated = rec["updated_at"]
        try:
            import time
            time.sleep(1)
            upd = _payload(emp_id="TEST_UPD1", name="TEST_Updated", ptype="Tech Device", approved=True)
            r2 = auth_session.put(f"{API}/purchases/{pid}", json=upd, timeout=10)
            assert r2.status_code == 200
            d = r2.json()
            assert d["employee_name"] == "TEST_Updated"
            assert d["purchase_type"] == "Tech Device"
            assert d["business_manager_approved"] is True
            assert d["purchase_date"] == orig_date
            assert d["updated_at"] != orig_updated
        finally:
            auth_session.delete(f"{API}/purchases/{pid}", timeout=10)

    def test_update_unknown_returns_404(self, auth_session):
        r = auth_session.put(f"{API}/purchases/nope-xyz", json=_payload(), timeout=10)
        assert r.status_code == 404


# ----- Delete -----
class TestDelete:
    def test_delete_success(self, auth_session):
        r = auth_session.post(f"{API}/purchases", json=_payload(emp_id="TEST_DEL1"), timeout=10)
        pid = r.json()["id"]
        r2 = auth_session.delete(f"{API}/purchases/{pid}", timeout=10)
        assert r2.status_code == 200
        r3 = auth_session.put(f"{API}/purchases/{pid}", json=_payload(), timeout=10)
        assert r3.status_code == 404

    def test_delete_unknown_returns_404(self, auth_session):
        r = auth_session.delete(f"{API}/purchases/nonexistent-id", timeout=10)
        assert r.status_code == 404


# ----- Exports -----
class TestExports:
    def test_export_xlsx(self, anon):
        r = anon.get(f"{API}/purchases/export/xlsx", timeout=30)
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "")
        assert r.content[:2] == b"PK"

    def test_export_pdf(self, anon):
        r = anon.get(f"{API}/purchases/export/pdf", timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"

    def test_export_xlsx_with_filter(self, anon):
        r = anon.get(f"{API}/purchases/export/xlsx", params={"purchase_type": "Mobile Purchase"}, timeout=30)
        assert r.status_code == 200
        assert r.content[:2] == b"PK"
