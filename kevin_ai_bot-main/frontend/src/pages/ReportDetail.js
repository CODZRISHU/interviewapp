import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertTriangle, TrendingUp, Award, Lightbulb, Settings } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { api } from '../services/api';

export default function ReportDetail() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    try {
      const res = await api.get(`/reports/${reportId}`);
      setReport(res.data);
    } catch (err) {
      console.error('Failed to fetch report:', err);
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Report not found</p>
      </div>
    );
  }

  const avgScore = (((report.scores?.technical ?? 0) + (report.scores?.communication ?? 0) + (report.scores?.confidence ?? 0) + (report.scores?.problem_solving ?? 0)) / 4).toFixed(1);
  const config = report.config || {};
  const sectionScores = report.section_scores || {};
  const improvements = report.improvements || [];
  const isIncomplete = report.status === 'incomplete' || report.verdict === 'Incomplete';

  const radarData = [
    { subject: 'Technical', score: report.scores?.technical ?? 0, fullMark: 10 },
    { subject: 'Communication', score: report.scores?.communication ?? 0, fullMark: 10 },
    { subject: 'Confidence', score: report.scores?.confidence ?? 0, fullMark: 10 },
    { subject: 'Problem Solving', score: report.scores?.problem_solving ?? 0, fullMark: 10 },
  ];

  const barData = [
    { name: 'Technical', score: report.scores?.technical ?? 0 },
    { name: 'Communication', score: report.scores?.communication ?? 0 },
    { name: 'Confidence', score: report.scores?.confidence ?? 0 },
    { name: 'Problem Solving', score: report.scores?.problem_solving ?? 0 },
  ];

  const getBarColor = (score) => {
    if (score >= 8) return '#22C55E';
    if (score >= 6) return '#EAB308';
    return '#EF4444';
  };

  return (
    <div className="p-8 max-w-4xl mx-auto" data-testid="report-detail-page">
      {/* Header */}
      <button
        data-testid="back-to-reports"
        onClick={() => navigate('/reports')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Reports
      </button>

      {/* Score Hero */}
      <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-8 mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="flex items-center gap-6">
            <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center ${
              isIncomplete ? 'bg-gray-500/10' : avgScore >= 8 ? 'bg-green-500/10' : avgScore >= 6 ? 'bg-yellow-500/10' : 'bg-red-500/10'
            }`}>
              <span className={`text-3xl font-bold ${
                isIncomplete ? 'text-gray-500' : avgScore >= 8 ? 'text-green-400' : avgScore >= 6 ? 'text-yellow-400' : 'text-red-400'
              }`}>{isIncomplete ? '--' : avgScore}</span>
              <span className="text-[10px] text-gray-500 uppercase">{isIncomplete ? 'N/A' : 'Overall'}</span>
            </div>
            <div>
              <h1 className="text-2xl font-light tracking-tight mb-1" style={{ fontFamily: 'Outfit' }}>Performance Report</h1>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  report.verdict === 'Hire' ? 'bg-green-500/10 text-green-400' : report.verdict === 'Incomplete' ? 'bg-gray-500/10 text-gray-400' : 'bg-yellow-500/10 text-yellow-400'
                }`} data-testid="report-verdict">
                  {report.verdict === 'Hire' ? <Award className="w-3 h-3 inline mr-1" /> : null}
                  {report.verdict}
                </span>
                <span className="text-xs text-gray-600">
                  {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>
        {report.summary && (
          <p className="text-sm text-gray-400 mt-5 leading-relaxed border-t border-white/5 pt-5">{report.summary}</p>
        )}
      </div>

      {/* Incomplete Interview Warning */}
      {isIncomplete && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-6 mb-6 flex items-start gap-4" data-testid="incomplete-warning">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-400 mb-1" style={{ fontFamily: 'Outfit' }}>Interview Incomplete</h3>
            <p className="text-xs text-gray-400 leading-relaxed">{report.summary}</p>
            <button onClick={() => navigate('/interview/config')} className="mt-3 bg-white text-black px-4 py-2 rounded-full text-xs font-medium hover:bg-gray-200 transition-colors" data-testid="retake-interview-btn">
              Retake Interview
            </button>
          </div>
        </div>
      )}

      {/* Charts - only show for completed interviews */}
      {!isIncomplete && (
        <>
      {/* Interview Config Info */}
      {config.interview_type && (
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-5 mb-6 flex items-center gap-4" data-testid="report-config">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            <Settings className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <div><span className="text-gray-500">Type:</span> <span className="text-gray-300 capitalize">{config.interview_type}</span></div>
            <div><span className="text-gray-500">Level:</span> <span className="text-gray-300 capitalize">{config.level}</span></div>
            <div><span className="text-gray-500">Role:</span> <span className="text-gray-300">{config.role}</span></div>
            <div><span className="text-gray-500">Duration:</span> <span className="text-gray-300">{config.duration} min</span></div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Radar Chart */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6" data-testid="radar-chart">
          <h3 className="text-sm font-medium mb-4" style={{ fontFamily: 'Outfit' }}>Skills Overview</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#A1A1AA', fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
              <Radar dataKey="score" stroke="#fff" fill="rgba(255,255,255,0.1)" fillOpacity={0.6} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6" data-testid="bar-chart">
          <h3 className="text-sm font-medium mb-4" style={{ fontFamily: 'Outfit' }}>Score Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" domain={[0, 10]} tick={{ fill: '#52525B', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#A1A1AA', fontSize: 11 }} width={100} />
              <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={20}>
                {barData.map((entry, index) => (
                  <Cell key={index} fill={getBarColor(entry.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Individual Scores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {barData.map((item) => (
          <div key={item.name} className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-4" data-testid={`score-${item.name.toLowerCase().replace(' ', '-')}`}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{item.name}</p>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-bold" style={{ color: getBarColor(item.score) }}>{item.score}</span>
              <span className="text-xs text-gray-600 mb-1">/10</span>
            </div>
            <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full score-bar-fill"
                style={{ '--score-width': `${item.score * 10}%`, backgroundColor: getBarColor(item.score) }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Strengths, Weaknesses & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6" data-testid="strengths-section">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-medium" style={{ fontFamily: 'Outfit' }}>Strengths</h3>
          </div>
          <ul className="space-y-3">
            {report.strengths?.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6" data-testid="weaknesses-section">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-medium" style={{ fontFamily: 'Outfit' }}>Weaknesses</h3>
          </div>
          <ul className="space-y-3">
            {report.weaknesses?.map((w, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-2 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6" data-testid="improvements-section">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-medium" style={{ fontFamily: 'Outfit' }}>How to Improve</h3>
          </div>
          <ul className="space-y-3">
            {improvements.map((imp, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                {imp}
              </li>
            ))}
            {improvements.length === 0 && (
              <li className="text-sm text-gray-500">No specific improvements available</li>
            )}
          </ul>
        </div>
      </div>

      {/* Section Scores */}
      {Object.keys(sectionScores).length > 0 && (
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6" data-testid="section-scores">
          <h3 className="text-sm font-medium mb-4" style={{ fontFamily: 'Outfit' }}>Section Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(sectionScores).map(([section, score]) => (
              <div key={section} className="text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 capitalize">{section}</p>
                <span className="text-xl font-bold" style={{ color: score == null ? '#52525B' : getBarColor(score) }}>
                  {score == null ? 'N/A' : score}
                </span>
                {score != null && <span className="text-xs text-gray-600">/10</span>}
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
