# 🌸 AI Smart Period Tracker — OpenAI Integration Guide

---

## 📁 Folder Structure

```
period-tracker-ai/
├── backend/
│   ├── main.py              ← FastAPI server (all routes)
│   ├── ai.py                ← OpenAI logic (isolated here)
│   ├── requirements.txt     ← Python packages
│   └── .env.example         ← Copy this to .env and add your key
├── frontend/
│   └── index.html           ← Full app (open in browser)
├── data/
│   └── tracker_data.json    ← Auto-created when you log data
└── README.md
```

---

## 🔑 Step 1 — Get Your OpenAI API Key

1. Go to: https://platform.openai.com/api-keys
2. Click **"Create new secret key"**
3. Copy the key (starts with `sk-...`)
4. You need to add a credit card — usage is very cheap (~$0.001 per request)

---

## ⚙️ Step 2 — Create Your .env File

In the `backend/` folder, create a file called exactly `.env`:

**On Mac / Linux:**
```bash
cd backend
cp .env.example .env
```

**On Windows (Command Prompt):**
```cmd
cd backend
copy .env.example .env
```

Now open `.env` in any text editor and paste your key:

```
OPENAI_API_KEY=sk-your-actual-key-here
```

> ⚠️ NEVER share your .env file or commit it to GitHub!
> Add `.env` to your `.gitignore` file.

---

## 🐍 Step 3 — Install Python Dependencies

Make sure Python 3.9+ is installed: https://www.python.org/downloads/

Open terminal in the `backend/` folder:

```bash
# Install all required packages
pip install -r requirements.txt
```

Or install manually:
```bash
pip install fastapi uvicorn pydantic openai python-dotenv
```

---

## 🚀 Step 4 — Start the Backend Server

Still in the `backend/` folder:

```bash
uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
```

Leave this terminal window open while using the app!

---

## 🌸 Step 5 — Open the App

Just open `frontend/index.html` in your browser.

**The green "AI Ready ✅" indicator in the top-right means everything is working!**

---

## 🧪 Test the AI Endpoint

Visit http://localhost:8000/docs in your browser to see the interactive API tester.

Or test with curl:
```bash
curl -X POST http://localhost:8000/api/ai-suggestions \
  -H "Content-Type: application/json" \
  -d '{
    "period_phase": "menstrual",
    "mood": "Tired",
    "pain_level": 7,
    "energy_level": "Low",
    "sleep_quality": "Poor"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "food_suggestions": ["Iron-rich spinach omelette", ...],
    "exercise_suggestions": ["Gentle yin yoga", ...],
    "health_tips": ["Drink warm water with lemon", ...],
    "mood_analysis": "Feeling tired during your period is completely normal...",
    "phase": "menstrual",
    "model_used": "gpt-3.5-turbo"
  }
}
```

---

## 🔒 Security — How the API Key is Protected

```
Browser (Frontend)
       │
       │  POST /api/ai-suggestions
       │  { mood, pain, phase... }          ← No API key here!
       ▼
FastAPI Backend (localhost:8000)
       │
       │  Reads OPENAI_API_KEY from .env
       │  Calls OpenAI API securely
       ▼
OpenAI API ← API key only travels here, server-side
```

**The frontend never sees your API key.** It only talks to your local FastAPI server.

---

## 🤖 AI Model

The app uses **gpt-3.5-turbo** by default (fast + affordable).

To use GPT-4 for better results, edit `backend/ai.py` line ~50:
```python
model="gpt-4o",   # or "gpt-4-turbo"
```

Approximate costs:
| Model | Cost per AI suggestion |
|-------|----------------------|
| gpt-3.5-turbo | ~$0.001 |
| gpt-4o | ~$0.005 |

---

## 🛠️ Troubleshooting

**"Server offline" in top bar?**
→ Make sure you ran `uvicorn main:app --reload --port 8000`
→ Check the terminal for error messages

**"No API Key ⚠️"?**
→ Check your `.env` file exists in the `backend/` folder
→ Make sure the key starts with `sk-`
→ Restart the uvicorn server after editing .env

**"Invalid API key" error?**
→ Your OpenAI key may be wrong or expired
→ Generate a new key at https://platform.openai.com/api-keys

**"Rate limit" error?**
→ Wait a few seconds and try again
→ Check your OpenAI usage at https://platform.openai.com/usage

**Port 8000 already in use?**
```bash
uvicorn main:app --reload --port 8001
```
Then change `API_BASE` in `frontend/index.html` to `http://localhost:8001`

---

## 📱 Mobile Access (same WiFi)

To use on your phone:
1. Find your computer's IP: run `ipconfig` (Windows) or `ifconfig` (Mac)
2. Start server: `uvicorn main:app --reload --host 0.0.0.0 --port 8000`
3. In `index.html`, change `API_BASE` to `http://YOUR_IP:8000`
4. Open `index.html` on your phone browser

---

Built with ❤️ — FastAPI + OpenAI + pure HTML/CSS/JS
