import asyncio
from services.otp_service import _hash_otp


def test_otp_hash_consistency():
    h1 = _hash_otp("test@example.com", "123456")
    h2 = _hash_otp("TEST@EXAMPLE.COM", "123456")
    assert h1 == h2
    assert len(h1) == 64


if __name__ == "__main__":
    test_otp_hash_consistency()
    print("ALL OTP UNIT TESTS PASSED SUCCESSFULLY!")
