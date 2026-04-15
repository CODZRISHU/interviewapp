from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from config import get_settings


settings = get_settings()
client = AsyncIOMotorClient(settings.mongo_url)
database: AsyncIOMotorDatabase = client[settings.db_name]


async def ensure_indexes() -> None:
    await database.users.create_index("email", unique=True)
    await database.users.create_index("id", unique=True)
    await database.users.create_index([("planKey", 1), ("billingStatus", 1)])
    await database.users.create_index([("creditsRemaining", -1), ("creditsUsed", -1)])
    await database.users.create_index("providerCustomerId", sparse=True)
    await database.users.create_index("providerSubscriptionId", sparse=True)
    await database.users.create_index("providerPaymentLinkId", sparse=True)
    await database.interviews.create_index("id", unique=True)
    await database.interviews.create_index([("userId", 1), ("createdAt", -1)])
    await database.interviews.create_index([("userId", 1), ("status", 1), ("createdAt", -1)])
    await database.reports.create_index("id", unique=True)
    await database.reports.create_index([("userId", 1), ("createdAt", -1)])
    await database.reports.create_index([("interviewId", 1), ("createdAt", -1)])
    await database.refresh_tokens.create_index("tokenId", unique=True)
    await database.refresh_tokens.create_index("userId")
    await database.refresh_tokens.create_index("expiresAt", expireAfterSeconds=0)
    await database.billing_events.create_index("eventId", unique=True)
    await database.analytics_events.create_index([("userId", 1), ("createdAt", -1)])


def close_db() -> None:
    client.close()
