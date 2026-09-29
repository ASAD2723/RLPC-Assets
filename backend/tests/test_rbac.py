"""RBAC iteration tests: 6 hardcoded users, approver vs editor roles.

Covers login/auth_me can_approve, editor create/edit/delete gating,
CSV import approval force, and unauthenticated 401 for all mutations.
"""
import os
import io
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

APPROVERS = [("158", "Rlpc_974"), ("IT admin", "Rlpc_974")]
EDITORS = [("16", "Roc_974"), ("76", "Pro_974"), ("122", "Proc_974"), ("126", "Purchase_974")]


def _payload(emp_id="TEST_RBAC", approved=False, ptype="Mobile Purchase", pmode="Cash", pby="Jogy Joseph"):
    return {
        "employee_id": emp_id,
        "employee_name": "TEST_RbacUser",
        "purchase_type": ptype,
        "payment_mode": pmode,
        "payment_by": pby,
        "business_manager_approved": approved,
    }


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _login(user, pw):
    r = requests.post(f"{API}/auth/login", json={"username": user, "password": pw}, timeout=10)
    return r


@pytest.fixture(scope="module")
def approver_token():
    return _login("158", "Rlpc_974").json()["token"]


@pytest.fixture(scope="module")
def editor_token():
    return _login("16", "Roc_974").json()["token"]


# ----- Login for all 6 -----
class TestSixUserLogin:
    @pytest.mark.parametrize("user,pw", APPROVERS)
    def test_approver_login_can_approve_true(self, user, pw):
        r = _login(user, pw)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["username"] == user
        assert d["can_approve"] is True
        assert isinstance(d["token"], str) and len(d["token"]) > 10

    @pytest.mark.parametrize("user,pw", EDITORS)
    def test_editor_login_can_approve_false(self, user, pw):
        r = _login(user, pw)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["username"] == user
        assert d["can_approve"] is False

    @pytest.mark.parametrize("user,pw", APPROVERS + EDITORS)
    def test_wrong_password_401(self, user, pw):
        r = _login(user, "wrong_pw")
        assert r.status_code == 401

    @pytest.mark.parametrize("user,pw", APPROVERS + EDITORS)
    def test_me_returns_can_approve(self, user, pw):
        tok = _login(user, pw).json()["token"]
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["username"] == user
        assert d["can_approve"] == ((user, pw) in APPROVERS)


# ----- Unauthenticated mutations must be 401 -----
class TestNoTokenMutations:
    def test_post_purchase_401(self):
        r = requests.post(f"{API}/purchases", json=_payload("TEST_NO1"), timeout=10)
        assert r.status_code == 401

    def test_put_purchase_401(self):
        r = requests.put(f"{API}/purchases/some-id", json=_payload("TEST_NO2"), timeout=10)
        assert r.status_code == 401

    def test_delete_purchase_401(self):
        r = requests.delete(f"{API}/purchases/some-id", timeout=10)
        assert r.status_code == 401

    def test_import_401(self):
        files = {"file": ("t.csv", io.BytesIO(b"a,b"), "text/csv")}
        r = requests.post(f"{API}/purchases/import", files=files, timeout=10)
        assert r.status_code == 401

    def test_upload_bill_401(self):
        files = {"file": ("t.pdf", io.BytesIO(b"%PDF"), "application/pdf")}
        r = requests.post(f"{API}/purchases/upload-bill", files=files, timeout=10)
        assert r.status_code == 401


