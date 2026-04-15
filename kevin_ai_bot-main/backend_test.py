import requests
import sys
import json
import time
from datetime import datetime

class KevinInterviewTester:
    def __init__(self, base_url="https://kevin-mock-interview.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = "test_config_session"
        self.user_id = "test-config-user"
        self.active_interview_id = None
        self.incomplete_interview_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
        
        # Add session token for auth
        test_headers['Authorization'] = f'Bearer {self.session_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    return success, response_data
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_auth_me(self):
        """Test authentication with test session"""
        success, response = self.run_test(
            "Auth Me",
            "GET",
            "auth/me",
            200
        )
        if success:
            print(f"   User: {response.get('name', 'Unknown')}")
            print(f"   Resume: {'Yes' if response.get('resume_text') else 'No'}")
            print(f"   Structured Resume: {'Yes' if response.get('structured_resume') else 'No'}")
        return success, response

    def test_start_interview_mandatory_intro(self):
        """Test starting interview returns Kevin's intro with 'introduce yourself' question"""
        config_data = {
            "interview_type": "mixed",
            "level": "mid",
            "role": "Software Developer",
            "duration": 15
        }
        
        success, response = self.run_test(
            "Start Interview - Mandatory Intro",
            "POST",
            "start-interview",
            200,
            data=config_data
        )
        
        if success:
            print(f"   Interview ID: {response.get('interview_id', 'N/A')}")
            print(f"   Status: {response.get('status', 'N/A')}")
            
            # Check state includes interview_phase field
            state = response.get('state', {})
            interview_phase = state.get('interview_phase')
            print(f"   Interview Phase: {interview_phase}")
            
            # Verify mandatory intro behavior
            message = response.get('message', '')
            has_intro = 'introduce yourself' in message.lower() or 'briefly introduce' in message.lower()
            print(f"   Has 'introduce yourself' question: {has_intro}")
            
            if interview_phase == 'introduction' and has_intro:
                print("✅ Mandatory intro behavior verified")
            else:
                print("❌ Mandatory intro behavior not working correctly")
            
            # Store interview ID for next tests
            if response.get('interview_id'):
                self.active_interview_id = response['interview_id']
        
        return success, response

    def test_empty_response_detection(self):
        """Test empty/irrelevant response detection and Kevin's rephrasing behavior"""
        # First send a meaningful response to establish context
        meaningful_answer = "I'm John, a software engineer with 3 years of experience in Python and JavaScript. I've worked on web applications and APIs."
        
        success1, response1 = self.run_test(
            "Meaningful Response (Setup)",
            "POST",
            "next-question",
            200,
            data={
                "interview_id": self.active_interview_id,
                "user_answer": meaningful_answer
            }
        )
        
        if not success1:
            return False, {}
        
        # Now test empty/irrelevant response
        empty_answer = "ok"
        
        success2, response2 = self.run_test(
            "Empty Response Detection",
            "POST",
            "next-question",
            200,
            data={
                "interview_id": self.active_interview_id,
                "user_answer": empty_answer
            }
        )
        
        if success2:
            message = response2.get('message', '').lower()
            state = response2.get('state', {})
            
            # Check for rephrasing behavior
            has_rephrasing = any(phrase in message for phrase in [
                'not sure', 'rephrase', 'let me', 'move on', 'different topic', 
                'elaborate', 'be more specific', 'having difficulty'
            ])
            
            print(f"   Kevin's response contains rephrasing: {has_rephrasing}")
            print(f"   Empty responses count: {state.get('empty_responses', 0)}")
            print(f"   Meaningful responses count: {state.get('meaningful_responses', 0)}")
            
            if has_rephrasing:
                print("✅ Empty response detection working correctly")
            else:
                print("❌ Empty response detection not working")
        
        return success2, response2

    def test_interview_phase_tracking(self):
        """Test interview phase transitions"""
        # Send another meaningful response to progress through phases
        detailed_answer = "I worked on a React e-commerce platform with Node.js backend. I implemented user authentication, payment processing, and inventory management. The biggest challenge was optimizing database queries for product search."
        
        success, response = self.run_test(
            "Interview Phase Tracking",
            "POST",
            "next-question",
            200,
            data={
                "interview_id": self.active_interview_id,
                "user_answer": detailed_answer
            }
        )
        
        if success:
            state = response.get('state', {})
            current_phase = state.get('interview_phase')
            current_q = state.get('current_question', 0)
            total_q = state.get('total_questions', 8)
            
            print(f"   Current Phase: {current_phase}")
            print(f"   Question Progress: {current_q}/{total_q}")
            print(f"   Covered Sections: {json.dumps(state.get('covered_sections', {}))}")
            
            # Verify phase is progressing correctly
            expected_phases = ['introduction', 'project_deep_dive', 'experience', 'dsa_problem_solving', 'skills_and_wrapup']
            if current_phase in expected_phases:
                print("✅ Interview phase tracking working correctly")
            else:
                print("❌ Interview phase tracking not working")
        
        return success, response

    def test_incomplete_interview_detection(self):
        """Test incomplete interview detection (< 2 meaningful responses)"""
        # Start a new interview for incomplete test
        config_data = {
            "interview_type": "mixed",
            "level": "fresher",
            "role": "Software Developer",
            "duration": 10
        }
        
        success1, response1 = self.run_test(
            "Start Incomplete Interview Test",
            "POST",
            "start-interview",
            200,
            data=config_data
        )
        
        if not success1:
            return False, {}
        
        self.incomplete_interview_id = response1.get('interview_id')
        
        # Send only 1 short response
        short_answer = "ok"
        
        success2, response2 = self.run_test(
            "Send Short Response",
            "POST",
            "next-question",
            200,
            data={
                "interview_id": self.incomplete_interview_id,
                "user_answer": short_answer
            }
        )
        
        if not success2:
            return False, {}
        
        # End the interview immediately
        success3, response3 = self.run_test(
            "End Incomplete Interview",
            "POST",
            "end-interview",
            200,
            data={"interview_id": self.incomplete_interview_id}
        )
        
        if success3:
            status = response3.get('status')
            verdict = response3.get('verdict')
            technical_score = response3.get('technical_score', 0)
            
            print(f"   Status: {status}")
            print(f"   Verdict: {verdict}")
            print(f"   Technical Score: {technical_score}")
            print(f"   Summary: {response3.get('summary', '')[:100]}...")
            
            # Verify incomplete detection
            is_incomplete = status == 'incomplete' and verdict == 'Incomplete' and technical_score == 0
            
            if is_incomplete:
                print("✅ Incomplete interview detection working correctly")
            else:
                print("❌ Incomplete interview detection not working")
        
        return success3, response3

    def test_complete_interview_evaluation(self):
        """Test complete interview with real evaluation"""
        # Send more meaningful responses to complete the interview
        responses = [
            "I have experience with microservices architecture and have built several REST APIs using FastAPI and Node.js.",
            "My biggest challenge was implementing real-time notifications using WebSockets and handling high concurrent connections.",
            "I use test-driven development and have experience with pytest, Jest, and integration testing strategies."
        ]
        
        for i, answer in enumerate(responses):
            success, response = self.run_test(
                f"Complete Interview Response {i+1}",
                "POST",
                "next-question",
                200,
                data={
                    "interview_id": self.active_interview_id,
                    "user_answer": answer
                }
            )
            
            if not success:
                return False, {}
            
            # Small delay to simulate real interview
            time.sleep(0.5)
        
        # End the complete interview
        success, response = self.run_test(
            "End Complete Interview",
            "POST",
            "end-interview",
            200,
            data={"interview_id": self.active_interview_id}
        )
        
        if success:
            status = response.get('status')
            verdict = response.get('verdict')
            technical_score = response.get('technical_score', 0)
            
            print(f"   Status: {status}")
            print(f"   Verdict: {verdict}")
            print(f"   Technical Score: {technical_score}")
            print(f"   Communication Score: {response.get('communication_score', 0)}")
            print(f"   Improvements: {len(response.get('improvements', []))} items")
            print(f"   Section Scores: {json.dumps(response.get('section_scores', {}))}")
            
            # Verify complete evaluation
            is_complete = status == 'completed' and technical_score > 0
            
            if is_complete:
                print("✅ Complete interview evaluation working correctly")
            else:
                print("❌ Complete interview evaluation not working")
        
        return success, response

    def test_get_resume(self):
        """Test getting resume data"""
        success, response = self.run_test(
            "Get Resume",
            "GET",
            "resume",
            200
        )
        
        if success:
            print(f"   Resume Text Length: {len(response.get('resume_text', ''))}")
            print(f"   Resume Filename: {response.get('resume_filename', 'N/A')}")
            structured = response.get('structured_resume')
            print(f"   Structured Resume: {'Yes' if structured else 'No'}")
        
        return success, response

def main():
    print("🚀 Starting Kevin AI Interviewer Backend Tests - Production Prompt Upgrade")
    print("=" * 80)
    
    tester = KevinInterviewTester()
    
    # Test sequence for production-grade prompt features
    print("\n📋 PHASE 1: Authentication & Resume")
    auth_success, user_data = tester.test_auth_me()
    if not auth_success:
        print("❌ Authentication failed, stopping tests")
        return 1
    
    tester.test_get_resume()
    
    print("\n📋 PHASE 2: Production-Grade Prompt Features")
    
    # Test mandatory intro behavior
    start_success, start_data = tester.test_start_interview_mandatory_intro()
    if not start_success:
        print("❌ Interview start failed, stopping tests")
        return 1
    
    # Test empty response detection
    tester.test_empty_response_detection()
    
    # Test interview phase tracking
    tester.test_interview_phase_tracking()
    
    print("\n📋 PHASE 3: Incomplete vs Complete Interview Detection")
    
    # Test incomplete interview detection
    tester.test_incomplete_interview_detection()
    
    # Test complete interview evaluation
    tester.test_complete_interview_evaluation()
    
    # Print results
    print("\n" + "=" * 80)
    print(f"📊 RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())