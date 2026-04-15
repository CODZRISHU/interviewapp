import base64
import hashlib
import hmac
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, Literal, Optional

import httpx
from fastapi import HTTPException, status

from config import get_settings
from db import database
from utils.helpers import utc_now


settings = get_settings()

PlanType = Literal["trial", "one_time", "subscription"]
PurchaseType = Literal["plan", "addon"]


@dataclass(frozen=True)
class PurchaseItem:
    key: str
    purchase_type: PurchaseType
    billing_model: PlanType
    display_name: str
    amount_inr: int
    credits: int
    max_duration_minutes: int
    plan_group: str
    tag: str = ""
    highlighted: bool = False
    is_limited: bool = False
    trial_only: bool = False
    valid_for_days: Optional[int] = None
    strike_through_amount_inr: Optional[int] = None
    scarcity_text: Optional[str] = None
    urgency_text: Optional[str] = None
    savings_text: Optional[str] = None
    fair_usage_policy: bool = True


LAUNCH_OFFER_SPOT_LIMIT = 1000
LAUNCH_OFFER_DISPLAY_REMAINING = 300
LAUNCH_OFFER_WINDOW_DAYS = 45


PURCHASE_ITEMS: Dict[str, PurchaseItem] = {
    "free_trial": PurchaseItem(
        key="free_trial",
        purchase_type="plan",
        billing_model="trial",
        display_name="Free Trial",
        amount_inr=0,
        credits=1,
        max_duration_minutes=10,
        plan_group="free",
        trial_only=True,
        fair_usage_policy=True,
    ),
    "launch_offer": PurchaseItem(
        key="launch_offer",
        purchase_type="plan",
        billing_model="one_time",
        display_name="Launch Offer",
        amount_inr=99,
        credits=10,
        max_duration_minutes=15,
        plan_group="launch",
        tag="Early Bird Offer",
        highlighted=True,
        is_limited=True,
        valid_for_days=LAUNCH_OFFER_WINDOW_DAYS,
        strike_through_amount_inr=399,
        scarcity_text="Only 300 early bird spots left",
        urgency_text="Offer ends soon",
        savings_text="Save 75% today",
        fair_usage_policy=True,
    ),
    "starter_monthly": PurchaseItem(
        key="starter_monthly",
        purchase_type="plan",
        billing_model="subscription",
        display_name="Starter",
        amount_inr=149,
        credits=6,
        max_duration_minutes=15,
        plan_group="starter",
        fair_usage_policy=True,
    ),
    "pro_monthly": PurchaseItem(
        key="pro_monthly",
        purchase_type="plan",
        billing_model="subscription",
        display_name="Pro",
        amount_inr=399,
        credits=25,
        max_duration_minutes=30,
        plan_group="pro",
        tag="Most Popular",
        highlighted=True,
        fair_usage_policy=True,
    ),
    "topup_5": PurchaseItem(
        key="topup_5",
        purchase_type="addon",
        billing_model="one_time",
        display_name="5 Credits",
        amount_inr=99,
        credits=5,
        max_duration_minutes=15,
        plan_group="addon",
        fair_usage_policy=True,
    ),
    "topup_10": PurchaseItem(
        key="topup_10",
        purchase_type="addon",
        billing_model="one_time",
        display_name="10 Credits",
        amount_inr=179,
        credits=10,
        max_duration_minutes=15,
        plan_group="addon",
        fair_usage_policy=True,
    ),
}

SUBSCRIPTION_PLAN_KEYS = {"starter_monthly", "pro_monthly"}
ADDON_KEYS = {"topup_5", "topup_10"}
BILLING_STATUSES = {"trial_available", "trial_used", "active", "past_due", "cancelled", "expired"}
SOFT_UPSELL_THRESHOLD = 2


def get_purchase_item(item_key: str) -> PurchaseItem:
    item = PURCHASE_ITEMS.get(item_key)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown purchase item.")
    return item


def _now() -> datetime:
    return utc_now()


def _timestamp_to_datetime(value: Any) -> Optional[datetime]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromtimestamp(int(value), tz=_now().tzinfo)
    except Exception:
        return None


