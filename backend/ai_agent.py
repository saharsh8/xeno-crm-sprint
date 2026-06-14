import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

# Load API key from your .env file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY", "")
genai.configure(api_key=api_key)

# We use the flash model for blazing fast responses
model = genai.GenerativeModel('gemini-2.5-flash')

def generate_campaign_intelligence(user_prompt: str, channel: str):
    """
    Takes natural language and returns a structured JSON object with 
    database filters, generated copy, and an explanation via Gemini.
    """
    system_prompt = f"""
    You are an AI-Native CRM Assistant for a retail brand. 
    A marketer wants to create a {channel} campaign.
    Their request: "{user_prompt}"

    You must return a valid JSON object with EXACTLY these three keys:
    1. "min_spend": (integer) The minimum lifetime value to filter customers by based on the prompt. If not specified, use 0.
    2. "message_template": (string) A personalized {channel} message. Use [Name] as a placeholder for the customer's name. Keep it engaging.
    3. "ai_rationale": (string) A 1-2 sentence explanation of WHY this audience and message strategy is effective for this specific prompt.

    Return ONLY raw JSON. No markdown formatting, no code blocks.
    """

    try:
        response = model.generate_content(system_prompt)
        raw_output = response.text.strip()
        
        # Safely clean up markdown formatting if Gemini adds it
        raw_output = raw_output.replace("```json", "").replace("```", "").strip()
            
        return json.loads(raw_output)
        
    except Exception as e:
        print(f"AI Generation Error: {e}")
        # Fallback if API fails or key is missing
        return {
            "min_spend": 50,
            "message_template": f"Hey [Name], we have an exclusive {channel} offer just for you!",
            "ai_rationale": "Fallback segment targeting standard active users due to AI service timeout."
        }