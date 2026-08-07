from typing import Optional
from fastapi import APIRouter, Depends, Header, Query, Request, Response
from fastapi.responses import StreamingResponse

from controllers.dependencies import get_current_user
from models.schemas import BillingSnapshotResponse, CheckoutRequest, VerifyPaymentRequest
from services.billing_service import (
    create_razorpay_order,
    download_invoice_pdf,
    export_admin_payments_csv,
    get_admin_payment_analytics,
    get_admin_payments,
    get_public_catalog,
    get_user_billing_snapshot,
    get_user_payment_history,
    verify_razorpay_payment,
)


router = APIRouter(prefix="/billing", tags=["billing"])
admin_router = APIRouter(prefix="/admin/payments", tags=["admin-payments"])


@router.get("/plans")
async def plans():
    return await get_public_catalog()


@router.get("/subscription", response_model=BillingSnapshotResponse)
async def subscription(user=Depends(get_current_user)):
    return await get_user_billing_snapshot(user)


@router.post("/create-order")
async def create_order(payload: CheckoutRequest, user=Depends(get_current_user)):
    return await create_razorpay_order(payload.itemKey, user)


@router.post("/verify-payment")
async def verify_payment(payload: VerifyPaymentRequest, user=Depends(get_current_user)):
    return await verify_razorpay_payment(
        user=user,
        order_id=payload.razorpay_order_id,
        payment_id=payload.razorpay_payment_id,
        signature=payload.razorpay_signature,
        plan_key=payload.plan_key,
    )


@router.get("/history")
async def payment_history(user=Depends(get_current_user)):
    return await get_user_payment_history(user["id"])


@router.get("/invoices/{invoice_number}/pdf")
async def get_invoice_pdf(invoice_number: str, user=Depends(get_current_user)):
    pdf_bytes = await download_invoice_pdf(user["id"], invoice_number)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Invoice_{invoice_number}.pdf"},
    )


# Admin Payments Endpoints
@admin_router.get("")
async def list_admin_payments(
    status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    user=Depends(get_current_user),
):
    return await get_admin_payments(status_filter=status, search=search)


@admin_router.get("/analytics")
async def payment_analytics(user=Depends(get_current_user)):
    return await get_admin_payment_analytics()


@admin_router.get("/export")
async def export_payments_csv(user=Depends(get_current_user)):
    return await export_admin_payments_csv()
