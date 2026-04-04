"""
ai.py — AI suggestion engine for the Period Tracker
All OpenAI calls live here, isolated from the rest of the app.
"""

import os
from openai import OpenAI
from dotenv import load_dotenv

# Load .env file automatically
load_dotenv()

# ── Client ────────────────────────────────────────────────────────────────────
# The API key is read from the GROQ_API_KEY environment variable.
# Pointing the OpenAI library to use the free and fast Groq endpoint:
client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

# ── Phase Descriptions ────────────────────────────────────────────────────────
PHASE_DESCRIPTIONS = {
    "menstrual":  "The user is currently ON their period (menstrual phase, days 1–5).",
    "follicular": "The user just finished their period (follicular phase, days 6–13). Energy is returning.",
    "ovulation":  "The user is in the ovulation phase (days 14–16). Energy and mood are typically at peak.",
    "luteal":     "The user is in the pre-period / PMS phase (luteal phase, days 17–28). Mood swings and bloating are common.",
}

# ── Main AI Function ──────────────────────────────────────────────────────────
def get_ai_suggestions(
    period_phase: str,
    mood: str,
    pain_level: int,
    energy_level: str,
    sleep_quality: str,
) -> dict:
    """
    Sends user health data to OpenAI and returns personalised suggestions.

    Parameters
    ----------
    period_phase  : "menstrual" | "follicular" | "ovulation" | "luteal"
    mood          : "Happy" | "Sad" | "Irritated" | "Tired"
    pain_level    : integer 1–10
    energy_level  : "Low" | "Medium" | "High"
    sleep_quality : "Poor" | "Okay" | "Good" | "Great"

    Returns
    -------
    dict with keys: food_suggestions, exercise_suggestions, health_tips, mood_analysis
    """

    phase_context = PHASE_DESCRIPTIONS.get(
        period_phase.lower(),
        "The user is tracking their menstrual cycle."
    )

    # ── System Prompt ──────────────────────────────────────────────────────────
    system_prompt = """
You are a warm, knowledgeable women's health assistant specialising in menstrual health.
Your audience is teenage girls and young women aged 13–25.

Your tone must be:
- Friendly and encouraging (never clinical or scary)
- Simple English — avoid medical jargon
- Empathetic and supportive

You always return your response as a valid JSON object with EXACTLY these four keys:
  "food_suggestions"    — list of 5 specific food recommendations
  "exercise_suggestions"— list of 4 specific exercise recommendations
  "health_tips"         — list of 4 actionable health/self-care tips
  "mood_analysis"       — 2-sentence empathetic analysis of the user's current mood

Do NOT include markdown, code fences, or any text outside the JSON object.
""".strip()

    # ── User Prompt ────────────────────────────────────────────────────────────
    user_prompt = f"""
Here is today's health check-in for the user:

- Menstrual phase  : {period_phase}  ({phase_context})
- Current mood     : {mood}
- Pain level       : {pain_level} / 10
- Energy level     : {energy_level}
- Sleep quality    : {sleep_quality}

Based on all of this, provide personalised:
1. Food suggestions that help with her current phase and symptoms
2. Exercise suggestions appropriate for her energy and pain level
3. Health tips tailored to what she is experiencing right now
4. A short, kind mood analysis with one encouragement sentence

Remember: respond ONLY with the JSON object.
""".strip()

    # ── API Call ───────────────────────────────────────────────────────────────
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile", # newer, currently supported Groq model
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.7,              # slight creativity while staying accurate
        max_tokens=600,
        response_format={"type": "json_object"},   # forces valid JSON back
    )

    # ── Parse Response ─────────────────────────────────────────────────────────
    import json
    raw = response.choices[0].message.content
    result = json.loads(raw)

    # Ensure all expected keys exist (defensive coding)
    return {
        "food_suggestions":     result.get("food_suggestions",     []),
        "exercise_suggestions": result.get("exercise_suggestions", []),
        "health_tips":          result.get("health_tips",          []),
        "mood_analysis":        result.get("mood_analysis",        ""),
        "phase":                period_phase,
        "model_used":           response.model,
    }
