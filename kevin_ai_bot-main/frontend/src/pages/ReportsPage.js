import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Clock, ChevronRight, Award, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await api.get('/reports');
      setReports(res.data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAvgScore = (r) => (((r.scores?.technical ?? 0) + (r.scores?.communication ?? 0) + (r.scores?.confidence ?? 0) + (r.scores?.problem_solving ?? 0)) / 4).toFixed(1);
  const getScoreColor = (score) => {
    if (score >= 8) return 'text-emerald-400';
    if (score >= 6) return 'text-amber-400';
    return 'text-red-400';
  };
  const getScoreBg = (score) => {
    if (score >= 8) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 6) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-2 border-[#E50914]/30 border-t-[#E50914] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8" data-testid="reports-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E50914]/10 border border-[#E50914]/30 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-200">Evaluation Archive</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white" style={{ fontFamily: 'Outfit' }}>
            Interview Reports
          </h1>
          <p className="text-sm text-gray-400 mt-1">{reports.length} total mock interview evaluations archived</p>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="netflix-card rounded-3xl p-16 text-center">
          <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-base font-bold text-white mb-1">No Evaluation Reports Yet</p>
          <p className="text-xs text-gray-400">Complete an interview with Kevin AI to unlock your detailed report scorecard.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report, i) => {
            const avg = getAvgScore(report);
            return (
              <button
                key={report.id}
                data-testid={`report-item-${report.id}`}
                onClick={() => navigate(`/reports/${report.id}`)}
                className="netflix-card rounded-2xl p-6 flex items-center justify-between gap-6 w-full text-left group"
              >
                <div className="flex items-center gap-5 min-w-0 flex-1">
                  <div className={`w-16 h-16 rounded-2xl border ${getScoreBg(avg)} flex flex-col items-center justify-center shrink-0`}>
                    <span className={`text-xl font-extrabold ${getScoreColor(avg)}`}>{avg}</span>
                    <span className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold">Avg</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h3 className="text-base font-bold text-white truncate" style={{ fontFamily: 'Outfit' }}>
                        Interview #{reports.length - i} • {report.interviewConfig?.role || 'Software Engineer'}
                      </h3>
                      <span className={`text-xs px-3 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        report.verdict === 'Hire' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {report.verdict}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 line-clamp-1 mb-2 leading-relaxed">{report.summary}</p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1.5 text-gray-300">
                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                        {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span>•</span>
                      <span>Technical: <strong className="text-white">{report.scores?.technical ?? 0}/10</strong></span>
                      <span>Communication: <strong className="text-white">{report.scores?.communication ?? 0}/10</strong></span>
                      <span>Problem Solving: <strong className="text-white">{report.scores?.problem_solving ?? 0}/10</strong></span>
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
