from datetime import datetime, timezone

from services.auth_service import serialize_user


def test_serialize_user_includes_credit_buckets():
    user_document = {
        "id": "usr_001",
        "name": "Test User",
        "email": "test@example.com",
        "createdAt": datetime.now(timezone.utc),
        "planKey": "basic_99",
        "billingStatus": "active",
        "creditBuckets": {
            "10m": {"total": 7, "used": 2, "remaining": 5},
            "15m": {"total": 3, "used": 1, "remaining": 2},
            "30m": {"total": 0, "used": 0, "remaining": 0},
        },
    }

    payload = serialize_user(user_document)

    assert payload.creditBuckets["10m"]["remaining"] == 5
    assert payload.creditBuckets["15m"]["remaining"] == 2
    assert payload.creditBuckets["30m"]["remaining"] == 0


if __name__ == "__main__":
    test_serialize_user_includes_credit_buckets()
    print("test_serialize_user_includes_credit_buckets passed")
