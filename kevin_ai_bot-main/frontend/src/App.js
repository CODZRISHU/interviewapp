import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import InterviewPage from "./pages/InterviewPage";
import ReportsPage from "./pages/ReportsPage";
import ReportDetail from "./pages/ReportDetail";
import ProfilePage from "./pages/ProfilePage";

import InterviewConfig from "./pages/InterviewConfig";

import SubscriptionPage from "./pages/SubscriptionPage";
import PaymentHistoryPage from "./pages/PaymentHistoryPage";
import AdminPaymentsPage from "./pages/AdminPaymentsPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import RefundPolicyPage from "./pages/RefundPolicyPage";
import ContactPage from "./pages/ContactPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import EmailAuthPage from "./pages/EmailAuthPage";

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/auth-email" element={<EmailAuthPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/refund-policy" element={<RefundPolicyPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/interview/config" element={
        <ProtectedRoute><InterviewConfig /></ProtectedRoute>
      } />
      <Route path="/interview/:interviewId" element={
        <ProtectedRoute><InterviewPage /></ProtectedRoute>
      } />
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/payments" element={<PaymentHistoryPage />} />
        <Route path="/admin/payments" element={<AdminPaymentsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/:reportId" element={<ReportDetail />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
    </Routes>
  );
}


function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
