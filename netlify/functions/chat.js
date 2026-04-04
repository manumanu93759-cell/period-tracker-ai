exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }
  
  if (!process.env.GROQ_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "Missing GROQ_API_KEY endpoint configuration." }) };
  }
  
  try {
    const data = JSON.parse(event.body);
    const { messages, userContext } = data;
    const lang = userContext.locale || "en";
    const langNote =
      lang === "hi"
        ? "User UI language is Hindi; reply in Hindi unless they write in another language."
        : lang === "kn"
          ? "User UI language is Kannada; reply in Kannada unless they write in another language."
          : "User UI language is English.";

    const systemPrompt = `
You are 'Flow AI', a knowledgeable, empathetic women's health assistant for menstrual and general women's wellness.
Tone: warm, concise, practical. Use emojis sparingly and naturally.
Reply in plain text (not JSON). ${langNote}
User context (approximate, from local tracking — not medical fact):
- Cycle phase estimate: ${userContext.phase || "unknown"}
- Weighted avg cycle (days): ${userContext.weightedCycle ?? userContext.avgCycle ?? "unknown"}
- Next period (approx): ${userContext.nextPeriod || "unknown"}
- Ovulation estimate: ${userContext.ovulation || "unknown"}
- Irregularity flag: ${userContext.irregular ? "yes" : "no"}
- Top insight: ${userContext.riskSummary || "none noted"}
- Recent mood/pain summary: ${userContext.symptomSummary || "not provided"}

Safety: You are not a doctor. For serious pain, bleeding, pregnancy concerns, or mental health crisis, urge professional or emergency care. Every few replies, briefly remind users this is educational support, not a diagnosis.
`;

    // Prepend system prompt
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        return { statusCode: aiResponse.status, body: JSON.stringify({ error: `Groq Error: ${errorText}` }) };
    }
    
    const responseData = await aiResponse.json();
    
    return {
      statusCode: 200,
      body: JSON.stringify({ reply: responseData.choices[0].message.content })
    };

  } catch (error) {
    console.error("Chat proxy error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error in Chat route." })
    };
  }
};
