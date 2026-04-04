exports.handler = async (event, context) => {
  // 1. Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed - Only POST requests are accepted." })
    };
  }

  // 2. Validate Environment Variable
  if (!process.env.GROQ_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server Configuration Error: GROQ_API_KEY is missing." })
    };
  }

  try {
    // 3. Parse Frontend Data
    const data = JSON.parse(event.body);
    const { period_phase, mood, pain_level, energy_level, sleep_quality } = data;

    const systemPrompt = `
You are a warm, knowledgeable women's health assistant specialising in menstrual health.
Your tone must be:
- Friendly and encouraging
- Simple English
- Empathetic and supportive

Return response as valid JSON with EXACTLY these keys:
"food_suggestions" (list of 5)
"exercise_suggestions" (list of 4)
"health_tips" (list of 4)
"mood_analysis" (2 sentences)
`;

    const userPrompt = `
User health data:
Phase: ${period_phase}
Mood: ${mood}
Pain: ${pain_level}/10
Energy: ${energy_level}
Sleep: ${sleep_quality}

Return JSON only.
`;

    // 4. Call AI Provider 
    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });

    if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI Provider Error:", errorText);
        return {
            statusCode: aiResponse.status,
            body: JSON.stringify({ error: `Groq connection failed: ${errorText}` })
        };
    }

    const aiData = await aiResponse.json();
    const resultContent = aiData.choices[0].message.content;
    const parsedContent = JSON.parse(resultContent);

    // 5. Return structured JSON exactly how the frontend expects it
    return {
      statusCode: 200,
      body: JSON.stringify({
        data: {
          food_suggestions: parsedContent.food_suggestions || [],
          exercise_suggestions: parsedContent.exercise_suggestions || [],
          health_tips: parsedContent.health_tips || [],
          mood_analysis: parsedContent.mood_analysis || "",
          phase: period_phase
        }
      })
    };

  } catch (error) {
    console.error("Netlify Function Execution Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error in Netlify Function." })
    };
  }
};
