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
    reply: str = Field(description="A natural conversational reply to the user")
    recommendations: list[TrackRecommendation] = Field(description="List of 6 to 8 track recommendations")

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

        # System prompt setting the persona
        system_instruction = (
            "You are MoodTunes, an enthusiastic and knowledgeable music recommendation assistant. "
            "Chat naturally with the user to understand their mood, genre preference, or direct request. "
            "Always return your response matching the requested JSON schema, containing both a friendly conversational 'reply' "
            "and a list of 6-8 song 'recommendations'. Make the reasons short and engaging."
        )

        # Build contents with history
        contents = []
        for msg in self.history:
            contents.append(types.Content(role=msg['role'], parts=[types.Part.from_text(text=msg['text'])]))
        
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=user_input)]))

        try:
            response = self.client.models.generate_content(
                model="gemini-1.5-flash",
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_schema=MoodResponse,
                    temperature=0.7,
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