def _build_basic_auth_header() -> str:
    raw = f"{settings.razorpay_key_id}:{settings.razorpay_key_secret}".encode("utf-8")
    return f"Basic {base64.b64encode(raw).decode('utf-8')}"


def _strip_none(payload: dict) -> dict:
    return {key: value for key, value in payload.items() if value is not None}


def _plan_to_public_dict(item: PurchaseItem, *, early_bird_remaining: int) -> dict:
    payload = asdict(item)
    payload["displayName"] = payload.pop("display_name")
    payload["purchaseType"] = payload.pop("purchase_type")
    payload["billingModel"] = payload.pop("billing_model")
    payload["amountInr"] = payload.pop("amount_inr")
    payload["maxDurationMinutes"] = payload.pop("max_duration_minutes")
    payload["planGroup"] = payload.pop("plan_group")
    payload["validForDays"] = payload.pop("valid_for_days")
    payload["strikeThroughAmountInr"] = payload.pop("strike_through_amount_inr")
    payload["isLimited"] = payload.pop("is_limited")
    payload["trialOnly"] = payload.pop("trial_only")
    payload["fairUsagePolicy"] = payload.pop("fair_usage_policy")
    if item.key == "launch_offer":
        payload["scarcityText"] = f"Only {early_bird_remaining} early bird spots left"
    return _strip_none(payload)


async def _count_launch_offer_claims() -> int:
    return await database.users.count_documents({"launchOfferPurchasedAt": {"$ne": None}})


async def _get_launch_offer_remaining() -> int:
    sold = await _count_launch_offer_claims()
    if sold <= 0:
        return LAUNCH_OFFER_DISPLAY_REMAINING
    return max(LAUNCH_OFFER_SPOT_LIMIT - sold, 0)


async def get_public_catalog() -> dict:
    early_bird_remaining = await _get_launch_offer_remaining()
    plans = [
        _plan_to_public_dict(PURCHASE_ITEMS[key], early_bird_remaining=early_bird_remaining)
        for key in ["free_trial", "launch_offer", "starter_monthly", "pro_monthly"]
    ]
    addons = [
        _plan_to_public_dict(PURCHASE_ITEMS[key], early_bird_remaining=early_bird_remaining)
        for key in ["topup_5", "topup_10"]
    ]
    return {
        "plans": plans,
        "addons": addons,
        "meta": {
            "softUpsellThreshold": SOFT_UPSELL_THRESHOLD,
            "launchOfferSpotsRemaining": early_bird_remaining,
            "launchOfferEndsInDays": LAUNCH_OFFER_WINDOW_DAYS,
        },
    }


def _default_credit_fields() -> dict:
    return {
        "planKey": "free_trial",
        "billingStatus": "trial_available",
        "trialUsed": False,
        "totalCredits": 1,
        "creditsUsed": 0,
        "creditsRemaining": 1,
        "bonusCreditsBalance": 0,
        "providerCustomerId": None,
        "providerSubscriptionId": None,
        "providerPaymentLinkId": None,
        "providerSubscriptionShortUrl": None,
        "currentPeriodStart": None,
        "currentPeriodEnd": None,
        "paymentProvider": None,
        "cancelAtPeriodEnd": False,
        "fairUsagePolicy": True,
        "launchOfferPurchasedAt": None,
    }


def normalize_user_billing_document(user: dict) -> dict:
    defaults = _default_credit_fields()
    return {
        key: user.get(key, value)
        for key, value in defaults.items()
    }


def _plan_status_for_user(user: dict) -> str:
    if user.get("billingStatus") in BILLING_STATUSES:
        return user["billingStatus"]
    return "trial_used" if user.get("trialUsed") else "trial_available"


