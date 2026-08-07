import asyncio
import logging
from datetime import datetime

from db import database
from utils.helpers import utc_now


logger = logging.getLogger(__name__)


async def check_expired_subscriptions() -> int:
    try:
        now = utc_now()
        expired_users = await database.users.find(
            {
                "billingStatus": {"$in": ["active", "cancelled"]},
                "currentPeriodEnd": {"$lte": now},
            }
        ).to_list(500)

        count = 0
        for u in expired_users:
            await database.users.update_one(
                {"id": u["id"]},
                {
                    "$set": {
                        "billingStatus": "expired",
                        "cancelAtPeriodEnd": False,
                    }
                },
            )
            await database.audit_logs.insert_one(
                {
                    "userId": u["id"],
                    "action": "subscription_expired_scheduler",
                    "createdAt": now,
                }
            )
            count += 1

        if count > 0:
            logger.info(f"[Scheduler] Marked {count} subscriptions as expired.")
        return count
    except Exception as e:
        logger.error(f"[Scheduler] Error running subscription expiry check: {e}")
        return 0


async def start_background_scheduler():
    logger.info("[Scheduler] Starting subscription background scheduler...")
    while True:
        await check_expired_subscriptions()
        # Sleep for 1 hour between checks
        await asyncio.sleep(3600)
