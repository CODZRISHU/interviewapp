from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from config import get_settings


import asyncio

settings = get_settings()
_client: AsyncIOMotorClient = None
_database: AsyncIOMotorDatabase = None


def _get_client() -> AsyncIOMotorClient:
    global _client, _database
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if _client is None or (_client.io_loop != current_loop and current_loop is not None and not _client.io_loop.is_running()):
        _client = AsyncIOMotorClient(settings.mongo_url)
        _database = _client[settings.db_name]
    return _client


class DatabaseProxy:
    def __getattr__(self, name):
        _get_client()
        return getattr(_database, name)

    def __getitem__(self, name):
        _get_client()
        return _database[name]


database = DatabaseProxy()
client = _client


async def ensure_indexes() -> None:
    indexes = [
        (database.users, "email", {"unique": True}),
        (database.users, "id", {"unique": True}),
        (database.users, [("planKey", 1), ("billingStatus", 1)], {}),
        (database.users, [("creditsRemaining", -1), ("creditsUsed", -1)], {}),
        (database.users, "providerCustomerId", {"sparse": True}),
        (database.users, "providerSubscriptionId", {"sparse": True}),
        (database.users, "providerPaymentLinkId", {"sparse": True}),
        (database.interviews, "id", {"unique": True}),
        (database.interviews, [("userId", 1), ("createdAt", -1)], {}),
        (database.interviews, [("userId", 1), ("status", 1), ("createdAt", -1)], {}),
        (database.reports, "id", {"unique": True}),
        (database.reports, [("userId", 1), ("createdAt", -1)], {}),
        (database.reports, [("interviewId", 1), ("createdAt", -1)], {}),
        (database.refresh_tokens, "tokenId", {"unique": True}),
        (database.refresh_tokens, "userId", {}),
        (database.refresh_tokens, "expiresAt", {"expireAfterSeconds": 0}),
        (database.billing_events, "eventId", {"unique": True}),
        (database.analytics_events, [("userId", 1), ("createdAt", -1)], {}),
        (database.payments, "id", {"unique": True}),
        (database.payments, "orderId", {"unique": True, "sparse": True}),
        (database.payments, "paymentId", {"unique": True, "sparse": True}),
        (database.payments, [("userId", 1), ("createdAt", -1)], {}),
        (database.payments, "invoiceNumber", {"unique": True, "sparse": True}),
        (database.invoices, "invoiceNumber", {"unique": True}),
        (database.invoices, [("userId", 1), ("createdAt", -1)], {}),
        (database.credit_ledger, [("userId", 1), ("createdAt", -1)], {}),
        (database.audit_logs, [("userId", 1), ("createdAt", -1)], {}),
        (database.subscriptions, "id", {"unique": True}),
        (database.subscriptions, [("userId", 1), ("status", 1)], {}),
    ]



    for col, keys, opts in indexes:
        try:
            await col.create_index(keys, **opts)
        except Exception:
            pass




def close_db() -> None:
    client.close()
