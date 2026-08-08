import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Play, Upload, FileText, BarChart3, Clock, ChevronRight, UserCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { api } from '../services/api';

const maxVal = (val, fallback) => (val && val > 0 ? val : fallback);

export default function Dashboard() {

  const { user, checkAuth } = useAuth();
  const creditBuckets = user?.creditBuckets ?? user?.entitlements?.creditBuckets ?? {};
  const tenMinBucket = creditBuckets["10m"] ?? {};
  const fifteenMinBucket = creditBuckets["15m"] ?? {};
  const thirtyMinBucket = creditBuckets["30m"] ?? {};
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
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="p-8 max-w-6xl mx-auto" data-testid="dashboard-page">
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-light tracking-tighter mb-2" style={{ fontFamily: 'Outfit' }}>
          Welcome back, <span className="font-medium">{user?.name?.split(' ')[0] || 'there'}</span>
        </h1>
        <p className="text-gray-500 text-sm">Upload your resume, practice interviews, and review your reports.</p>
      </div>

        {/* Subscription Alert Banners */}
        {user?.billingStatus === "expired" && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium">Your subscription has expired. Please recharge to continue interviews.</span>
            </div>
            <button
              onClick={() => navigate('/subscription')}
              className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition"
            >
              Recharge Now
            </button>
          </div>
        )}

        {/* Subscription Overview Widget */}
        <div className="mb-8 p-6 rounded-[28px] border border-white/10 bg-[#0A0A0A] flex flex-col md:flex-row justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs uppercase tracking-[0.24em] text-gray-500">Current Subscription</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                user?.planKey === "premium_199" ? "bg-amber-500/20 text-amber-300" :
                user?.planKey === "basic_99" ? "bg-blue-500/20 text-blue-300" : "bg-gray-500/20 text-gray-300"
              }`}>
                {user?.planKey === "premium_199" ? "Premium Plan (₹199)" :
                 user?.planKey === "basic_99" ? "Basic Plan (₹99)" : "Free Plan"}
              </span>
            </div>

            <h2 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Outfit' }}>
              Interview Credit Buckets
            </h2>

            {/* Credit Buckets Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>10 Min Bucket</span>
                  <span className="font-semibold text-white">
                    {tenMinBucket?.remaining ?? (user?.creditsRemaining || 0)} Remaining
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        ((tenMinBucket?.remaining ?? (user?.creditsRemaining || 0)) /
                          maxVal(tenMinBucket?.total, maxVal(user?.totalCredits, 1))) *
                          100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>15 Min Bucket</span>
                  <span className="font-semibold text-white">
                    {fifteenMinBucket?.remaining ?? 0} Remaining
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        ((fifteenMinBucket?.remaining ?? 0) /
                          maxVal(fifteenMinBucket?.total, 1)) *
                          100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>30 Min Bucket</span>
                  <span className="font-semibold text-white">
                    {thirtyMinBucket?.remaining ?? 0} Remaining
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        ((thirtyMinBucket?.remaining ?? 0) /
                          maxVal(thirtyMinBucket?.total, 1)) *
                          100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action CTAs */}
          <div className="flex flex-col justify-center gap-3 shrink-0">
            <button
              onClick={() => navigate('/subscription')}
              className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-600/20 text-center"
            >
              {user?.planKey === "free_trial" ? "Upgrade Now" : "Manage Subscription"}
            </button>
            <button
              onClick={() => navigate('/payments')}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium text-xs border border-white/5 transition text-center"
            >
              Payment History
            </button>
          </div>
        </div>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-10">
        <button
          data-testid="start-interview-btn"
          onClick={handleStartInterview}
          className="bg-white text-black rounded-2xl p-6 text-left transition-all hover:shadow-[0_8px_32px_rgba(255,255,255,0.1)] hover:-translate-y-1"
        >
          <div className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center mb-4">
            <Play className="w-5 h-5" />
          </div>
          <h3 className="text-base font-medium mb-1" style={{ fontFamily: 'Outfit' }}>
            Start Interview
          </h3>
          <p className="text-xs text-gray-600">Configure and begin a mock interview</p>
        </button>

        <button
          data-testid="upload-resume-btn"
          onClick={() => setShowUpload(true)}
          className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 text-left transition-all hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_8px_32px_rgba(255,255,255,0.04)]"
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4">
            <Upload className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="text-base font-medium mb-1" style={{ fontFamily: 'Outfit' }}>Upload Resume</h3>
          <p className="text-xs text-gray-500">
            {user?.resumeFilename ? `Current: ${user.resumeFilename}` : 'Upload your PDF resume'}
          </p>
        </button>

        <button
          data-testid="view-reports-btn"
          onClick={() => navigate('/reports')}
          className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 text-left transition-all hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_8px_32px_rgba(255,255,255,0.04)]"
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4">
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="text-base font-medium mb-1" style={{ fontFamily: 'Outfit' }}>View Reports</h3>
          <p className="text-xs text-gray-500">{reports.length} interview{reports.length !== 1 ? 's' : ''} completed</p>
        </button>
      </div>

      {user?.resumeFilename && (
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-5 mb-10 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-green-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Resume uploaded</p>
            <p className="text-xs text-gray-500 truncate">{user.resumeFilename}</p>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-medium tracking-tight mb-4" style={{ fontFamily: 'Outfit' }}>Recent Reports</h2>
        {loadingReports ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-12 text-center">
            <BarChart3 className="w-8 h-8 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No interviews yet. Start your first one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.slice(0, 5).map(report => (
              <button
                key={report.id}
                data-testid={`report-card-${report.id}`}
                onClick={() => navigate(`/reports/${report.id}`)}
                className="w-full bg-[#0A0A0A] border border-white/5 rounded-2xl p-5 flex items-center gap-4 transition-all hover:border-white/15 hover:bg-[#0E0E0E] text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-lg font-semibold ${getScoreColor(report.scores?.technical ?? 0)}`}>
                      {(((report.scores?.technical ?? 0) + (report.scores?.communication ?? 0) + (report.scores?.confidence ?? 0) + (report.scores?.problem_solving ?? 0)) / 4).toFixed(1)}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      report.verdict === 'Hire' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {report.verdict}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="bg-[#0A0A0A] border border-white/10 rounded-2xl max-w-md" data-testid="upload-resume-modal">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium" style={{ fontFamily: 'Outfit' }}>Upload Resume</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <label
              data-testid="resume-dropzone"
              className="border-2 border-dashed border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center hover:border-white/30 hover:bg-white/[0.02] transition-all cursor-pointer"
            >
              <Upload className="w-8 h-8 text-gray-500 mb-3" />
              <p className="text-sm text-gray-400 mb-1">Click to upload PDF</p>
              <p className="text-xs text-gray-600">Max 25MB</p>
              <input
                type="file"
                accept=".pdf"
                onChange={handleUpload}
                className="hidden"
                data-testid="resume-file-input"
              />
            </label>
            {uploading && (
              <div className="mt-4 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Uploading and extracting text...</p>
              </div>
            )}
            {uploadResult && !uploadResult.error && (
              <div className="mt-4 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <p className="text-sm text-green-400 font-medium">Resume uploaded successfully!</p>
                <p className="text-xs text-green-400/60 mt-1">{uploadResult.filename} - {uploadResult.text_length} characters extracted</p>
              </div>
            )}
            {uploadResult?.error && (
              <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-sm text-red-400">{uploadResult.error}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
