import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Play, Upload, FileText, BarChart3, Clock, ChevronRight, Sparkles, CreditCard, Award, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { api } from '../services/api';

const maxVal = (val, fallback) => (val && val > 0 ? val : fallback);

export default function Dashboard() {
  const { user, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  React.useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await api.get('/reports');
      setReports(res.data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF file');
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload-resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult(res.data);
      await checkAuth();
    } catch (err) {
      setUploadResult({ error: err.response?.data?.detail || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  }, [checkAuth]);

  const handleStartInterview = async () => {
    if (!user?.resumeText) {
      setShowUpload(true);
      return;
    }
    navigate('/interview/config');
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-emerald-400';
    if (score >= 6) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10" data-testid="dashboard-page">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E50914]/10 border border-[#E50914]/30 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-200">Candidate Portal</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight" style={{ fontFamily: 'Outfit' }}>
            Welcome back, <span className="text-[#E50914]">{user?.name?.split(' ')[0] || 'Interviewer'}</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base mt-2">
            Configure your AI mock session, upload updated resumes, and review AI feedback scorecards.
          </p>
        </div>

        <button
          data-testid="start-interview-btn"
          onClick={handleStartInterview}
          className="netflix-btn-red px-8 py-4 rounded-2xl font-bold text-base flex items-center gap-3 shrink-0 shadow-[0_0_35px_rgba(229,9,20,0.4)]"
        >
          <Play className="w-5 h-5 fill-white" /> Start Mock Interview
        </button>
      </div>

      {/* Expired Subscription Banner */}
      {user?.billingStatus === "expired" && (
        <div className="p-5 rounded-2xl bg-[#E50914]/15 border border-[#E50914]/40 text-red-200 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_0_30px_rgba(229,9,20,0.2)]">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-[#E50914] shrink-0 animate-bounce" />
            <span className="text-sm font-medium">Your subscription has expired. Recharge credits to launch new interviews.</span>
          </div>
          <button
            onClick={() => navigate('/subscription')}
            className="netflix-btn-red px-5 py-2 rounded-xl text-xs font-bold shrink-0"
          >
            Recharge Now
          </button>
        </div>
      )}

      {/* Credit Buckets Card */}
      {(() => {
        const buckets = user?.entitlements?.creditBuckets || user?.creditBuckets || {};
        const b10 = buckets["10m"] || {};
        const b15 = buckets["15m"] || {};
        const b30 = buckets["30m"] || {};

        return (
          <div className="netflix-card rounded-3xl p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#E50914]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-[#E50914]" />
                  <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit' }}>
                    Active Plan & Credit Balances
                  </h2>
                  <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                    user?.planKey === "premium_199" ? "bg-amber-500/20 border border-amber-500/40 text-amber-300" :
                    user?.planKey === "basic_99" ? "bg-blue-500/20 border border-blue-500/40 text-blue-300" : "bg-gray-500/20 border border-gray-500/40 text-gray-300"
                  }`}>
                    {user?.planKey === "premium_199" ? "Premium Plan (₹199)" :
                     user?.planKey === "basic_99" ? "Basic Plan (₹99)" : "Free Trial"}
                  </span>
                </div>

                {/* Credit Progress Bars */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
                    <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                      <span>10-Minute Interviews</span>
                      <span className="font-bold text-white">
                        {b10.remaining ?? (user?.creditsRemaining || 0)} Left
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-600 to-[#E50914] transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            ((b10.remaining ?? 1) / maxVal(b10.total, 1)) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
                    <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                      <span>15-Minute Interviews</span>
                      <span className="font-bold text-white">
                        {b15.remaining ?? 0} Left
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            ((b15.remaining ?? 0) / maxVal(b15.total, 1)) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
                    <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                      <span>30-Minute Interviews</span>
                      <span className="font-bold text-white">
                        {b30.remaining ?? 0} Left
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            ((b30.remaining ?? 0) / maxVal(b30.total, 1)) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 shrink-0">
                <button
                  onClick={() => navigate('/subscription')}
                  className="netflix-btn-red px-6 py-3 rounded-xl font-bold text-xs shadow-md text-center"
                >
                  {user?.planKey === "free_trial" ? "Upgrade Subscription" : "Manage Plan"}
                </button>
                <button
                  onClick={() => navigate('/payments')}
                  className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium text-xs border border-white/10 transition text-center"
                >
                  Billing & Invoices
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Main Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          data-testid="upload-resume-btn"
          onClick={() => setShowUpload(true)}
          className="netflix-card rounded-3xl p-7 text-left group"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <Upload className="w-6 h-6 text-[#E50914]" />
          </div>
          <h3 className="text-lg font-bold mb-1 text-white" style={{ fontFamily: 'Outfit' }}>Resume Upload</h3>
          <p className="text-xs text-gray-400 line-clamp-1">
            {user?.resumeFilename ? `Uploaded: ${user.resumeFilename}` : 'Upload your PDF resume'}
          </p>
        </button>

        <button
          data-testid="view-reports-btn"
          onClick={() => navigate('/reports')}
          className="netflix-card rounded-3xl p-7 text-left group"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <BarChart3 className="w-6 h-6 text-[#E50914]" />
          </div>
          <h3 className="text-lg font-bold mb-1 text-white" style={{ fontFamily: 'Outfit' }}>Evaluation Reports</h3>
          <p className="text-xs text-gray-400">{reports.length} interview{reports.length !== 1 ? 's' : ''} completed</p>
        </button>

        <button
          onClick={() => navigate('/profile')}
          className="netflix-card rounded-3xl p-7 text-left group"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <Award className="w-6 h-6 text-[#E50914]" />
          </div>
          <h3 className="text-lg font-bold mb-1 text-white" style={{ fontFamily: 'Outfit' }}>Profile & Resume Skills</h3>
          <p className="text-xs text-gray-400">View extracted skills & experience</p>
        </button>
      </div>

      {/* Recent Interview Evaluations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-white" style={{ fontFamily: 'Outfit' }}>Recent Evaluations</h2>
          {reports.length > 0 && (
            <button onClick={() => navigate('/reports')} className="text-xs font-semibold text-[#E50914] hover:underline">
              View All Reports →
            </button>
          )}
        </div>

        {loadingReports ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#E50914]/30 border-t-[#E50914] rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="netflix-card rounded-3xl p-12 text-center">
            <BarChart3 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-400">No mock interviews completed yet.</p>
            <p className="text-xs text-gray-500 mt-1">Start your first interview with Kevin AI above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {reports.slice(0, 5).map(report => (
              <button
                key={report.id}
                data-testid={`report-card-${report.id}`}
                onClick={() => navigate(`/reports/${report.id}`)}
                className="netflix-card rounded-2xl p-6 flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center shrink-0">
                    <span className={`text-base font-extrabold ${getScoreColor(report.scores?.technical ?? 0)}`}>
                      {(((report.scores?.technical ?? 0) + (report.scores?.communication ?? 0) + (report.scores?.confidence ?? 0) + (report.scores?.problem_solving ?? 0)) / 4).toFixed(1)}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-gray-500">Score</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-base font-bold text-white truncate" style={{ fontFamily: 'Outfit' }}>
                        {report.interviewConfig?.role || 'Software Engineer'} ({report.interviewConfig?.level || 'Fresher'})
                      </h4>
                      <span className={`text-xs px-3 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        report.verdict === 'Hire' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {report.verdict}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                        {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span>•</span>
                      <span className="capitalize text-gray-300">{report.interviewConfig?.interview_type || 'Mixed'} Mock</span>
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Resume Upload Modal */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="netflix-glass border border-white/15 rounded-3xl max-w-md p-6" data-testid="upload-resume-modal">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit' }}>Upload Candidate Resume</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <label
              data-testid="resume-dropzone"
              className="border-2 border-dashed border-white/15 rounded-2xl p-10 flex flex-col items-center justify-center hover:border-[#E50914]/50 hover:bg-[#E50914]/5 transition-all cursor-pointer group"
            >
              <Upload className="w-10 h-10 text-[#E50914] mb-3 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-semibold text-gray-200 mb-1">Click to select PDF resume</p>
              <p className="text-xs text-gray-500">Supports PDF files up to 25MB</p>
              <input
                type="file"
                accept=".pdf"
                onChange={handleUpload}
                className="hidden"
                data-testid="resume-file-input"
              />
            </label>
            {uploading && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="w-4 h-4 border-2 border-[#E50914]/30 border-t-[#E50914] rounded-full animate-spin" />
                <p className="text-xs text-gray-300 font-medium">Extracting resume skills & background...</p>
              </div>
            )}
            {uploadResult && !uploadResult.error && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <p className="text-xs font-bold text-emerald-300">Resume uploaded successfully!</p>
                <p className="text-[11px] text-emerald-200/70 mt-1">{uploadResult.filename} • {uploadResult.text_length} characters parsed</p>
              </div>
            )}
            {uploadResult?.error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <p className="text-xs text-red-300">{uploadResult.error}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
