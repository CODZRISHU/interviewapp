from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    email: EmailStr
    plan: Literal["free", "launch", "starter", "pro", "addon"] = "free"
    planKey: str = "free_trial"
    billingStatus: Literal["trial_available", "trial_used", "active", "past_due", "cancelled", "expired"] = "trial_available"
    usageCount: int = 0
    totalCredits: int = 1
    creditsUsed: int = 0
    creditsRemaining: int = 1
    trialUsed: bool = False
    bonusCreditsBalance: int = 0
    subscriptionEnd: Optional[datetime] = None
    currentPeriodStart: Optional[datetime] = None
    currentPeriodEnd: Optional[datetime] = None
    paymentProvider: Optional[str] = None
    providerCustomerId: Optional[str] = None
    providerSubscriptionId: Optional[str] = None
    cancelAtPeriodEnd: bool = False
    fairUsagePolicy: bool = True
    createdAt: datetime
    resumeFilename: str = ""
    resumeText: str = ""
    entitlements: Optional[Dict[str, Any]] = None


class AuthResponse(BaseModel):
    user: UserResponse
    tokens: TokenPair


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return " ".join(value.strip().split())


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(min_length=10)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10)


class InterviewConfig(BaseModel):
    interview_type: Literal["technical", "behavioural", "mixed"] = "mixed"
    level: Literal["fresher", "mid", "senior"] = "fresher"
    role: str = Field(min_length=2, max_length=120)
    duration: int = Field(default=15, ge=10, le=60)

    @field_validator("role")
    @classmethod
    def clean_role(cls, value: str) -> str:
        return " ".join(value.strip().split())


class NextQuestionRequest(BaseModel):
    interview_id: str = Field(min_length=4, max_length=64)
    user_answer: str = Field(min_length=1, max_length=4000)


class EndInterviewRequest(BaseModel):
    interview_id: str = Field(min_length=4, max_length=64)


class StructuredResume(BaseModel):
    skills: List[str] = Field(default_factory=list)
    projects: List[Dict[str, Any]] = Field(default_factory=list)
    experience: List[Dict[str, Any]] = Field(default_factory=list)
    education: List[Dict[str, Any]] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)


class InterviewState(BaseModel):
    current_question: int = 0
    total_questions: int = 8
    covered_sections: Dict[str, int] = Field(default_factory=dict)
    question_plan: Dict[str, Any] = Field(default_factory=dict)
    config: Dict[str, Any] = Field(default_factory=dict)
    current_section: str = "introduction"
    interview_phase: str = "introduction"
    meaningful_responses: int = 0
    empty_responses: int = 0


class ResumeResponse(BaseModel):
    resumeText: str = ""
    resumeFilename: str = ""
    structuredResume: Optional[StructuredResume] = None


class CheckoutRequest(BaseModel):
    itemKey: Literal["launch_offer", "starter_monthly", "pro_monthly", "topup_5", "topup_10"]


class BillingPortalResponse(BaseModel):
    portalUrl: Optional[str] = None
    provider: str
    message: str


class PlanSummary(BaseModel):
    key: str
    purchaseType: Literal["plan", "addon"]
    billingModel: Literal["trial", "one_time", "subscription"]
    displayName: str
    amountInr: int
    credits: int
    maxDurationMinutes: int
    planGroup: str
    tag: Optional[str] = None
    highlighted: bool = False
    isLimited: bool = False
    trialOnly: bool = False
    validForDays: Optional[int] = None
    strikeThroughAmountInr: Optional[int] = None
    scarcityText: Optional[str] = None
    urgencyText: Optional[str] = None
    savingsText: Optional[str] = None
    fairUsagePolicy: bool = True


class SubscriptionSummary(BaseModel):
    planKey: str
    billingStatus: str
    providerCustomerId: Optional[str] = None
    providerSubscriptionId: Optional[str] = None
    providerPaymentLinkId: Optional[str] = None
    currentPeriodStart: Optional[datetime] = None
    currentPeriodEnd: Optional[datetime] = None
    cancelAtPeriodEnd: bool = False


class BillingSnapshotResponse(BaseModel):
    subscription: SubscriptionSummary
    entitlements: Dict[str, Any]
    plans: List[PlanSummary]
    addons: List[PlanSummary]
    meta: Dict[str, Any]
    razorpayKeyId: str = ""
