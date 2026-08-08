import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { Check, Sparkles, Shield, CreditCard, Clock, Award, Star, Flame } from "lucide-react";
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

export default function SubscriptionPage() {
  const { user, refreshUser } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasingPlan, setPurchasingPlan] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await api.get("/billing/plans");
      setPlans(res.data.plans || []);
    } catch (err) {
      toast.error("Failed to load subscription plans.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planKey) => {
    if (planKey === "free_trial") {
      toast.info("You are currently on the Free Plan.");
      return;
    }

    try {
      setPurchasingPlan(planKey);
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        toast.error("Failed to load Razorpay payment SDK.");
        setPurchasingPlan(null);
        return;
      }

      const res = await api.post("/billing/create-order", { itemKey: planKey });
      const order = res.data;

      const options = {
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "Kevin AI",
        description: `${order.planName} Subscription`,
        order_id: order.orderId,
        prefill: {
          name: order.user?.name || user?.name,
          email: order.user?.email || user?.email,
        },
        theme: {
          color: "#E50914",
        },
        handler: async function (response) {
          try {
            toast.loading("Verifying payment with server...");
            const verifyRes = await api.post("/billing/verify-payment", {
              razorpay_order_id: response.razorpay_order_id || order.orderId,
              razorpay_payment_id: response.razorpay_payment_id || `pay_mock_${Date.now()}`,
              razorpay_signature: response.razorpay_signature || "mock_signature",
              plan_key: planKey,
            });

            toast.dismiss();
            toast.success(verifyRes.data.message || "Subscription activated successfully!");
            await refreshUser();
            navigate("/dashboard");
          } catch (err) {
            toast.dismiss();
            toast.error(err.response?.data?.detail || "Payment verification failed.");
          } finally {
            setPurchasingPlan(null);
          }
        },
        modal: {
          ondismiss: function () {
            setPurchasingPlan(null);
            toast.info("Payment cancelled.");
          },
        },
      };

      if (order.orderId.startsWith("order_mock_")) {
        toast.info("Simulating Razorpay Payment Gateway...");
        setTimeout(() => {
          options.handler({
            razorpay_order_id: order.orderId,
            razorpay_payment_id: `pay_sim_${Date.now()}`,
            razorpay_signature: "simulated_signature",
          });
        }, 1200);
      } else {
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Unable to initiate checkout.");
      setPurchasingPlan(null);
    }
  };

  const currentPlanKey = user?.planKey || "free_trial";

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-10 space-y-12">
      {/* Header */}
      <div className="max-w-6xl mx-auto text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E50914]/10 border border-[#E50914]/30 text-[#E50914] text-xs font-semibold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" /> Kevin AI Subscription Plans
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight" style={{ fontFamily: "Outfit" }}>
          Choose your <span className="text-[#E50914]">Preparation Tier</span>
        </h1>
        <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto font-light">
          Upgrade your interview capacity. All plans include 2-minute safety protection—credits are only consumed for sessions lasting 2+ minutes.
        </p>
      </div>

      {/* Pricing Cards */}
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
              {currentPlanKey === "basic_99" && (
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
            onClick={() => handleSubscribe("basic_99")}
            disabled={purchasingPlan === "basic_99" || currentPlanKey === "basic_99"}
            className={`w-full py-3.5 rounded-xl font-bold text-xs transition-all ${
              currentPlanKey === "basic_99"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30 cursor-default"
                : "netflix-btn-red shadow-lg"
            }`}
          >
            {purchasingPlan === "basic_99"
              ? "Processing Checkout..."
              : currentPlanKey === "basic_99"
              ? "Current Active Plan"
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
              {currentPlanKey === "premium_199" && (
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
            onClick={() => handleSubscribe("premium_199")}
            disabled={purchasingPlan === "premium_199" || currentPlanKey === "premium_199"}
            className={`w-full py-3.5 rounded-xl font-bold text-xs transition-all ${
              currentPlanKey === "premium_199"
                ? "bg-[#E50914]/20 text-[#E50914] border border-[#E50914]/30 cursor-default"
                : "netflix-btn-red shadow-[0_0_25px_rgba(229,9,20,0.5)]"
            }`}
          >
            {purchasingPlan === "premium_199"
              ? "Processing Checkout..."
              : currentPlanKey === "premium_199"
              ? "Current Active Plan"
              : "Subscribe Premium (₹199)"}
          </button>
        </div>
      </div>

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