async def reconcile_user_billing_state(user: dict) -> dict:
    snapshot = normalize_user_billing_document(user)
    now = _now()
    updates: Dict[str, Any] = {}
    status_value = _plan_status_for_user(snapshot)
    current_period_end = snapshot.get("currentPeriodEnd")

    if status_value in {"active", "cancelled"} and current_period_end and current_period_end <= now:
        if snapshot["planKey"] in SUBSCRIPTION_PLAN_KEYS:
            status_value = "expired"
            updates.update(
                {
                    "billingStatus": "expired",
                    "planKey": "free_trial" if snapshot["creditsRemaining"] <= snapshot["bonusCreditsBalance"] else snapshot["planKey"],
                    "currentPeriodStart": None,
                    "currentPeriodEnd": None,
                    "cancelAtPeriodEnd": False,
                }
            )

    if snapshot["planKey"] == "free_trial" and snapshot["trialUsed"] and snapshot["creditsRemaining"] <= 0:
        status_value = "trial_used"
        updates["billingStatus"] = "trial_used"

    if updates:
        await database.users.update_one({"id": user["id"]}, {"$set": updates})
        user = {**user, **updates}

    return {**user, **normalize_user_billing_document({**user, "billingStatus": status_value})}


def _derive_plan_context(user: dict) -> PurchaseItem:
    plan_key = user.get("planKey") or "free_trial"
    item = PURCHASE_ITEMS.get(plan_key, PURCHASE_ITEMS["free_trial"])
    if item.billing_model == "subscription" and user.get("billingStatus") not in {"active", "cancelled"}:
        if user.get("bonusCreditsBalance", 0) > 0:
            return PURCHASE_ITEMS["starter_monthly"]
        return PURCHASE_ITEMS["free_trial"]
    if item.key == "free_trial" and user.get("bonusCreditsBalance", 0) > 0:
        return PURCHASE_ITEMS["starter_monthly"]
    return item


def build_entitlements(user: dict) -> dict:
    snapshot = normalize_user_billing_document(user)
    current_item = _derive_plan_context(snapshot)
    remaining = int(snapshot.get("creditsRemaining", 0))
    soft_upsell = int(snapshot.get("creditsUsed", 0)) >= SOFT_UPSELL_THRESHOLD and current_item.key != "pro_monthly"
    launch_remaining = max(LAUNCH_OFFER_SPOT_LIMIT - 1, 0)

    return {
        "planKey": snapshot["planKey"],
        "planGroup": current_item.plan_group,
        "billingStatus": _plan_status_for_user(snapshot),
        "totalCredits": int(snapshot.get("totalCredits", 0)),
        "usedCredits": int(snapshot.get("creditsUsed", 0)),
        "remainingCredits": remaining,
        "bonusCreditsBalance": int(snapshot.get("bonusCreditsBalance", 0)),
        "maxDurationMinutes": current_item.max_duration_minutes,
        "canStartInterview": remaining > 0,
        "trialAvailable": not snapshot.get("trialUsed", False),
        "trialUsed": bool(snapshot.get("trialUsed", False)),
        "nextBillingDate": snapshot.get("currentPeriodEnd"),
        "currentPeriodStart": snapshot.get("currentPeriodStart"),
        "softUpsellEligible": soft_upsell,
        "softUpsellThreshold": SOFT_UPSELL_THRESHOLD,
        "fairUsagePolicy": True,
        "launchOfferSpotsRemaining": launch_remaining,
        "showUpgradeNudge": remaining <= 2 or soft_upsell,
        "creditProgressPercent": 0 if snapshot.get("totalCredits", 0) <= 0 else round((int(snapshot.get("creditsUsed", 0)) / max(int(snapshot.get("totalCredits", 1)), 1)) * 100),
        "upsellMessage": "Unlock more interviews and detailed feedback" if remaining <= 0 or soft_upsell else None,
    }


async def get_user_billing_snapshot(user: dict) -> dict:
    refreshed_user = await reconcile_user_billing_state(user)
    catalog = await get_public_catalog()
    return {
        "subscription": {
            "planKey": refreshed_user.get("planKey", "free_trial"),
            "billingStatus": refreshed_user.get("billingStatus", "trial_available"),
            "providerCustomerId": refreshed_user.get("providerCustomerId"),
            "providerSubscriptionId": refreshed_user.get("providerSubscriptionId"),
            "providerPaymentLinkId": refreshed_user.get("providerPaymentLinkId"),
            "currentPeriodStart": refreshed_user.get("currentPeriodStart"),
            "currentPeriodEnd": refreshed_user.get("currentPeriodEnd"),
            "cancelAtPeriodEnd": refreshed_user.get("cancelAtPeriodEnd", False),
        },
        "entitlements": build_entitlements(refreshed_user),
        "plans": catalog["plans"],
        "addons": catalog["addons"],
        "meta": catalog["meta"],
        "razorpayKeyId": settings.razorpay_key_id or "",
    }


