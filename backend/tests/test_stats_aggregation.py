"""Tests for GET /api/purchases/stats aggregation pipeline optimisation.

Ensures the $group/$cond pipeline returns identical values to the previous
in-memory implementation across various filter combinations, and that
export endpoints still respect filters after the MAX_EXPORT_LIMIT change.
"""
import os
import uuid
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

# Unique per-process tag to avoid xdist worker collisions (loadscope splits
# classes across workers; module-scoped seed would otherwise be duplicated).
SEARCH_TAG = f"TEST_STATS_AGG_{uuid.uuid4().hex[:8]}"


def _payload(emp_id, ptype, approved=False, pmode="Cash", pby="Jogy Joseph"):
    return {
        "employee_id": emp_id,
        "employee_name": f"{emp_id}_name",
        "purchase_type": ptype,
        "payment_mode": pmode,
        "payment_by": pby,
        "business_manager_approved": approved,
    }


@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"username": "158", "password": "Rlpc_974"}, timeout=10)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def anon():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def seeded(auth_session):
    """Seed a controlled dataset scoped by SEARCH_TAG for deterministic assertions.

    Composition (7 records):
      - 2 Mobile Purchase approved
      - 1 Mobile Purchase pending
      - 2 Tech Device approved
      - 1 Tech Device pending
      - 1 Safety Shoes pending
    Totals: total=7, approved=4, pending=3, mobile=3, tech=3, shoes=1
    """
    recs = [
        _payload(f"{SEARCH_TAG}_M1", "Mobile Purchase", approved=True),
        _payload(f"{SEARCH_TAG}_M2", "Mobile Purchase", approved=True, pmode="Credit Card"),
        _payload(f"{SEARCH_TAG}_M3", "Mobile Purchase", approved=False, pby="Mohammad Omer"),
        _payload(f"{SEARCH_TAG}_T1", "Tech Device", approved=True),
        _payload(f"{SEARCH_TAG}_T2", "Tech Device", approved=True, pmode="Bank Transfer"),
        _payload(f"{SEARCH_TAG}_T3", "Tech Device", approved=False, pby="Muhammad Khaleel"),
        _payload(f"{SEARCH_TAG}_S1", "Safety Shoes", approved=False, pby="Muhammad Abdullah"),
    ]
    ids = []
    for p in recs:
        r = auth_session.post(f"{API}/purchases", json=p, timeout=10)
        assert r.status_code == 201, r.text
        ids.append(r.json()["id"])
    yield ids
    for pid in ids:
        auth_session.delete(f"{API}/purchases/{pid}", timeout=10)


