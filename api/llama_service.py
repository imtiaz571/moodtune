import os
import json
import re
import json_repair
from openai import OpenAI
from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv()

class TrackRecommendation(BaseModel):
    title: str = Field(description="The title of the song")
    artist: str = Field(description="The artist of the song")
    reason: str = Field(description="A one-line reason why this track matches the mood")

class MoodResponse(BaseModel):
    chat_title: str = Field(
        default="",
        description=(
            "A short, catchy title for this chat session. RULES: "
            "1) If you are asking questions because you don't know the user's age, language, or taste yet, set this to an EMPTY STRING ''. "
            "2) If you are providing song recommendations (either because you have all preferences or just asked for them), generate a catchy title that combines the user's language + mood + genre "
            "(e.g. 'Bangla Moody Romantic Mix', 'English Chill Pop Vibes', 'Hindi Sad Lofi Mix'). Maximum 5 words."
        )
    )
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
            "Provide exactly 20 track recommendations ONLY when the user asks for a playlist or songs. "
            "Leave this null when just chatting."
        )
    )

class LlamaService:
    def __init__(self):
        # We use the NVIDIA API (Llama).
        self.nvidia_client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=os.getenv("NVIDIA_API_KEY", "dummy_key")
        )

    def get_mood_recommendation(self, user_input: str, user_prefs: dict = None, history: list[dict] = None, recent_tracks: list[dict] = None, top_artists: list[str] = None, liked_songs: list[dict] = None) -> MoodResponse | None:
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
            "5. When providing recommendations, include EXACTLY 20 songs with short, engaging reasons "
            "that connect back to the mood.\n\n"
            "NEVER give generic, one-size-fits-all responses. Every reply should FEEL different "
            "based on the user's emotional state."
        )

        if user_prefs and user_prefs.get('age') and user_prefs.get('language') and user_prefs.get('genre'):
            system_instruction += (
                f"\n\nCRITICAL INSTRUCTION FOR RECOMMENDATIONS:\n"
                f"You ALREADY know the user's preferences:\n"
                f"- Age: {user_prefs.get('age')}\n"
                f"- Preferred Language: {user_prefs.get('language')}\n"
                f"- Music Taste: {user_prefs.get('genre')}\n"
            )
            
            favorite_artists = user_prefs.get('favorite_artists')
            if favorite_artists:
                artist_names = [a.get('name') for a in favorite_artists if a.get('name')]
                system_instruction += f"- Favorite Artists: {', '.join(artist_names)}\n"
                system_instruction += "IMPORTANT: Since the user has explicitly provided favorite artists, heavily prioritize recommending tracks by these artists or very similar artists.\n"
            
            obscurity = user_prefs.get('obscurity', 'any')
            if obscurity and obscurity != 'any':
                system_instruction += f"- Obscurity Level: {obscurity.title()}\n"
                system_instruction += f"IMPORTANT: You MUST tailor the obscurity of the recommendations to '{obscurity}'. E.g. if 'underground', avoid top 40 mainstream pop.\n"
                
            era = user_prefs.get('era', 'any')
            if era and era != 'any':
                system_instruction += f"- Preferred Era: {era}\n"
                system_instruction += f"IMPORTANT: Prioritize songs released in the {era}.\n"
                
            system_instruction += "\n"
                
            system_instruction += (
                f"DO NOT ASK the user for these preferences anymore. Just give them recommendations right away based on this information! "
                f"IMMEDIATELY provide a playlist tailored to their mood, age, language, and music taste. "
                f"Always set the chat_title when giving recommendations."
            )
        else:
            # Ongoing Onboarding Instruction
            system_instruction += (
                "\n\nCRITICAL INSTRUCTION FOR ONBOARDING:\n"
                "To personalize the experience, you MUST collect the user's: 1) Age, 2) Preferred Language, and 3) Music Taste.\n"
                "CRITICAL RULE: You MUST ask these questions ONE BY ONE. DO NOT ask them all at once.\n"
                "If this is the first message, warmly greet them, acknowledge their mood, and ONLY ask for their Age.\n"
                "In the following turns, acknowledge their answer and ask the next missing piece of information.\n"
                "DO NOT provide song recommendations until you have collected ALL THREE pieces of information.\n\n"
                "CHAT TITLE RULE:\n"
                "- While you are still collecting onboarding info (age, language, music taste), set chat_title to EMPTY STRING ''.\n"
                "- The MOMENT you have all three pieces AND are about to give song recommendations, "
                "you MUST set chat_title to a catchy name combining their language + mood + genre. "
                "Examples: 'Bangla Moody Romantic Mix', 'English Chill Pop Vibes', 'Hindi Sad Lofi Mix'. "
                "MANDATORY — never leave chat_title empty once you give recommendations."
            )

        if recent_tracks:
            track_names = [f"{t['title']} by {t['artist']}" for t in recent_tracks]
            system_instruction += (
                f"\n\nCRITICAL INSTRUCTION FOR ANTI-ECHO CHAMBER:\n"
                f"The user has recently listened to the following tracks:\n"
                f"{', '.join(track_names)}\n"
                f"DO NOT recommend any of these exact tracks. We want 100% fresh discovery!"
            )

        if top_artists:
            system_instruction += (
                f"\n\nSPOTIFY TOP ARTISTS CONTEXT:\n"
                f"The user is currently obsessed with these artists on Spotify: {', '.join(top_artists)}.\n"
                f"Strongly consider including these artists or highly similar artists in your recommendations."
            )

        if liked_songs:
            liked_names = [f"{t['title']} by {t['artist']}" for t in liked_songs]
            system_instruction += (
                f"\n\nSPOTIFY LIKED SONGS CONTEXT:\n"
                f"Here is a sample of the user's recently Liked Songs on Spotify:\n"
                f"{', '.join(liked_names)}\n"
                f"Use this to deeply understand their specific taste. IF the user explicitly asks you to build a playlist 'from their liked songs' or 'using only liked songs', you MUST select tracks exclusively from this list."
            )

        messages = [
            {
                "role": "system", 
                "content": system_instruction + "\n\nYou MUST respond with valid JSON matching this exact structure: {\"detected_mood\": \"string\", \"reply\": \"string\", \"chat_title\": \"string\", \"recommendations\": [{\"title\": \"string\", \"artist\": \"string\", \"reason\": \"string\"}]}. If no recommendations, use null for the recommendations array. Do not include markdown code blocks like ```json."
            }
        ]
        
        for msg in (history or []):
            role = "assistant" if msg['role'] == "model" else msg['role']
            messages.append({"role": role, "content": msg['text']})
            
        messages.append({"role": "user", "content": user_input})
        
        try:
            completion = self.nvidia_client.chat.completions.create(
                model="meta/llama-3.1-8b-instruct",
                messages=messages,
                temperature=0.85,
                top_p=0.95,
                max_tokens=4096,
                stream=False
            )
            content = completion.choices[0].message.content
        except Exception as e:
            print(f"Nvidia API failed: {e}")
            return MoodResponse(
                detected_mood="neutral",
                chat_title="",
                reply="I'm sorry, but my AI system is currently unavailable. Please check your API keys and quotas in the .env file.",
                recommendations=None
            )
            
        try:
            # Extract JSON object in case there's markdown or extra text
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                content = match.group(0)
                
            data = json_repair.loads(content)
            return MoodResponse(**data)
        except Exception as e:
            print("Failed to parse Nvidia response as JSON:", e)
            print("Raw content:", content)
            return MoodResponse(
                detected_mood="neutral", 
                chat_title="",
                reply=content, 
                recommendations=None
            )

    def clear_history(self):
        pass
