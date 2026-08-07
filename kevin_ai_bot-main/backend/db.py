from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from config import get_settings


settings = get_settings()
client = AsyncIOMotorClient(settings.mongo_url)
database: AsyncIOMotorDatabase = client[settings.db_name]


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
