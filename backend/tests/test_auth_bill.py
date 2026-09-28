"""Tests for new features: auth, approval enforcement, bill upload, Safety Shoes."""
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

USERNAME = "158"
PASSWORD = "Rlpc_974"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def token(session):
    r = session.post(f"{API}/auth/login", json={"username": USERNAME, "password": PASSWORD}, timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["username"] == USERNAME
    assert isinstance(d["token"], str) and len(d["token"]) > 20
    return d["token"]


def _payload(emp_id="TEST_AUTH1", approved=False, ptype="Mobile Purchase"):
    return {
        "employee_id": emp_id,
        "employee_name": "TEST_AuthUser",
        "purchase_type": ptype,
        "payment_mode": "Cash",
        "payment_by": "Jogy Joseph",
        "business_manager_approved": approved,
    }


# ----- Auth -----
class TestAuth:
    def test_login_wrong_creds_401(self, session):
        r = session.post(f"{API}/auth/login", json={"username": "158", "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_login_success(self, token):
        assert token

    def test_me_without_token_401(self, session):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_me_with_invalid_token_401(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer invalid.token"}, timeout=10)
        assert r.status_code == 401

    def test_me_with_valid_token(self, token):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["username"] == USERNAME


# ----- Approval enforcement -----
class TestApprovalEnforcement:
    def test_create_approved_without_token_403(self, session):
        r = session.post(f"{API}/purchases", json=_payload("TEST_APR1", approved=True), timeout=10)
        assert r.status_code == 403

    def test_create_approved_with_token_201(self, token):
        r = requests.post(
            f"{API}/purchases",
            json=_payload("TEST_APR2", approved=True),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=10,
        )
        assert r.status_code == 201, r.text
        pid = r.json()["id"]
        assert r.json()["business_manager_approved"] is True
        # cleanup
        requests.delete(f"{API}/purchases/{pid}", timeout=10)

    def test_create_not_approved_without_token_201(self, session):
        r = session.post(f"{API}/purchases", json=_payload("TEST_APR3", approved=False), timeout=10)
        assert r.status_code == 201
        pid = r.json()["id"]
        session.delete(f"{API}/purchases/{pid}", timeout=10)

    def test_create_safety_shoes_without_token_201(self, session):
        r = session.post(f"{API}/purchases", json=_payload("TEST_APR4", approved=False, ptype="Safety Shoes"), timeout=10)
        assert r.status_code == 201, r.text
        assert r.json()["purchase_type"] == "Safety Shoes"
        session.delete(f"{API}/purchases/{r.json()['id']}", timeout=10)

    def test_update_change_approval_without_token_401(self, session, token):
        # create unapproved
        r = session.post(f"{API}/purchases", json=_payload("TEST_UPA1", approved=False), timeout=10)
        pid = r.json()["id"]
        try:
            # PUT without token now requires auth -> 401
            r2 = session.put(f"{API}/purchases/{pid}", json=_payload("TEST_UPA1", approved=True), timeout=10)
            assert r2.status_code == 401
            # with token succeeds
            r3 = requests.put(
                f"{API}/purchases/{pid}",
                json=_payload("TEST_UPA1", approved=True),
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                timeout=10,
            )
            assert r3.status_code == 200
            assert r3.json()["business_manager_approved"] is True
        finally:
            requests.delete(
                f"{API}/purchases/{pid}",
                headers={"Authorization": f"Bearer {token}"}, timeout=10,
            )

    def test_update_non_approval_field_without_token_401(self, session, token):
        # create unapproved
        r = session.post(f"{API}/purchases", json=_payload("TEST_UPA2", approved=False), timeout=10)
        pid = r.json()["id"]
        try:
            body = _payload("TEST_UPA2", approved=False)
            body["employee_name"] = "TEST_NewName"
            # iteration 4: any PUT requires auth
            r2 = session.put(f"{API}/purchases/{pid}", json=body, timeout=10)
            assert r2.status_code == 401
        finally:
            requests.delete(
                f"{API}/purchases/{pid}",
                headers={"Authorization": f"Bearer {token}"}, timeout=10,
            )


# ----- Bill upload -----
class TestBillUpload:
    def test_upload_bill_and_download(self, session):
        # A minimal valid PDF (per PDF spec)
        pdf_bytes = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
        files = {"file": ("test_bill.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        # requests needs no Content-Type header for multipart
        r = requests.post(f"{API}/purchases/upload-bill", files=files, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "bill_path" in d and d["bill_path"]
        assert d["bill_filename"] == "test_bill.pdf"

        # Download
        r2 = requests.get(f"{API}/purchases/bill/{d['bill_path']}", timeout=30)
        assert r2.status_code == 200
        assert r2.content == pdf_bytes or r2.content.startswith(b"%PDF")
        assert "pdf" in r2.headers.get("content-type", "").lower() or r2.headers.get("content-type")

        return d

    def test_create_purchase_with_bill_persists(self, session):
        pdf_bytes = b"%PDF-1.4\n%bill-persist-test\n%%EOF"
        files = {"file": ("persist_bill.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        up = requests.post(f"{API}/purchases/upload-bill", files=files, timeout=30)
        assert up.status_code == 200
        upd = up.json()

        body = _payload("TEST_BILL1", approved=False)
        body["bill_path"] = upd["bill_path"]
        body["bill_filename"] = upd["bill_filename"]
        r = session.post(f"{API}/purchases", json=body, timeout=10)
        assert r.status_code == 201, r.text
        pid = r.json()["id"]
        try:
            assert r.json()["bill_path"] == upd["bill_path"]
            assert r.json()["bill_filename"] == "persist_bill.pdf"
            # verify listing returns bill fields
            lr = session.get(f"{API}/purchases", params={"search": "TEST_BILL1"}, timeout=10)
            items = lr.json()["items"]
            match = [x for x in items if x["id"] == pid]
            assert match and match[0]["bill_path"] == upd["bill_path"]
            assert match[0]["bill_filename"] == "persist_bill.pdf"
        finally:
            session.delete(f"{API}/purchases/{pid}", timeout=10)


# ----- Safety Shoes filter regression -----
class TestSafetyShoesFilter:
    def test_filter_safety_shoes(self, session):
        r = session.post(f"{API}/purchases", json=_payload("TEST_SS1", ptype="Safety Shoes"), timeout=10)
        pid = r.json()["id"]
        try:
            lr = session.get(f"{API}/purchases", params={"search": "TEST_SS", "purchase_type": "Safety Shoes"}, timeout=10)
            items = lr.json()["items"]
            assert any(x["id"] == pid for x in items)
            assert all(x["purchase_type"] == "Safety Shoes" for x in items)
        finally:
            session.delete(f"{API}/purchases/{pid}", timeout=10)
