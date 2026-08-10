import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
from config import get_settings

logger = logging.getLogger(__name__)

async def send_verification_email(to_email: str, user_name: str, verification_url: str) -> bool:
    settings = get_settings()
    smtp_email = settings.smtp_email
    smtp_password = settings.smtp_password

    if not smtp_email or not smtp_password:
        logger.error("SMTP email or password is not configured.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Activate Your Kevin AI Candidate Account"
    msg["From"] = f"Kevin AI Support <{smtp_email}>"
    msg["To"] = to_email

    text_body = f"""Hi {user_name},

Thank you for registering on Kevin AI! Please verify your Gmail address by clicking the link below:

{verification_url}

This verification link expires in 24 hours.

If you did not create an account on Kevin AI, please ignore this email.

Best regards,
The Kevin AI Team
"""

    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activate Your Kevin AI Account</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #050505;
      color: #ffffff;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }}
    .email-wrapper {{
      width: 100%;
      background-color: #050505;
      padding: 40px 15px;
      box-sizing: border-box;
    }}
    .card {{
      max-width: 540px;
      margin: 0 auto;
      background: #0d0d12;
      border: 1px solid rgba(229, 9, 20, 0.35);
      border-radius: 24px;
      padding: 40px 32px;
      box-shadow: 0 0 50px rgba(229, 9, 20, 0.25);
    }}
    .header {{
      text-align: center;
      margin-bottom: 32px;
    }}
    .logo-badge {{
      display: inline-block;
      width: 44px;
      height: 44px;
      line-height: 44px;
      background: linear-gradient(135deg, #B20710 0%, #E50914 100%);
      border-radius: 12px;
      font-size: 22px;
      font-weight: 900;
      color: #ffffff;
      text-align: center;
      box-shadow: 0 0 20px rgba(229, 9, 20, 0.6);
      vertical-align: middle;
    }}
    .brand-name {{
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      margin-left: 10px;
      vertical-align: middle;
      letter-spacing: -0.5px;
    }}
    .brand-red {{
      color: #E50914;
    }}
    h1 {{
      font-size: 26px;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 12px 0;
      letter-spacing: -0.5px;
      text-align: center;
    }}
    p {{
      font-size: 15px;
      line-height: 1.6;
      color: #d1d5db;
      margin: 0 0 20px 0;
    }}
    .features-box {{
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 20px;
      margin: 24px 0;
    }}
    .feature-item {{
      font-size: 13px;
      color: #e5e7eb;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
    }}
    .feature-item:last-child {{
      margin-bottom: 0;
    }}
    .feature-icon {{
      color: #E50914;
      font-weight: bold;
      margin-right: 10px;
      font-size: 16px;
    }}
    .cta-container {{
      text-align: center;
      margin: 32px 0 24px 0;
    }}
    .btn {{
      display: inline-block;
      background: linear-gradient(135deg, #E50914 0%, #B20710 100%);
      color: #ffffff !important;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      padding: 16px 36px;
      border-radius: 50px;
      box-shadow: 0 0 30px rgba(229, 9, 20, 0.5);
      letter-spacing: 0.2px;
    }}
    .link-fallback {{
      font-size: 12px;
      color: #9ca3af;
      word-break: break-all;
      text-align: center;
      margin-top: 20px;
    }}
    .link-fallback a {{
      color: #E50914;
      text-decoration: underline;
    }}
    .expiry-note {{
      font-size: 12px;
      color: #6b7280;
      text-align: center;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }}
    .footer {{
      margin-top: 28px;
      font-size: 11px;
      color: #4b5563;
      text-align: center;
      line-height: 1.5;
    }}
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="card">
      <div class="header">
        <span class="logo-badge">K</span>
        <span class="brand-name">Kevin <span class="brand-red">AI</span></span>
      </div>

      <h1>Verify Your Gmail Address</h1>
      
      <p>Hi <strong>{user_name}</strong>,</p>
      <p>Welcome to Kevin AI! Please click the button below to verify your Gmail address and instantly log in to your candidate portal:</p>

      <div class="features-box">
        <div class="feature-item"><span class="feature-icon">✓</span> <strong>1 Free AI Mock Interview Session</strong> (10 Minutes)</div>
        <div class="feature-item"><span class="feature-icon">✓</span> <strong>Real-Time Voice Speech & Transcript Studio</strong></div>
        <div class="feature-item"><span class="feature-icon">✓</span> <strong>Detailed Performance Scorecard & Feedback Report</strong></div>
      </div>

      <div class="cta-container">
        <a href="{verification_url}" class="btn" target="_blank">Verify Email & Auto Log In →</a>
      </div>

      <div class="link-fallback">
        Button not working? Copy and paste this URL into your browser:<br>
        <a href="{verification_url}" target="_blank">{verification_url}</a>
      </div>

      <div class="expiry-note">
        This link is valid for 24 hours. If you did not sign up for a Kevin AI account, please ignore this email.
      </div>
    </div>

    <div class="footer">
      © 2026 Kevin AI Platform. All rights reserved.<br>
      AI Mock Interviewing & Candidate Evaluation System.
    </div>
  </div>
</body>
</html>"""

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        clean_password = smtp_password.replace(" ", "").strip()
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
        server.starttls()
        server.login(smtp_email.strip(), clean_password)
        server.sendmail(smtp_email.strip(), [to_email.strip()], msg.as_string())
        server.quit()
        logger.info(f"Verification email successfully sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send SMTP verification email to {to_email}: {str(e)}")
        return False
