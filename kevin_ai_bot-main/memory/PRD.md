# Kevin AI Interviewer Platform - PRD

## Original Problem Statement
Build a platform where students can practice interviews with AI interviewer "Kevin". Features: Google OAuth, resume upload, AI interview system with GPT-4o-mini, voice input/output, evaluation reports with score visualization.

## Architecture
- **Frontend**: React + Tailwind CSS (Dark theme, Outfit/Manrope fonts)
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **AI**: OpenAI GPT-4o-mini via Emergent LLM key (emergentintegrations)
- **Auth**: Emergent Google OAuth with session cookies
- **Storage**: Emergent Object Storage for resume PDFs
- **Voice**: OpenAI Whisper STT via emergentintegrations

## User Personas
- **Students**: Practice interview skills before real interviews
- **Job seekers**: Get feedback on technical and communication abilities

## Core Requirements (Static)
1. Google OAuth login
2. Resume PDF upload with text extraction
3. AI-powered interview (Kevin) with follow-up questions
4. Text and voice input for answers
5. Evaluation report with scores (Technical, Communication, Confidence, Problem-Solving)
6. Reports dashboard with charts (Radar + Bar)

## What's Been Implemented (March 2026)
- [x] Full landing page with dark theme
- [x] Emergent Google OAuth integration
- [x] Dashboard with resume upload, start interview, past reports
- [x] Resume PDF upload to Object Storage + text extraction
- [x] AI Interview chat UI (ChatGPT-style) with Kevin AI
- [x] Voice input via Whisper STT
- [x] End interview → AI evaluation → structured report
- [x] Report detail page with Radar + Bar charts
- [x] Reports listing page
- [x] Profile page
- [x] Sidebar navigation
- [x] Protected routes with session verification

## Prioritized Backlog
### P0 - Done
- All core features implemented

### P1 - Nice to Have
- Text-to-speech for Kevin's responses (browser SpeechSynthesis)
- Interview timer/counter
- Resume preview in dashboard

### P2 - Future
- Multiple interview types (behavioral, system design, coding)
- Interview history with conversation replay
- PDF export of reports
- Social sharing of results
- Progress tracking over time

## Update: Voice-First Interview (March 2026)
- [x] Redesigned interview page to voice-first experience
- [x] Kevin speaks responses via browser Text-to-Speech
- [x] Large center-stage Kevin avatar with speaking animations
- [x] Big microphone button as primary input (Whisper STT)
- [x] Text input as fallback
- [x] Collapsible transcript panel
- [x] Live interview timer (MM:SS)
- [x] Question counter (Q1, Q2...)
- [x] Mute toggle for Kevin's voice
- [x] Voice waveform visualization during speech/recording

## Update: Structured Interview Engine Upgrade (March 2026)
### New Features:
- [x] Interview Config System (type: technical/behavioural/mixed, level: fresher/mid/senior, role selection, duration: 10/15/30min)
- [x] Resume Structuring Engine (GPT parses resume → skills, projects, experience, education, tools JSON)
- [x] Question Planning System (distributes questions: 1 question ≈ 2 min, across all resume sections)
- [x] State Management (current_question, total_questions, covered_sections, current_section tracked in DB)
- [x] Enhanced Kevin Prompt (config-aware, structured resume, question plan, dynamic behavior)
- [x] Dynamic behavior (weak answer → follow-up, strong answer → next section, time ending → faster questions)
- [x] Structured Evaluation (improvements[], section_scores{}, config context)
- [x] Frontend Config Page with type/level/role/duration selection
- [x] Progress bars (question progress + time progress)
- [x] Section coverage indicators (skills 2/3, projects 1/2, etc.)
- [x] Current section badge
- [x] Countdown timer (remaining time)
- [x] Report improvements section + section breakdown scores

## Update: Production-Grade Kevin Prompt (March 2026)
### New Behaviors:
- [x] Mandatory Introduction Round - Kevin ALWAYS starts with "Can you briefly introduce yourself?"
- [x] Empty/Silent Response Detection - Detects "ok", "hmm", "idk", single-word non-answers
- [x] Dynamic Response to Weak Answers - Kevin rephrases, digs deeper, or suggests moving on
- [x] Multiple Empty Response Alert - After 2+ empty responses: "Would you like to continue?"
- [x] Incomplete Interview Detection - <2 meaningful responses → status:incomplete, no fake evaluation
- [x] Strict Interview Flow Order: Intro → Project Deep Dive → Experience → DSA → Skills → Behavioural
- [x] Phase Tracking (introduction → project_deep_dive → experience → dsa_problem_solving → skills_and_wrapup)
- [x] Honest Scoring (strict rubric: 1-3 poor, 4-5 below avg, 6-7 avg, 8-9 good, 10 exceptional)
- [x] Natural Interview Personality ("Hmm...", "Interesting...", "That's not very clear")
- [x] Incomplete Report UI - Warning banner + Retake Interview button
- [x] NEVER hallucinate answers or generate fake feedback