def _ensure_provider_ready() -> None:
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Billing provider is not configured yet.")


def _provider_plan_id(item_key: str) -> Optional[str]:
    mapping = {
        "starter_monthly": settings.razorpay_starter_plan_id,
        "pro_monthly": settings.razorpay_pro_plan_id,
    }
    return mapping.get(item_key)


async def _track_event(user_id: str, event_name: str, properties: Optional[dict] = None) -> None:
    await database.analytics_events.insert_one(
        {
            "userId": user_id,
            "event": event_name,
            "properties": properties or {},
            "createdAt": _now(),
        }
    )


async def _mark_event_processed(event_id: Optional[str]) -> bool:
    if not event_id:
        return False
    existing = await database.billing_events.find_one({"eventId": event_id})
    if existing:
        return True
    await database.billing_events.insert_one({"eventId": event_id, "processedAt": _now()})
    return False


async def _launch_offer_available() -> bool:
    sold = await _count_launch_offer_claims()
    return sold < LAUNCH_OFFER_SPOT_LIMIT


async def create_checkout_session(item_key: str, user: dict) -> dict:
    _ensure_provider_ready()
    user = await reconcile_user_billing_state(user)
    item = get_purchase_item(item_key)

    if item.key == "free_trial":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Free trial does not require checkout.")
    if item.key == "launch_offer" and user.get("launchOfferPurchasedAt"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Launch offer can only be purchased once.")
    if item.key == "launch_offer" and not await _launch_offer_available():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Launch offer is no longer available.")

    headers = {
        "Authorization": _build_basic_auth_header(),
        "Content-Type": "application/json",
    }

    if item.billing_model == "subscription":
        provider_plan_id = _provider_plan_id(item.key)
        if not provider_plan_id:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Selected subscription plan is not configured yet.")
        payload = {
            "plan_id": provider_plan_id,
            "total_count": 60,
            "quantity": 1,
            "customer_notify": 1,
            "notes": {
                "userId": user["id"],
                "email": user["email"],
                "itemKey": item.key,
                "purchaseType": item.purchase_type,
            },
        }
        endpoint = "https://api.razorpay.com/v1/subscriptions"
    else:
        payload = {
            "amount": item.amount_inr * 100,
            "currency": "INR",
            "description": f"{item.display_name} for Kevin AI",
            "customer": {"name": user["name"], "email": user["email"]},
            "notify": {"sms": False, "email": True},
            "callback_url": f"{settings.public_app_url.rstrip('/')}/profile",
            "callback_method": "get",
            "notes": {
                "userId": user["id"],
                "email": user["email"],
                "itemKey": item.key,
                "purchaseType": item.purchase_type,
            },
        }
        endpoint = "https://api.razorpay.com/v1/payment_links"

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(endpoint, headers=headers, json=payload)

    if response.status_code >= 400:
        detail = response.json().get("error", {}).get("description") if response.headers.get("content-type", "").startswith("application/json") else response.text
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail or "Unable to create checkout session.")

    data = response.json()
    update_payload = {
        "paymentProvider": "razorpay",
        "providerSubscriptionShortUrl": data.get("short_url"),
    }
    if item.billing_model == "subscription":
        update_payload.update({
            "providerSubscriptionId": data.get("id"),
            "billingStatus": "past_due",
        })
    else:
        update_payload["providerPaymentLinkId"] = data.get("id")

    await database.users.update_one({"id": user["id"]}, {"$set": update_payload})
    await _track_event(user["id"], "upgrade_clicked", {"itemKey": item.key, "purchaseType": item.purchase_type})

    return {
        "checkoutUrl": data.get("short_url"),
        "provider": "razorpay",
        "itemKey": item.key,
        "purchaseType": item.purchase_type,
        "message": "Checkout session created.",
    }


