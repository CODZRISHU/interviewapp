import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { Check, Sparkles, Zap, Shield, CreditCard, Clock, Award, ArrowRight } from "lucide-react";
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
          color: "#2563EB",
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
        // Direct simulation for local dev without live API key
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
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-10" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
      {/* Header */}
      <div className="max-w-6xl mx-auto text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
          <Sparkles className="w-3.5 h-3.5" /> Flexible Interview Subscriptions
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
          Unlock Unlimited Practice & AI Intelligence
        </h1>
        <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
          Choose the plan that fits your interview timeline. All plans feature 2-minute protection—credits are only deducted for full 2+ min sessions.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Free Plan */}
        <div className="relative rounded-2xl bg-white/[0.03] border border-white/10 p-8 flex flex-col justify-between hover:border-white/20 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Default</span>
              {currentPlanKey === "free_trial" && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/10 text-white">Active Plan</span>
              )}
            </div>
            <h3 className="text-2xl font-bold mb-2">Free Plan</h3>
            <p className="text-gray-400 text-xs mb-6">Perfect for testing out Kevin AI before subscribing.</p>
            <div className="flex items-baseline mb-6">
              <span className="text-4xl font-extrabold">₹0</span>
              <span className="text-gray-500 text-sm ml-2">/ forever</span>
            </div>

            <div className="space-y-3.5 mb-8 text-sm text-gray-300">
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span><b>1</b> free 10-minute interview credit</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span>AI detailed feedback & scoring</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span>2-minute duration safety protection</span>
              </div>
            </div>
          </div>

          <button
            disabled={true}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-white/5 text-gray-400 cursor-not-allowed border border-white/5"
          >
            {currentPlanKey === "free_trial" ? "Current Plan" : "Free Plan"}
          </button>
        </div>

        {/* Basic Plan ₹99 */}
        <div className="relative rounded-2xl bg-white/[0.03] border border-white/10 p-8 flex flex-col justify-between hover:border-blue-500/50 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Starter Prep</span>
              {currentPlanKey === "basic_99" && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300">Active Plan</span>
              )}
            </div>
            <h3 className="text-2xl font-bold mb-2">Basic Plan</h3>
            <p className="text-gray-400 text-xs mb-6">Essential interview volume for targeted job prep.</p>
            <div className="flex items-baseline mb-6">
              <span className="text-4xl font-extrabold text-white">₹99</span>
              <span className="text-gray-500 text-sm ml-2">/ 30 days</span>
              <span className="text-xs text-emerald-400 line-through ml-3">₹199</span>
            </div>

            <div className="space-y-3.5 mb-8 text-sm text-gray-300">
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span><b>7</b> × 10-minute interviews</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span><b>3</b> × 15-minute interviews</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Total <b>10</b> interviews included</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Downloadable Tax Invoices</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleSubscribe("basic_99")}
            disabled={purchasingPlan === "basic_99" || currentPlanKey === "basic_99"}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
              currentPlanKey === "basic_99"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30 cursor-default"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20"
            }`}
          >
            {purchasingPlan === "basic_99"
              ? "Processing..."
              : currentPlanKey === "basic_99"
              ? "Current Plan"
              : "Subscribe Basic (₹99)"}
          </button>
        </div>

        {/* Premium Plan ₹199 */}
        <div className="relative rounded-2xl bg-gradient-to-b from-blue-950/40 via-white/[0.04] to-white/[0.02] border-2 border-blue-500 p-8 flex flex-col justify-between shadow-2xl shadow-blue-500/10">
          <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-md">
            Recommended
          </div>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Full Access</span>
              {currentPlanKey === "premium_199" && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/30 text-blue-200">Active Plan</span>
              )}
            </div>
            <h3 className="text-2xl font-bold mb-2">Premium Plan</h3>
            <p className="text-gray-400 text-xs mb-6">Complete suite for deep technical & senior rounds.</p>
            <div className="flex items-baseline mb-6">
              <span className="text-4xl font-extrabold text-white">₹199</span>
              <span className="text-gray-500 text-sm ml-2">/ 30 days</span>
              <span className="text-xs text-emerald-400 line-through ml-3">₹399</span>
            </div>

            <div className="space-y-3.5 mb-8 text-sm text-gray-200">
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span><b>1</b> × 30-minute full mock interview</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span><b>5</b> × 15-minute interviews</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span><b>5</b> × 10-minute interviews</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Priority AI evaluation response time</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleSubscribe("premium_199")}
            disabled={purchasingPlan === "premium_199" || currentPlanKey === "premium_199"}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
              currentPlanKey === "premium_199"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30 cursor-default"
                : "bg-white text-black hover:bg-gray-100 font-bold shadow-lg"
            }`}
          >
            {purchasingPlan === "premium_199"
              ? "Processing..."
              : currentPlanKey === "premium_199"
              ? "Current Plan"
              : "Subscribe Premium (₹199)"}
          </button>
        </div>
      </div>

      {/* Feature Guarantee */}
      <div className="max-w-4xl mx-auto mt-16 p-6 rounded-2xl bg-white/[0.02] border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
        <div className="flex flex-col items-center">
          <Clock className="w-6 h-6 text-blue-400 mb-2" />
          <h4 className="font-semibold text-sm">2-Minute Safety Rule</h4>
          <p className="text-xs text-gray-500 mt-1">Interviews ended under 2 minutes consume 0 credits.</p>
        </div>
        <div className="flex flex-col items-center">
          <Shield className="w-6 h-6 text-emerald-400 mb-2" />
          <h4 className="font-semibold text-sm">Secure Razorpay Checkout</h4>
          <p className="text-xs text-gray-500 mt-1">Server-verified HMAC SHA256 transactions.</p>
        </div>
        <div className="flex flex-col items-center">
          <Award className="w-6 h-6 text-purple-400 mb-2" />
          <h4 className="font-semibold text-sm">Instant PDF Invoices</h4>
          <p className="text-xs text-gray-500 mt-1">Download official tax invoices immediately after payment.</p>
        </div>
      </div>
    </div>
  );
}
