# NexusAI — 10-Minute User Feedback Automation (n8n Guide)

## Overview
Yeh automated workflow n8n ke through execute hota hai. Jab bhi koi naya user **NexusAI** par register/signup karta hai:
1. **Instant Welcome Email** chala jata hai.
2. **n8n Wait Node (10 Minutes)** — n8n 10 minute tak delay karta hai taaki user platform ko explore kar sake.
3. **10-Min Feedback Request Email** — 10 minute complete hote hi user ke registered email par ek personalized dark-mode feedback email send hota hai.
4. **n8n Hosted Feedback Form** — User email me diye gaye button ya 1-click star rating par click karke direct n8n Form page par pahunchta hai.
5. **Admin Instant Alert** — Form submit hote hi admin email (`ydvhimanshu461@gmail.com`) par full feedback report instant receive hoti hai aur backend database (`/api/feedback`) par bhi record ho sakti hai.

---

## Files in this Directory

| File | Purpose |
| :--- | :--- |
| **`user_signup_welcome_email.json`** | Main auth workflow (OTP + Signup Welcome + **10-minute Wait Node** + **Feedback Email Send**). |
| **`nexusai_feedback_form_workflow.json`** | n8n hosted **Feedback Form Trigger** + Admin alert notification email. |
| **`chat_email_sender.json`** | Generic chat email sender workflow. |

---

## Form Fields Included

Aapke requirement ke mutabik humne ye fields configure kiye hain:
- **Your Name** (Pre-filled / editable)
- **Registered Email** (Pre-filled / editable)
- **Overall Experience Rating** (`⭐⭐⭐⭐⭐` 1 to 5 Stars dropdown)
- **Primary Feature Tested** (*Engineer AI, Research AI, Automation Agent, Education AI, MCP Registry, UI*)
- **Koi suggestion hai improvement ka?** (*Detailed Textarea — Suggestions, UX friction, improvements*)
- **What new features or tools would you like us to add next?** (*Textarea*)
- **Did you encounter any bugs, glitches, or errors?** (*Yes / No*)
- **Bug / Error description** (*Optional textarea*)
- **NPS Score (1-10)** (*How likely to recommend to a colleague*)

---

## How to Import & Activate in n8n

### Step 1: Open your n8n Dashboard
Go to your n8n instance:
👉 `https://himanshuydvv-neuroforge-n8n.hf.space` (or local `http://localhost:5678`)

### Step 2: Import Main Workflow (`user_signup_welcome_email.json`)
1. In n8n, click **Workflows** → **Add Workflow** (top right) → click the 3 dots **`...`** menu → **Import from File**.
2. Select `d:\Gen AI\Nexus-ai\n8n_workflows\user_signup_welcome_email.json`.
3. In both Brevo HTTP Request nodes, update `<YOUR_BREVO_API_KEY>` with your Brevo API key (or environment variable).
4. Click **Save** and toggle the workflow switch to **Active**.

### Step 3: Import Feedback Form Workflow (`nexusai_feedback_form_workflow.json`)
1. Click **Add Workflow** → **`...`** → **Import from File**.
2. Select `d:\Gen AI\Nexus-ai\n8n_workflows\nexusai_feedback_form_workflow.json`.
3. In the Brevo HTTP Request node, update `<YOUR_BREVO_API_KEY>`.
4. Click **Save** and toggle to **Active**.
5. n8n will provide you with the public form URL:
   `https://himanshuydvv-neuroforge-n8n.hf.space/form/nexusai-feedback`

---

## Backend Integration
Backend me bhi feedback persist karne ke liye API route add kar diya gaya hai:
- **Endpoint**: `POST http://localhost:8000/api/feedback`
- **MongoDB Collection**: `feedbacks`
- **Fetch Recent Feedbacks**: `GET http://localhost:8000/api/feedback`
