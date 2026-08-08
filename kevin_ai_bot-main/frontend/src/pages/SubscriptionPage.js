import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { Check, Sparkles, Shield, Clock, Award, Flame, Lock, Zap, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function formatDate(dtValue) {
  if (!dtValue) return "Subscription Expiry Date";
  try {
    const dt = new Date(dtValue);
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  } catch (e) {
    return String(dtValue);
  }
}

export default function SubscriptionPage() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState("plans");
  const [plans, setPlans] = useState([]);
  const [topups, setTopups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasingItem, setPurchasingItem] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const res = await api.get("/billing/plans");
      setPlans(res.data.plans || []);
      setTopups(res.data.topups || res.data.addons || []);
    } catch (err) {
      toast.error("Failed to load catalog.");
    } finally {
      setLoading(false);
    }
  };

  const verifyAndActivate = async (orderId, paymentId, signature, itemKey) => {
    try {
      toast.loading("Verifying payment with server...");
      const verifyRes = await api.post("/billing/verify-payment", {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        plan_key: itemKey,
      });

      toast.dismiss();
      toast.success(verifyRes.data.message || "Payment processed successfully!");
      await refreshUser();
      navigate("/dashboard");
    } catch (err) {
      toast.dismiss();
      toast.error(err.response?.data?.detail || "Payment verification failed.");
    } finally {
      setPurchasingItem(null);
    }
  };

  const handlePurchase = async (itemKey) => {
    if (itemKey === "free_trial") {
      toast.info("You are currently on the Free Plan.");
      return;
    }

    try {
      setPurchasingItem(itemKey);
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        toast.error("Failed to load Razorpay payment SDK.");
        setPurchasingItem(null);
        return;
      }

      const res = await api.post("/billing/create-order", { itemKey });
      const order = res.data;

      const options = {
        key: order.keyId || "rzp_test_SbTSWFTWLhZTa1",
        amount: order.amountPaise,
        currency: order.currency || "INR",
        name: "Kevin AI",
        description: `${order.planName} Checkout`,
        order_id: order.orderId?.startsWith("order_mock_") ? undefined : order.orderId,
        prefill: {
          name: order.user?.name || user?.name || "",
          email: order.user?.email || user?.email || "",
        },
        theme: {
          color: "#E50914",
        },
        handler: async function (response) {
          await verifyAndActivate(
            response.razorpay_order_id || order.orderId,
            response.razorpay_payment_id || `pay_${Date.now()}`,
            response.razorpay_signature || "signature_ok",
            itemKey
          );
        },
        modal: {
          ondismiss: function () {
            setPurchasingItem(null);
            toast.info("Payment cancelled.");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Unable to initiate checkout.");
      setPurchasingItem(null);
    }
  };

  const currentPlanKey = user?.planKey || "free_trial";
  const billingStatus = user?.billingStatus || "trial_available";
  const hasActiveMainPlan = billingStatus === "active" && currentPlanKey !== "free_trial";
  const mainPlanExpiry = user?.currentPeriodEnd || user?.subscriptionEnd;

  const topupEligibility = user?.entitlements?.topupEligibility || {
    eligible: false,
    scenario: "D",
    message: "Subscribe to a plan first to unlock top-ups.",
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-10 space-y-10">
      {/* Header */}
      <div className="max-w-6xl mx-auto text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E50914]/10 border border-[#E50914]/30 text-[#E50914] text-xs font-semibold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" /> Kevin AI Subscription & Top-Ups
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight" style={{ fontFamily: "Outfit" }}>
          Choose your <span className="text-[#E50914]">Preparation Tier</span>
        </h1>
        <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto font-light">
          Manage your main subscription or recharge top-up credits when your plan credits are exhausted.
        </p>

        {/* Tab Switcher */}
        <div className="pt-4 flex justify-center">
          <div className="p-1 rounded-2xl bg-black/60 border border-white/10 inline-flex gap-2">
            <button
              onClick={() => setActiveTab("plans")}
              className={`px-8 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                activeTab === "plans"
                  ? "netflix-btn-red shadow-lg text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Award className="w-4 h-4" /> Subscription Plans
            </button>
            <button
              onClick={() => setActiveTab("topup")}
              className={`px-8 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                activeTab === "topup"
                  ? "netflix-btn-red shadow-lg text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Zap className="w-4 h-4" /> Top-Up Recharge
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: SUBSCRIPTION PLANS */}
      {activeTab === "plans" && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Free Plan */}
          <div className="netflix-card rounded-3xl p-8 flex flex-col justify-between relative">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Default Trial</span>
                {currentPlanKey === "free_trial" && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/10 text-white border border-white/15">Active Plan</span>
                )}
              </div>
              <h3 className="text-2xl font-bold mb-2 text-white" style={{ fontFamily: "Outfit" }}>Free Plan</h3>
              <p className="text-gray-400 text-xs mb-6">Experience real-time AI mock interviews.</p>
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-extrabold text-white">₹0</span>
                <span className="text-gray-500 text-sm ml-2">/ forever</span>
              </div>

              <div className="space-y-4 mb-8 text-sm text-gray-300">
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                  <span><b>1</b> free 10-minute interview credit</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                  <span>AI detailed feedback & scoring</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                  <span>2-minute duration safety protection</span>
                </div>
              </div>
            </div>

            <button
              disabled={true}
              className="w-full py-3.5 rounded-xl font-bold text-xs bg-white/5 text-gray-400 cursor-not-allowed border border-white/5"
            >
              {currentPlanKey === "free_trial" ? "Current Active Plan" : "Free Plan"}
            </button>
          </div>

          {/* Basic Plan ₹99 */}
          <div className="netflix-card rounded-3xl p-8 flex flex-col justify-between relative border-[#E50914]/30 hover:border-[#E50914]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Starter Pack</span>
                {currentPlanKey === "basic_99" && billingStatus === "active" && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">Active Plan</span>
                )}
              </div>
              <h3 className="text-2xl font-bold mb-2 text-white" style={{ fontFamily: "Outfit" }}>Basic Plan</h3>
              <p className="text-gray-400 text-xs mb-6">Essential interview volume for targeted practice.</p>
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-extrabold text-white">₹99</span>
                <span className="text-gray-500 text-sm ml-2">/ 30 days</span>
                <span className="text-xs text-emerald-400 line-through ml-3">₹199</span>
              </div>

              <div className="space-y-4 mb-8 text-sm text-gray-300">
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                  <span><b>7</b> × 10-minute interviews</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                  <span><b>3</b> × 15-minute interviews</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                  <span>Total <b>10</b> interviews included</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                  <span>Downloadable Tax Invoices</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handlePurchase("basic_99")}
              disabled={purchasingItem === "basic_99" || hasActiveMainPlan}
              className={`w-full py-3.5 rounded-xl font-bold text-xs transition-all ${
                currentPlanKey === "basic_99" && billingStatus === "active"
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30 cursor-default"
                  : hasActiveMainPlan
                  ? "bg-white/5 text-gray-500 cursor-not-allowed border border-white/5"
                  : "netflix-btn-red shadow-lg"
              }`}
            >
              {purchasingItem === "basic_99"
                ? "Opening Razorpay..."
                : currentPlanKey === "basic_99" && billingStatus === "active"
                ? "Current Active Plan"
                : hasActiveMainPlan
                ? "Available after current plan expires"
                : "Subscribe Basic (₹99)"}
            </button>
          </div>

          {/* Premium Plan ₹199 */}
          <div className="netflix-card rounded-3xl p-8 flex flex-col justify-between relative border-2 border-[#E50914] shadow-[0_0_40px_rgba(229,9,20,0.25)]">
            <div className="absolute -top-3.5 right-6 px-3.5 py-1 rounded-full bg-[#E50914] text-white text-[11px] font-extrabold uppercase tracking-wider shadow-lg flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-white" /> Popular Tier
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#E50914]">Full Access</span>
                {currentPlanKey === "premium_199" && billingStatus === "active" && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#E50914]/20 text-[#E50914] border border-[#E50914]/30">Active Plan</span>
                )}
              </div>
              <h3 className="text-2xl font-bold mb-2 text-white" style={{ fontFamily: "Outfit" }}>Premium Plan</h3>
              <p className="text-gray-400 text-xs mb-6">Complete suite for senior & deep technical rounds.</p>
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-extrabold text-white">₹199</span>
                <span className="text-gray-500 text-sm ml-2">/ 30 days</span>
                <span className="text-xs text-emerald-400 line-through ml-3">₹399</span>
              </div>

              <div className="space-y-4 mb-8 text-sm text-gray-200">
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                  <span><b>1</b> × 30-minute full mock interview</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                  <span><b>5</b> × 15-minute interviews</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                  <span><b>5</b> × 10-minute interviews</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                  <span>Priority AI evaluation response time</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handlePurchase("premium_199")}
              disabled={purchasingItem === "premium_199" || hasActiveMainPlan}
              className={`w-full py-3.5 rounded-xl font-bold text-xs transition-all ${
                currentPlanKey === "premium_199" && billingStatus === "active"
                  ? "bg-[#E50914]/20 text-[#E50914] border border-[#E50914]/30 cursor-default"
                  : hasActiveMainPlan
                  ? "bg-white/5 text-gray-500 cursor-not-allowed border border-white/5"
                  : "netflix-btn-red shadow-[0_0_25px_rgba(229,9,20,0.5)]"
              }`}
            >
              {purchasingItem === "premium_199"
                ? "Opening Razorpay..."
                : currentPlanKey === "premium_199" && billingStatus === "active"
                ? "Current Active Plan"
                : hasActiveMainPlan
                ? "Available after current plan expires"
                : "Subscribe Premium (₹199)"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: TOP-UP RECHARGE */}
      {activeTab === "topup" && (
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Status Banner */}
          <div className={`p-4 md:p-6 rounded-3xl border flex items-center gap-4 ${
            topupEligibility.eligible
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-amber-500/10 border-amber-500/30 text-amber-300"
          }`}>
            {topupEligibility.eligible ? (
              <Zap className="w-6 h-6 shrink-0 text-emerald-400" />
            ) : (
              <Lock className="w-6 h-6 shrink-0 text-amber-400" />
            )}
            <div>
              <h4 className="font-bold text-sm" style={{ fontFamily: "Outfit" }}>
                {topupEligibility.eligible ? "Top-Up Available" : "Top-Up Status: Locked"}
              </h4>
              <p className="text-xs text-gray-300 mt-0.5">
                {topupEligibility.message}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* TOP-X ₹59 */}
            <div className="netflix-card rounded-3xl p-8 flex flex-col justify-between relative border-[#E50914]/20 hover:border-[#E50914]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Mini Top-Up</span>
                  <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-white/10 text-gray-300">TOP-X</span>
                </div>
                <h3 className="text-2xl font-bold mb-2 text-white" style={{ fontFamily: "Outfit" }}>TOP-X Pack</h3>
                <p className="text-gray-400 text-xs mb-6">Quick credit refill for urgent practice.</p>
                <div className="flex items-baseline mb-4">
                  <span className="text-4xl font-extrabold text-white">₹59</span>
                </div>
                <div className="text-xs text-amber-400 font-semibold mb-6 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Valid until {formatDate(mainPlanExpiry)}
                </div>

                <div className="space-y-4 mb-8 text-sm text-gray-300">
                  <div className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                    <span><b>3</b> × 10-minute interviews</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                    <span>Same active plan validity</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handlePurchase("topup_x_59")}
                disabled={purchasingItem === "topup_x_59" || !topupEligibility.eligible}
                className={`w-full py-3.5 rounded-xl font-bold text-xs transition-all ${
                  topupEligibility.eligible
                    ? "netflix-btn-red shadow-lg"
                    : "bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed"
                }`}
              >
                {purchasingItem === "topup_x_59"
                  ? "Opening Razorpay..."
                  : topupEligibility.eligible
                  ? "Recharge ₹59"
                  : "Top-up Locked"}
              </button>
            </div>

            {/* TOP-Y ₹99 */}
            <div className="netflix-card rounded-3xl p-8 flex flex-col justify-between relative border-2 border-[#E50914] shadow-[0_0_30px_rgba(229,9,20,0.2)]">
              <div className="absolute -top-3.5 right-6 px-3.5 py-1 rounded-full bg-[#E50914] text-white text-[11px] font-extrabold uppercase tracking-wider shadow-lg flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-white" /> Popular Top-Up
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#E50914]">Standard Top-Up</span>
                  <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#E50914]/20 text-[#E50914]">TOP-Y</span>
                </div>
                <h3 className="text-2xl font-bold mb-2 text-white" style={{ fontFamily: "Outfit" }}>TOP-Y Pack</h3>
                <p className="text-gray-400 text-xs mb-6">Double volume 10-minute session top-up.</p>
                <div className="flex items-baseline mb-4">
                  <span className="text-4xl font-extrabold text-white">₹99</span>
                </div>
                <div className="text-xs text-amber-400 font-semibold mb-6 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Valid until {formatDate(mainPlanExpiry)}
                </div>

                <div className="space-y-4 mb-8 text-sm text-gray-200">
                  <div className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                    <span><b>6</b> × 10-minute interviews</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                    <span>Same active plan validity</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handlePurchase("topup_y_99")}
                disabled={purchasingItem === "topup_y_99" || !topupEligibility.eligible}
                className={`w-full py-3.5 rounded-xl font-bold text-xs transition-all ${
                  topupEligibility.eligible
                    ? "netflix-btn-red shadow-[0_0_25px_rgba(229,9,20,0.5)]"
                    : "bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed"
                }`}
              >
                {purchasingItem === "topup_y_99"
                  ? "Opening Razorpay..."
                  : topupEligibility.eligible
                  ? "Recharge ₹99"
                  : "Top-up Locked"}
              </button>
            </div>

            {/* TOP-Z ₹149 */}
            <div className="netflix-card rounded-3xl p-8 flex flex-col justify-between relative border-[#E50914]/20 hover:border-[#E50914]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Max Top-Up</span>
                  <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">TOP-Z</span>
                </div>
                <h3 className="text-2xl font-bold mb-2 text-white" style={{ fontFamily: "Outfit" }}>TOP-Z Pack</h3>
                <p className="text-gray-400 text-xs mb-6">Complete refill including 15-minute rounds.</p>
                <div className="flex items-baseline mb-4">
                  <span className="text-4xl font-extrabold text-white">₹149</span>
                </div>
                <div className="text-xs text-amber-400 font-semibold mb-6 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Valid until {formatDate(mainPlanExpiry)}
                </div>

                <div className="space-y-4 mb-8 text-sm text-gray-300">
                  <div className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                    <span><b>6</b> × 10-minute interviews</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                    <span><b>3</b> × 15-minute interviews</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-[#E50914] shrink-0" />
                    <span>Total <b>9</b> interviews included</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handlePurchase("topup_z_149")}
                disabled={purchasingItem === "topup_z_149" || !topupEligibility.eligible}
                className={`w-full py-3.5 rounded-xl font-bold text-xs transition-all ${
                  topupEligibility.eligible
                    ? "netflix-btn-red shadow-lg"
                    : "bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed"
                }`}
              >
                {purchasingItem === "topup_z_149"
                  ? "Opening Razorpay..."
                  : topupEligibility.eligible
                  ? "Recharge ₹149"
                  : "Top-up Locked"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guarantees */}
      <div className="max-w-5xl mx-auto netflix-card rounded-3xl p-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
        <div className="flex flex-col items-center">
          <Clock className="w-7 h-7 text-[#E50914] mb-3" />
          <h4 className="font-bold text-sm text-white" style={{ fontFamily: "Outfit" }}>2-Minute Safety Guarantee</h4>
          <p className="text-xs text-gray-400 mt-1">Interviews under 120 seconds consume 0 credits.</p>
        </div>
        <div className="flex flex-col items-center">
          <Shield className="w-7 h-7 text-emerald-400 mb-3" />
          <h4 className="font-bold text-sm text-white" style={{ fontFamily: "Outfit" }}>Server Verified Payments</h4>
          <p className="text-xs text-gray-400 mt-1">Encrypted Razorpay HMAC SHA256 verification.</p>
        </div>
        <div className="flex flex-col items-center">
          <Award className="w-7 h-7 text-amber-400 mb-3" />
          <h4 className="font-bold text-sm text-white" style={{ fontFamily: "Outfit" }}>Instant PDF Invoices</h4>
          <p className="text-xs text-gray-400 mt-1">Download official PDF tax receipts immediately.</p>
        </div>
      </div>
    </div>
  );
}
