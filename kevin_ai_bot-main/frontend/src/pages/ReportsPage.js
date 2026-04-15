import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Clock, ChevronRight, TrendingUp } from 'lucide-react';
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
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };
  const getScoreBg = (score) => {
    if (score >= 8) return 'bg-green-500/10';
    if (score >= 6) return 'bg-yellow-500/10';
    return 'bg-red-500/10';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto" data-testid="reports-page">
      <div className="mb-8">
        <h1 className="text-3xl font-light tracking-tighter mb-2" style={{ fontFamily: 'Outfit' }}>Interview Reports</h1>
        <p className="text-sm text-gray-500">{reports.length} interview{reports.length !== 1 ? 's' : ''} completed</p>
      </div>

      {reports.length === 0 ? (
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-16 text-center">
          <BarChart3 className="w-10 h-10 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">No reports yet</p>
          <p className="text-xs text-gray-600">Complete an interview to see your first report</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report, i) => {
            const avg = getAvgScore(report);
            return (
              <button
                key={report.id}
                data-testid={`report-item-${report.id}`}
                onClick={() => navigate(`/reports/${report.id}`)}
                className="w-full bg-[#0A0A0A] border border-white/5 rounded-2xl p-5 flex items-center gap-5 transition-all hover:border-white/15 hover:bg-[#0E0E0E] text-left group"
              >
                <div className={`w-14 h-14 rounded-2xl ${getScoreBg(avg)} flex flex-col items-center justify-center shrink-0`}>
                  <span className={`text-lg font-bold ${getScoreColor(avg)}`}>{avg}</span>
                  <span className="text-[8px] text-gray-500 uppercase">avg</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-medium">Interview #{reports.length - i}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      report.verdict === 'Hire' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {report.verdict}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mb-1">{report.summary}</p>
                  <div className="flex items-center gap-4 text-[10px] text-gray-600">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(report.createdAt).toLocaleDateString()}</span>
                    <span>Tech: {report.scores?.technical ?? 0}/10</span>
                    <span>Comm: {report.scores?.communication ?? 0}/10</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