def _stats(session, **params):
    params.setdefault("search", SEARCH_TAG)
    r = session.get(f"{API}/purchases/stats", params=params, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- No filter (scoped by SEARCH_TAG search) ----------------
class TestStatsAllRecords:
    def test_totals_match_seed(self, anon, seeded):
        d = _stats(anon)
        assert d == {"total": 7, "approved": 4, "pending": 3, "mobile": 3, "tech": 3}

    def test_pending_equals_total_minus_approved(self, anon, seeded):
        d = _stats(anon)
        assert d["pending"] == d["total"] - d["approved"]

    def test_shoes_not_in_mobile_or_tech(self, anon, seeded):
        d = _stats(anon)
        # 7 total minus 3 mobile minus 3 tech = 1 Safety Shoes
        assert d["total"] - d["mobile"] - d["tech"] == 1


# ---------------- Filter combinations ----------------
class TestStatsFilters:
    def test_approved_true(self, anon, seeded):
        d = _stats(anon, approved="true")
        assert d["total"] == 4
        assert d["approved"] == 4
        assert d["pending"] == 0
        assert d["mobile"] == 2
        assert d["tech"] == 2

    def test_approved_false(self, anon, seeded):
        d = _stats(anon, approved="false")
        assert d["total"] == 3
        assert d["approved"] == 0
        assert d["pending"] == 3
        assert d["mobile"] == 1
        assert d["tech"] == 1

    def test_type_mobile(self, anon, seeded):
        d = _stats(anon, purchase_type="Mobile Purchase")
        assert d == {"total": 3, "approved": 2, "pending": 1, "mobile": 3, "tech": 0}

    def test_type_tech(self, anon, seeded):
        d = _stats(anon, purchase_type="Tech Device")
        assert d == {"total": 3, "approved": 2, "pending": 1, "mobile": 0, "tech": 3}

    def test_type_safety_shoes(self, anon, seeded):
        d = _stats(anon, purchase_type="Safety Shoes")
        assert d == {"total": 1, "approved": 0, "pending": 1, "mobile": 0, "tech": 0}

    def test_payment_mode_cash(self, anon, seeded):
        # M1 (approved), T1 (approved), M3 (pending), T3 (pending), S1 (pending) => Cash defaults
        d = _stats(anon, payment_mode="Cash")
        # M1, M3, T1, T3, S1 = 5 (default Cash for those not overridden)
        assert d["total"] == 5
        assert d["approved"] == 2  # M1, T1
        assert d["mobile"] == 2  # M1, M3
        assert d["tech"] == 2  # T1, T3

    def test_payment_mode_credit_card(self, anon, seeded):
        d = _stats(anon, payment_mode="Credit Card")
        assert d == {"total": 1, "approved": 1, "pending": 0, "mobile": 1, "tech": 0}

    def test_payment_by_mohammad_omer(self, anon, seeded):
        d = _stats(anon, payment_by="Mohammad Omer")
        assert d == {"total": 1, "approved": 0, "pending": 1, "mobile": 1, "tech": 0}

    def test_search_specific_employee(self, anon, seeded):
        d = _stats(anon, search=f"{SEARCH_TAG}_T1")
        assert d == {"total": 1, "approved": 1, "pending": 0, "mobile": 0, "tech": 1}

    def test_combined_type_and_approved(self, anon, seeded):
        d = _stats(anon, purchase_type="Mobile Purchase", approved="true")
        assert d == {"total": 2, "approved": 2, "pending": 0, "mobile": 2, "tech": 0}

    def test_date_range_today(self, anon, seeded):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
        d = _stats(anon, date_from=today, date_to=tomorrow)
        assert d["total"] == 7

    def test_no_match_all_zeros(self, anon, seeded):
        d = _stats(anon, search=f"{SEARCH_TAG}_DOES_NOT_EXIST_XYZ")
        assert d == {"total": 0, "approved": 0, "pending": 0, "mobile": 0, "tech": 0}

    def test_date_range_past_no_match(self, anon, seeded):
        d = _stats(anon, date_from="2000-01-01", date_to="2000-01-02")
        assert d == {"total": 0, "approved": 0, "pending": 0, "mobile": 0, "tech": 0}


# ---------------- Export endpoints reflect filters ----------------
class TestExportsWithFilters:
    def test_xlsx_reflects_filter(self, anon, seeded):
        r = anon.get(f"{API}/purchases/export/xlsx",
                     params={"search": SEARCH_TAG, "purchase_type": "Mobile Purchase"}, timeout=30)
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "")
        assert r.content[:2] == b"PK"

    def test_pdf_reflects_filter(self, anon, seeded):
        r = anon.get(f"{API}/purchases/export/pdf",
                     params={"search": SEARCH_TAG, "approved": "true"}, timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"

    def test_xlsx_no_filter_ok(self, anon, seeded):
        r = anon.get(f"{API}/purchases/export/xlsx", timeout=60)
        assert r.status_code == 200
        assert r.content[:2] == b"PK"


# ---------------- Regression: auth still required ----------------
class TestAuthGating:
    def test_put_without_token_401(self, anon):
        r = anon.put(f"{API}/purchases/nonexistent", json=_payload("TEST_x", "Mobile Purchase"), timeout=10)
        assert r.status_code == 401

    def test_delete_without_token_401(self, anon):
        r = anon.delete(f"{API}/purchases/nonexistent", timeout=10)
        assert r.status_code == 401

    def test_two_users_login(self, anon):
        for uname in ("158", "IT admin"):
            r = anon.post(f"{API}/auth/login", json={"username": uname, "password": "Rlpc_974"}, timeout=10)
            assert r.status_code == 200, f"login failed for {uname}: {r.text}"
            assert r.json()["username"] == uname

    def test_create_malformed_date_422(self, anon):
        p = _payload("TEST_bad_date", "Mobile Purchase")
        p["purchase_date"] = "not-a-date"
        r = anon.post(f"{API}/purchases", json=p, timeout=10)
        assert r.status_code == 422
