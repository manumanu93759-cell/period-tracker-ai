import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Import the actual AI logic from ai.py
from ai import get_ai_suggestions

load_dotenv()

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AIRequest(BaseModel):
    period_phase: str
    mood: str
    pain_level: int
    energy_level: str
    sleep_quality: str

class PeriodRequest(BaseModel):
    start_date: str
    end_date: str | None = None

@app.get("/")
def serve_frontend():
    return FileResponse("index.html")

@app.get("/api/health-check")
def health_check():
    api_key = os.getenv("GROQ_API_KEY")
    is_configured = api_key is not None and api_key.startswith("gsk_")
    return {"openai_configured": is_configured}

@app.post("/api/ai-suggestions")
def analyze_health(req: AIRequest):
    try:
        data = get_ai_suggestions(
            period_phase=req.period_phase,
            mood=req.mood,
            pain_level=req.pain_level,
            energy_level=req.energy_level,
            sleep_quality=req.sleep_quality
        )
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/period")
def log_period(req: PeriodRequest):
    # This just mocks a successful save to the backend.
    return {"status": "success", "message": "Period logged successfully"}