# ----- Editor RBAC on purchases -----
class TestEditorPurchases:
    def test_editor_create_not_approved_201(self, editor_token):
        r = requests.post(f"{API}/purchases", json=_payload("TEST_ED_C1", approved=False), headers=_headers(editor_token), timeout=10)
        assert r.status_code == 201, r.text
        assert r.json()["business_manager_approved"] is False
        pid = r.json()["id"]
        # editor delete should work
        d = requests.delete(f"{API}/purchases/{pid}", headers=_headers(editor_token), timeout=10)
        assert d.status_code == 200

    def test_editor_create_approved_403(self, editor_token):
        r = requests.post(f"{API}/purchases", json=_payload("TEST_ED_C2", approved=True), headers=_headers(editor_token), timeout=10)
        assert r.status_code == 403

    def test_editor_edit_non_approval_200_preserves_date(self, editor_token, approver_token):
        # Create with approver so we have known state
        chosen = "2026-04-10T00:00:00"
        p = _payload("TEST_ED_E1", approved=False)
        p["purchase_date"] = chosen
        r = requests.post(f"{API}/purchases", json=p, headers=_headers(approver_token), timeout=10)
        pid = r.json()["id"]
        try:
            # Editor edits non-approval field WITHOUT sending purchase_date
            body = _payload("TEST_ED_E1", approved=False, pmode="Credit Card", pby="Mohammad Omer")
            r2 = requests.put(f"{API}/purchases/{pid}", json=body, headers=_headers(editor_token), timeout=10)
            assert r2.status_code == 200, r2.text
            d = r2.json()
            assert d["payment_mode"] == "Credit Card"
            assert d["payment_by"] == "Mohammad Omer"
            assert d["purchase_date"] == chosen  # preserved
            assert d["business_manager_approved"] is False
        finally:
            requests.delete(f"{API}/purchases/{pid}", headers=_headers(approver_token), timeout=10)

    def test_editor_flip_approval_403(self, editor_token, approver_token):
        r = requests.post(f"{API}/purchases", json=_payload("TEST_ED_F1", approved=False), headers=_headers(approver_token), timeout=10)
        pid = r.json()["id"]
        try:
            body = _payload("TEST_ED_F1", approved=True)
            r2 = requests.put(f"{API}/purchases/{pid}", json=body, headers=_headers(editor_token), timeout=10)
            assert r2.status_code == 403
        finally:
            requests.delete(f"{API}/purchases/{pid}", headers=_headers(approver_token), timeout=10)

    def test_editor_single_approval_403(self, editor_token, approver_token):
        r = requests.post(f"{API}/purchases", json=_payload("TEST_ED_S1"), headers=_headers(approver_token), timeout=10)
        pid = r.json()["id"]
        try:
            r2 = requests.patch(f"{API}/purchases/{pid}/approval", json={"approved": True}, headers=_headers(editor_token), timeout=10)
            assert r2.status_code == 403
        finally:
            requests.delete(f"{API}/purchases/{pid}", headers=_headers(approver_token), timeout=10)

    def test_editor_bulk_approval_403(self, editor_token):
        r = requests.patch(f"{API}/purchases/approval/bulk", json={"ids": ["x"], "approved": True}, headers=_headers(editor_token), timeout=10)
        assert r.status_code == 403

    def test_editor_delete_200(self, editor_token):
        r = requests.post(f"{API}/purchases", json=_payload("TEST_ED_D1"), headers=_headers(editor_token), timeout=10)
        pid = r.json()["id"]
        r2 = requests.delete(f"{API}/purchases/{pid}", headers=_headers(editor_token), timeout=10)
        assert r2.status_code == 200