async def cancel_subscription(user: dict) -> dict:
    _ensure_provider_ready()
    user = await reconcile_user_billing_state(user)
    provider_subscription_id = user.get("providerSubscriptionId")
    if not provider_subscription_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active subscription found.")

    headers = {
        "Authorization": _build_basic_auth_header(),
        "Content-Type": "application/json",
    }
    url = f"https://api.razorpay.com/v1/subscriptions/{provider_subscription_id}/cancel"
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(url, headers=headers, json={"cancel_at_cycle_end": 1})

    if response.status_code >= 400:
        detail = response.json().get("error", {}).get("description") if response.headers.get("content-type", "").startswith("application/json") else response.text
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail or "Unable to cancel subscription.")

    data = response.json()
    current_end = _timestamp_to_datetime(data.get("current_end")) or user.get("currentPeriodEnd")
    await database.users.update_one(
        {"id": user["id"]},
        {"$set": {"billingStatus": "cancelled", "cancelAtPeriodEnd": True, "currentPeriodEnd": current_end}},
    )
    return {"message": "Subscription will cancel at the end of the current billing period."}


async def create_management_link(user: dict) -> dict:
    if settings.razorpay_portal_url and user.get("providerSubscriptionId"):
        return {
            "portalUrl": f"{settings.razorpay_portal_url.rstrip('/')}/{user['providerSubscriptionId']}",
            "provider": "razorpay",
            "message": "Manage your subscription in Razorpay.",
        }
    return {
        "portalUrl": None,
        "provider": "razorpay",
        "message": f"Hosted portal not configured. Contact {settings.support_email} for billing changes.",
    }


