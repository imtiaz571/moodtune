import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

load_dotenv()

class TrackRecommendation(BaseModel):
    title: str = Field(description="The title of the song")
    artist: str = Field(description="The artist of the song")
    reason: str = Field(description="A one-line reason why this track matches the mood")

class MoodResponse(BaseModel):
    detected_mood: str = Field(
        description=(
            "The mood you detected from the user's message. Must be one of: "
            "happy, sad, angry, anxious, chill, romantic, energetic, melancholic, "
            "nostalgic, hopeful, lonely, confident, neutral"
        )
    )
    reply: str = Field(
        description=(
            "A conversational reply whose tone, energy, and language MATCH the detected mood. "
            "For example: gentle and comforting when sad, hype and exclamatory when happy, "
            "calm and reassuring when anxious, bold and fierce when angry."
        )
    )
    recommendations: list[TrackRecommendation] | None = Field(
        default=None,
        description=(
            "Provide 6-8 track recommendations ONLY when the user asks for a playlist or songs. "
            "Leave this null when just chatting."
        )
    )

class GeminiService:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key or api_key == "your_gemini_api_key_here":
            print("WARNING: GEMINI_API_KEY not set or is default.")
            self.client = None
        else:
            self.client = genai.Client(api_key=api_key)
        
        # We will keep a simple list-based history for the chat API
        self.history = []

    def get_mood_recommendation(self, user_input: str) -> MoodResponse | None:
        if not self.client:
            raise Exception("Gemini API key is missing.")

        # System prompt: mood-adaptive persona
        system_instruction = (
            "You are MoodTunes, an emotionally intelligent music companion.\n\n"
            "CRITICAL RULE — MOOD-ADAPTIVE REPLIES:\n"
            "1. FIRST, detect the user's emotional state from their message.\n"
            "2. THEN, adapt your ENTIRE reply to match that mood:\n"
            "   • SAD / MELANCHOLIC → Be gentle, warm, and comforting. Use soft language. "
            "     e.g. 'I hear you... sometimes music is the best medicine. Let me find something that understands.'\n"
            "   • HAPPY / ENERGETIC → Be enthusiastic, use exclamations and emojis! "
            "     e.g. 'YESSS! 🎉 That energy is contagious! Let's keep the vibes going!'\n"
            "   • ANGRY → Be validating and bold. Match their fire. "
            "     e.g. 'I get it. Sometimes you just need something raw and powerful to let it out.'\n"
            "   • ANXIOUS → Be calm, reassuring, grounding. "
            "     e.g. 'Hey, take a breath. I've got some tracks that feel like a warm blanket.'\n"
            "   • ROMANTIC → Be dreamy and poetic. "
            "     e.g. 'Ah, love is in the air~ Let me set the perfect soundtrack for that feeling.'\n"
            "   • NOSTALGIC → Be wistful and reflective. "
            "     e.g. 'Those memories deserve the perfect soundtrack. Let me take you back...'\n"
            "   • CHILL → Be laid-back and easy-going. "
            "     e.g. 'Nice, just vibing. I got you — smooth tunes incoming.'\n"
            "   • CONFIDENT → Be hyped and empowering. "
            "     e.g. 'You're radiating main-character energy! 🔥 Let's get a power playlist going!'\n"
            "   • LONELY → Be a compassionate friend. "
            "     e.g. 'You're not alone in this. Music has a way of sitting with you when words can't.'\n"
            "   • HOPEFUL → Be uplifting and encouraging. "
            "     e.g. 'That's the spirit! ✨ Let me find tracks that fuel that optimism.'\n"
            "   • NEUTRAL / UNKNOWN → Be friendly and curious, ask about their mood.\n\n"
            "3. Song recommendations MUST also match the detected mood — "
            "don't suggest party bangers when someone is heartbroken.\n"
            "4. Only populate the 'recommendations' array when you have enough context "
            "and they explicitly want recommendations. If just chatting, leave it null.\n"
            "5. When providing recommendations, include 6-8 songs with short, engaging reasons "
            "that connect back to the mood.\n\n"
            "NEVER give generic, one-size-fits-all responses. Every reply should FEEL different "
            "based on the user's emotional state."
        )

        # Build contents with history
        contents = []
        for msg in self.history:
            contents.append(types.Content(role=msg['role'], parts=[types.Part.from_text(text=msg['text'])]))
        
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=user_input)]))

        try:
            response = self.client.models.generate_content(
                model="gemini-3.5-flash",
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_schema=MoodResponse,
                    temperature=0.85,
                ),
            )
            
            # Save to history
            self.history.append({"role": "user", "text": user_input})
            if response.parsed:
                self.history.append({"role": "model", "text": response.parsed.reply})
            elif response.text:
                 self.history.append({"role": "model", "text": response.text})
                 
            return response.parsed
        except Exception as e:
            print(f"Error generating content: {e}")
            raise

    def clear_history(self):
        self.history = []
