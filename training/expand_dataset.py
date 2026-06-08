import os
import json
import random
import time
from typing import List, Dict

# Try to import google-genai or litellm
try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Please install google-genai to use Vertex AI / Gemini API for dataset generation:")
    print("pip install google-genai")
    exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

TARGET_EXAMPLES = 2000
OUTPUT_FILE = "./dataset/fixit_train_expanded.jsonl"
EXISTING_FILE = "./dataset/fixit_train.jsonl"

# We will use Gemini to generate new scenarios based on these domains
DOMAINS = [
    "HVAC and Refrigeration",
    "Automotive Repair",
    "Software Engineering and DevOps",
    "Plumbing and Pipefitting",
    "Electrical Engineering and Wiring",
    "Carpentry and Construction",
    "Network Troubleshooting",
    "Consumer Electronics Repair",
    "Industrial Machinery Maintenance"
]

SYSTEM_PROMPT = """
You are an expert technical dataset generator.
Your task is to generate highly realistic, complex troubleshooting scenarios.

Format the output exactly as requested. Every problem MUST be solved using the FIXIT SLM Framework:
1. Observation (What is happening?)
2. Cause (Why is it happening?)
3. Effect (Real-life example)
4. Solution (How professionals fix it)
5. Verification (How to verify it's fixed)

The user will provide a domain. You must return 3 unique, realistic, and highly detailed technical scenarios from that domain.
Return ONLY valid JSON in this exact format:
[
  {
    "problem": "Describe the complex issue the user is facing",
    "observation": "...",
    "cause": "...",
    "effect": "...",
    "solution": "...",
    "verification": "..."
  }
]
"""

def init_client():
    """Initialize the Gemini client. Requires GEMINI_API_KEY environment variable."""
    if "GEMINI_API_KEY" not in os.environ:
        print("Error: GEMINI_API_KEY environment variable is not set.")
        print("Please set it: $env:GEMINI_API_KEY='your_api_key'")
        exit(1)
    
    return genai.Client()

def generate_batch(client: genai.Client, domain: str) -> List[Dict]:
    """Generate a batch of 3 scenarios for a given domain."""
    print(f"Generating scenarios for domain: {domain}...")
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"Generate 3 highly realistic troubleshooting scenarios for the domain: {domain}",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.7,
            ),
        )
        
        # Parse the JSON response
        scenarios = json.loads(response.text)
        return scenarios
    
    except Exception as e:
        print(f"Error generating batch: {e}")
        return []

def convert_to_chatml(scenario: Dict) -> Dict:
    """Convert the raw scenario into the ChatML format for fine-tuning."""
    answer = (
        f"**What is happening?**\n{scenario['observation']}\n\n"
        f"**Why is it happening?**\n{scenario['cause']}\n\n"
        f"**Real-life example:**\n{scenario['effect']}\n\n"
        f"**How professionals fix it:**\n{scenario['solution']}\n\n"
        f"**Verification:**\n{scenario['verification']}"
    )
    
    return {
        "messages": [
            {"role": "user", "content": scenario["problem"]},
            {"role": "assistant", "content": answer}
        ]
    }

def main():
    client = init_client()
    
    # Load existing to count
    existing_count = 0
    if os.path.exists(EXISTING_FILE):
        with open(EXISTING_FILE, "r", encoding="utf-8") as f:
            existing_count = sum(1 for _ in f)
            
    print(f"Current dataset size: {existing_count}")
    examples_needed = max(0, TARGET_EXAMPLES - existing_count)
    
    if examples_needed == 0:
        print(f"Dataset already has {existing_count} examples. Target reached.")
        return
        
    print(f"Generating {examples_needed} new examples...")
    
    # Copy existing to expanded
    if os.path.exists(EXISTING_FILE):
        with open(EXISTING_FILE, "r", encoding="utf-8") as fin:
            with open(OUTPUT_FILE, "w", encoding="utf-8") as fout:
                fout.write(fin.read())
    
    generated_count = 0
    with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
        while generated_count < examples_needed:
            domain = random.choice(DOMAINS)
            scenarios = generate_batch(client, domain)
            
            for s in scenarios:
                chatml = convert_to_chatml(s)
                f.write(json.dumps(chatml, ensure_ascii=False) + "\n")
                generated_count += 1
                
                if generated_count >= examples_needed:
                    break
                    
            print(f"Progress: {existing_count + generated_count} / {TARGET_EXAMPLES}")
            time.sleep(2) # Rate limit protection

    print(f"\nDone! Wrote expanded dataset to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