def verify_webhook_signature(raw_body: bytes, signature: Optional[str]) -> None:
    if not settings.razorpay_webhook_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Webhook secret is not configured.")
    if not signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing webhook signature.")
    expected = hmac.new(settings.razorpay_webhook_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature.")


async def _apply_paid_item_to_user(user: dict, item_key: str, *, period_start: Optional[datetime] = None, period_end: Optional[datetime] = None, provider_subscription_id: Optional[str] = None, provider_customer_id: Optional[str] = None) -> None:
    item = get_purchase_item(item_key)
    user = await reconcile_user_billing_state(user)
    updates: Dict[str, Any] = {
        "paymentProvider": "razorpay",
        "providerCustomerId": provider_customer_id or user.get("providerCustomerId"),
    }

    if item.purchase_type == "addon":
        updates["bonusCreditsBalance"] = int(user.get("bonusCreditsBalance", 0)) + item.credits
        updates["creditsRemaining"] = int(user.get("creditsRemaining", 0)) + item.credits
        updates["totalCredits"] = int(user.get("totalCredits", 0)) + item.credits
    elif item.key == "launch_offer":
        updates.update(
            {
                "planKey": item.key,
                "billingStatus": "active",
                "currentPeriodStart": None,
                "currentPeriodEnd": None,
                "totalCredits": item.credits + int(user.get("bonusCreditsBalance", 0)),
                "creditsUsed": 0,
                "creditsRemaining": item.credits + int(user.get("bonusCreditsBalance", 0)),
                "launchOfferPurchasedAt": _now(),
                "providerSubscriptionId": None,
                "cancelAtPeriodEnd": False,
            }
        )
    else:
        updates.update(
            {
                "planKey": item.key,
                "billingStatus": "active",
                "providerSubscriptionId": provider_subscription_id or user.get("providerSubscriptionId"),
                "currentPeriodStart": period_start or _now(),
                "currentPeriodEnd": period_end or (_now() + timedelta(days=30)),
                "totalCredits": item.credits + int(user.get("bonusCreditsBalance", 0)),
                "creditsUsed": 0,
                "creditsRemaining": item.credits + int(user.get("bonusCreditsBalance", 0)),
                "cancelAtPeriodEnd": False,
            }
        )

    await database.users.update_one({"id": user["id"]}, {"$set": updates})
    await _track_event(user["id"], "payment_success", {"itemKey": item.key, "purchaseType": item.purchase_type})


def _extract_item_from_event(event: dict) -> tuple[Optional[str], Optional[str], dict]:
    payload = event.get("payload", {})
    subscription_entity = payload.get("subscription", {}).get("entity", {})
    payment_entity = payload.get("payment", {}).get("entity", {})
    payment_link_entity = payload.get("payment_link", {}).get("entity", {})
    notes = subscription_entity.get("notes") or payment_entity.get("notes") or payment_link_entity.get("notes") or {}
    item_key = notes.get("itemKey")
    purchase_type = notes.get("purchaseType")
    return item_key, purchase_type, notes


async def sync_subscription_from_webhook(event: dict) -> dict:
    event_id = event.get("event_id") or event.get("payload", {}).get("payment", {}).get("entity", {}).get("id")
    if event_id and await _mark_event_processed(event_id):
        return {"processed": True, "duplicate": True}

    event_name = event.get("event")
    item_key, purchase_type, notes = _extract_item_from_event(event)
    user_id = notes.get("userId")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook payload missing user id.")

    user = await database.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User for webhook event not found.")

    subscription_entity = event.get("payload", {}).get("subscription", {}).get("entity", {})
    payment_entity = event.get("payload", {}).get("payment", {}).get("entity", {})

    if event_name in {"payment_success", "payment.captured", "subscription.charged", "subscription.activated"}:
        if not item_key:
            item_key = notes.get("itemKey") or user.get("planKey") or "starter_monthly"
        await _apply_paid_item_to_user(
            user,
            item_key,
            period_start=_timestamp_to_datetime(subscription_entity.get("current_start")),
            period_end=_timestamp_to_datetime(subscription_entity.get("current_end")),
            provider_subscription_id=subscription_entity.get("id"),
            provider_customer_id=subscription_entity.get("customer_id") or payment_entity.get("customer_id"),
        )
    elif event_name in {"payment_failed", "subscription.halted", "payment.failed"}:
        await database.users.update_one({"id": user_id}, {"$set": {"billingStatus": "past_due"}})
    elif event_name in {"subscription_cancelled", "subscription.cancelled"}:
        await database.users.update_one({"id": user_id}, {"$set": {"billingStatus": "cancelled", "cancelAtPeriodEnd": True}})
    else:
        return {"processed": False, "ignored": True, "event": event_name}

    return {"processed": True, "duplicate": False, "event": event_name, "purchaseType": purchase_type, "itemKey": item_key}


async def ensure_interview_access(user: dict, duration_minutes: int) -> tuple[dict, dict]:
    user = await reconcile_user_billing_state(user)
    entitlements = build_entitlements(user)

    if entitlements["remainingCredits"] <= 0:
        await _track_event(user["id"], "credits_exhausted", {"planKey": user.get("planKey")})
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You have no credits left. Upgrade or buy add-on credits to continue.",
        )

    if duration_minutes > entitlements["maxDurationMinutes"]:
        message = "Upgrade to Pro to unlock 30 min interviews." if duration_minutes >= 30 else f"Your current plan supports up to {entitlements['maxDurationMinutes']} minutes."
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)

    return user, entitlements


async def consume_credit(user: dict) -> dict:
    user = await reconcile_user_billing_state(user)
    remaining = int(user.get("creditsRemaining", 0))
    if remaining <= 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You have no credits left.")

    bonus_balance = int(user.get("bonusCreditsBalance", 0))
    next_remaining = remaining - 1
    next_used = int(user.get("creditsUsed", 0)) + 1
    next_total = int(user.get("totalCredits", 0))
    updates = {
        "creditsRemaining": next_remaining,
        "creditsUsed": next_used,
    }

    if remaining <= bonus_balance:
        updates["bonusCreditsBalance"] = max(bonus_balance - 1, 0)
        updates["totalCredits"] = max(next_total - 1, 0)

    if user.get("planKey") == "free_trial":
        updates.update({"trialUsed": True, "billingStatus": "trial_used"})

    result = await database.users.update_one(
        {"id": user["id"], "creditsRemaining": {"$gt": 0}},
        {"$set": updates},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Unable to reserve credit. Please try again.")
    return updates
