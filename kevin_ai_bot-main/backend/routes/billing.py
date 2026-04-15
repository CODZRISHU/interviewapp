from fastapi import APIRouter, Depends, Header, Request

from controllers.dependencies import get_current_user
from models.schemas import BillingPortalResponse, BillingSnapshotResponse, CheckoutRequest
from services.billing_service import (
    cancel_subscription,
    create_checkout_session,
    create_management_link,
    get_public_catalog,
    get_user_billing_snapshot,
    sync_subscription_from_webhook,
    verify_webhook_signature,
)


router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/plans")
async def plans():
    return await get_public_catalog()


@router.get("/subscription", response_model=BillingSnapshotResponse)
async def subscription(user=Depends(get_current_user)):
    return await get_user_billing_snapshot(user)


@router.post("/checkout")
async def checkout(payload: CheckoutRequest, user=Depends(get_current_user)):
    return await create_checkout_session(payload.itemKey, user)


@router.post("/cancel")
async def cancel(user=Depends(get_current_user)):
    return await cancel_subscription(user)


@router.post("/portal", response_model=BillingPortalResponse)
async def portal(user=Depends(get_current_user)):
    return await create_management_link(user)


@router.post("/webhook")
async def webhook(
    request: Request,
    x_razorpay_signature: str | None = Header(default=None),
):
    raw_body = await request.body()
    verify_webhook_signature(raw_body, x_razorpay_signature)
    return await sync_subscription_from_webhook(await request.json())
