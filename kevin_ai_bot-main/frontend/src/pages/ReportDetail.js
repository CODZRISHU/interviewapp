import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertTriangle, Award, Lightbulb, Settings, MessageSquare, ChevronDown, ChevronUp, Sparkles, User } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { api } from '../services/api';

import { triggerGlobalUserRefresh } from '../context/AuthContext';

export default function ReportDetail() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(true);

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
    triggerGlobalUserRefresh();
  }, [fetchReport]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-2 border-[#E50914]/30 border-t-[#E50914] rounded-full animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Report not found</p>
      </div>
    );
  }

  const avgScore = (((report.scores?.technical ?? 0) + (report.scores?.communication ?? 0) + (report.scores?.confidence ?? 0) + (report.scores?.problem_solving ?? 0)) / 4).toFixed(1);
  const config = report.config || {};
  const sectionScores = report.section_scores || {};
  const improvements = report.improvements || [];
  const messages = report.messages || [];
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
    if (score >= 8) return '#10B981';
    if (score >= 6) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8" data-testid="report-detail-page">
      {/* Back Button */}
      <button
        data-testid="back-to-reports"
        onClick={() => navigate('/reports')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white px-3.5 py-2 rounded-full bg-white/5 border border-white/10 hover:border-white/20 transition-all"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to All Reports
      </button>

      {/* Score Hero Card */}
      <div className="netflix-card rounded-3xl p-8 border border-white/10 relative overflow-hidden space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center border shrink-0 ${
              isIncomplete
                ? 'bg-gray-500/10 border-gray-500/20 text-gray-400'
                : avgScore >= 8
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : avgScore >= 6
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              <span className="text-3xl font-extrabold" style={{ fontFamily: 'Outfit' }}>
                {isIncomplete ? '--' : avgScore}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mt-0.5">
                {isIncomplete ? 'N/A' : 'Avg Score'}
              </span>
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-2" style={{ fontFamily: 'Outfit' }}>
                Interview Evaluation Report
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`text-xs px-3.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                  report.verdict === 'Hire'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : report.verdict === 'Incomplete'
                    ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`} data-testid="report-verdict">
                  {report.verdict === 'Hire' ? <Award className="w-3.5 h-3.5 inline mr-1" /> : null}
                  {report.verdict}
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {report.summary && (
          <p className="text-sm text-gray-300 leading-relaxed pt-5 border-t border-white/10 font-normal">
            {report.summary}
          </p>
        )}
      </div>

      {/* Incomplete Interview Warning */}
      {isIncomplete && (
        <div className="netflix-card rounded-3xl p-6 border border-amber-500/30 bg-amber-950/20 flex items-start gap-4" data-testid="incomplete-warning">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="text-base font-bold text-amber-400" style={{ fontFamily: 'Outfit' }}>Interview Session Incomplete</h3>
            <p className="text-xs text-gray-300 leading-relaxed">{report.summary}</p>
            <button
              onClick={() => navigate('/interview/config')}
              className="netflix-btn-red px-5 py-2 rounded-xl text-xs font-bold mt-2"
              data-testid="retake-interview-btn"
            >
              Start New Interview
            </button>
          </div>
        </div>
      )}

      {/* Analytics & Breakdown (For Completed Rounds) */}
      {!isIncomplete && (
        <>
          {/* Config Summary */}
          {config.interview_type && (
            <div className="netflix-card rounded-2xl p-5 flex items-center gap-4 border border-white/10" data-testid="report-config">
              <div className="w-10 h-10 rounded-xl bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center shrink-0">
                <Settings className="w-5 h-5 text-[#E50914]" />
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs font-medium">
                <div><span className="text-gray-400">Target Role:</span> <strong className="text-white ml-1">{config.role}</strong></div>
                <div><span className="text-gray-400">Round Type:</span> <strong className="text-white capitalize ml-1">{config.interview_type}</strong></div>
                <div><span className="text-gray-400">Experience Tier:</span> <strong className="text-white capitalize ml-1">{config.level}</strong></div>
                <div><span className="text-gray-400">Target Duration:</span> <strong className="text-white ml-1">{config.duration} min</strong></div>
              </div>
            </div>
          )}

          {/* Radar & Bar Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="netflix-card rounded-3xl p-6 border border-white/10" data-testid="radar-chart">
              <h3 className="text-base font-bold text-white mb-4" style={{ fontFamily: 'Outfit' }}>Skills Competency Web</h3>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#D1D5DB', fontSize: 11, fontWeight: 600 }} />
                  <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                  <Radar dataKey="score" stroke="#E50914" fill="rgba(229,9,20,0.25)" fillOpacity={0.7} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="netflix-card rounded-3xl p-6 border border-white/10" data-testid="bar-chart">
              <h3 className="text-base font-bold text-white mb-4" style={{ fontFamily: 'Outfit' }}>Dimension Breakdown</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" domain={[0, 10]} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#D1D5DB', fontSize: 11, fontWeight: 600 }} width={110} />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={18}>
                    {barData.map((entry, index) => (
                      <Cell key={index} fill={getBarColor(entry.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Individual Dimension Score Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {barData.map((item) => (
              <div key={item.name} className="netflix-card rounded-2xl p-5 border border-white/10" data-testid={`score-${item.name.toLowerCase().replace(' ', '-')}`}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{item.name}</p>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-extrabold" style={{ color: getBarColor(item.score), fontFamily: 'Outfit' }}>{item.score}</span>
                  <span className="text-xs text-gray-500 mb-1 font-semibold">/10</span>
                </div>
                <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.score * 10}%`, backgroundColor: getBarColor(item.score) }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Strengths & Improvements */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="netflix-card rounded-3xl p-6 border border-white/10 space-y-4" data-testid="strengths-section">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white" style={{ fontFamily: 'Outfit' }}>Candidate Strengths</h3>
              </div>
              <ul className="space-y-3 text-xs text-gray-300">
                {report.strengths?.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="netflix-card rounded-3xl p-6 border border-white/10 space-y-4" data-testid="weaknesses-section">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white" style={{ fontFamily: 'Outfit' }}>Growth Areas</h3>
              </div>
              <ul className="space-y-3 text-xs text-gray-300">
                {report.weaknesses?.map((w, i) => (
                  <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="netflix-card rounded-3xl p-6 border border-white/10 space-y-4" data-testid="improvements-section">
              <div className="flex items-center gap-2.5">
                <Lightbulb className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white" style={{ fontFamily: 'Outfit' }}>Actionable Guidance</h3>
              </div>
              <ul className="space-y-3 text-xs text-gray-300">
                {improvements.map((imp, i) => (
                  <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      {/* FULL CHAT TRANSCRIPT SECTION */}
      <div className="netflix-card rounded-3xl border border-white/10 overflow-hidden space-y-0" data-testid="report-chat-section">
        <button
          onClick={() => setShowChat(!showChat)}
          className="w-full p-6 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] transition-colors border-b border-white/10 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-[#E50914]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white" style={{ fontFamily: 'Outfit' }}>
                Full Interview Chat & Transcript
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Review the line-by-line real-time dialogue exchanged during this session ({messages.length} messages)
              </p>
            </div>
          </div>
          <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white">
            {showChat ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showChat && (
          <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar bg-[#08080C]">
            {messages.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">No transcript history recorded for this round.</p>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#B20710] to-[#E50914] text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-md" style={{ fontFamily: 'Outfit' }}>
                      K
                    </div>
                  )}

                  <div className={`max-w-[85%] space-y-1 ${msg.role === 'user' ? 'items-end text-right' : 'items-start'}`}>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                      <span>{msg.role === 'assistant' ? 'Kevin AI' : 'Candidate'}</span>
                      {msg.timestamp && (
                        <span className="text-gray-500 font-mono text-[9px]">
                          • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#E50914] text-white font-medium shadow-[0_4px_15px_rgba(229,9,20,0.3)] rounded-br-none'
                        : 'netflix-card text-gray-200 rounded-bl-none border border-white/10'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