# ----- Approver RBAC (positive path) -----
class TestApproverPurchases:
    def test_approver_create_approved_201(self, approver_token):
        r = requests.post(f"{API}/purchases", json=_payload("TEST_AP_C1", approved=True), headers=_headers(approver_token), timeout=10)
        assert r.status_code == 201
        pid = r.json()["id"]
        assert r.json()["business_manager_approved"] is True
        requests.delete(f"{API}/purchases/{pid}", headers=_headers(approver_token), timeout=10)

    def test_approver_single_approval_200(self, approver_token):
        r = requests.post(f"{API}/purchases", json=_payload("TEST_AP_S1"), headers=_headers(approver_token), timeout=10)
        pid = r.json()["id"]
        try:
            r2 = requests.patch(f"{API}/purchases/{pid}/approval", json={"approved": True}, headers=_headers(approver_token), timeout=10)
            assert r2.status_code == 200
            assert r2.json()["business_manager_approved"] is True
        finally:
            requests.delete(f"{API}/purchases/{pid}", headers=_headers(approver_token), timeout=10)

    def test_approver_bulk_approval_200(self, approver_token):
        ids = []
        for i in range(2):
            r = requests.post(f"{API}/purchases", json=_payload(f"TEST_AP_B{i}"), headers=_headers(approver_token), timeout=10)
            ids.append(r.json()["id"])
        try:
            r2 = requests.patch(f"{API}/purchases/approval/bulk", json={"ids": ids, "approved": True}, headers=_headers(approver_token), timeout=10)
            assert r2.status_code == 200
            assert r2.json()["updated"] == 2
        finally:
            for pid in ids:
                requests.delete(f"{API}/purchases/{pid}", headers=_headers(approver_token), timeout=10)

    def test_approver_flip_approval_via_put_200(self, approver_token):
        r = requests.post(f"{API}/purchases", json=_payload("TEST_AP_P1", approved=False), headers=_headers(approver_token), timeout=10)
        pid = r.json()["id"]
        try:
            body = _payload("TEST_AP_P1", approved=True)
            r2 = requests.put(f"{API}/purchases/{pid}", json=body, headers=_headers(approver_token), timeout=10)
            assert r2.status_code == 200
            assert r2.json()["business_manager_approved"] is True
        finally:
            requests.delete(f"{API}/purchases/{pid}", headers=_headers(approver_token), timeout=10)


# ----- CSV import RBAC (approval column) -----
CSV_CONTENT = (
    "Employee ID,Employee Name,Purchase Of,Mode of Payment,Payment By,Approved by Business Manager,Date\n"
    "TEST_CSV_R1,TEST_CsvUser1,Mobile Purchase,Cash,Jogy Joseph,Yes,2026-02-01\n"
    "TEST_CSV_R2,TEST_CsvUser2,Tech Device,Credit Card,Mohammad Omer,No,2026-02-02\n"
)


class TestCSVImportRBAC:
    def test_editor_import_forces_approved_false(self, editor_token, approver_token):
        files = {"file": ("import.csv", io.BytesIO(CSV_CONTENT.encode()), "text/csv")}
        r = requests.post(f"{API}/purchases/import", files=files, headers={"Authorization": f"Bearer {editor_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["imported"] == 2
        # Verify both rows imported as NOT approved
        lr = requests.get(f"{API}/purchases", params={"search": "TEST_CSV_R"}, timeout=10)
        items = [x for x in lr.json()["items"] if x["employee_id"].startswith("TEST_CSV_R")]
        assert len(items) >= 2
        for it in items:
            assert it["business_manager_approved"] is False, f"row {it['employee_id']} should be forced not approved"
        # cleanup
        for it in items:
            requests.delete(f"{API}/purchases/{it['id']}", headers=_headers(approver_token), timeout=10)

    def test_approver_import_respects_approved_yes(self, approver_token):
        files = {"file": ("import.csv", io.BytesIO(CSV_CONTENT.encode()), "text/csv")}
        r = requests.post(f"{API}/purchases/import", files=files, headers={"Authorization": f"Bearer {approver_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["imported"] == 2
        lr = requests.get(f"{API}/purchases", params={"search": "TEST_CSV_R"}, timeout=10)
        items = [x for x in lr.json()["items"] if x["employee_id"].startswith("TEST_CSV_R")]
        by_id = {x["employee_id"]: x for x in items}
        assert by_id["TEST_CSV_R1"]["business_manager_approved"] is True
        assert by_id["TEST_CSV_R2"]["business_manager_approved"] is False
        for it in items:
            requests.delete(f"{API}/purchases/{it['id']}", headers=_headers(approver_token), timeout=10)
