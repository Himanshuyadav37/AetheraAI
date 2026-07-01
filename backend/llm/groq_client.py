from groq import Groq
import re
from config import settings

current_key = 0


def get_client():
    global current_key
    return Groq(
        api_key=settings.GROQ_KEYS[current_key]
    )


def parse_multimodal_prompt(prompt: str):
    # Regex to capture standard base64 image data URLs
    match = re.search(r"\[Attached Image:\s*(data:image/[^;]+;base64,[A-Za-z0-9+/=\s]+)\]", prompt)
    if match:
        image_url = match.group(1).replace(" ", "").replace("\n", "").replace("\r", "")
        # Remove the tag from the text prompt to avoid clutter
        clean_text = prompt.replace(match.group(0), "").strip()
        return clean_text, image_url
    return prompt, None


def generate_response(
    prompt: str,
):
    global current_key
    text_prompt, image_url = parse_multimodal_prompt(prompt)

    if image_url:
        model = "llama-3.2-11b-vision-preview"
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": text_prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_url
                        }
                    }
                ]
            }
        ]
    else:
        model = "llama-3.3-70b-versatile"
        messages = [
            {
                "role": "user",
                "content": prompt,
            }
        ]

    keys_to_try = len(settings.GROQ_KEYS)
    last_error = None

    for _ in range(keys_to_try):
        try:
            client = Groq(api_key=settings.GROQ_KEYS[current_key])
            completion = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.4,
                stream=False,
            )
            return completion.choices[0].message.content
        except Exception as e:
            last_error = e
            current_key = (current_key + 1) % keys_to_try
            print(f"Groq API call failed. Rotating to key index {current_key}. Error: {str(e)}")

    # Fallback to llama-3.1-8b-instant if 70b is rate-limited
    if model == "llama-3.3-70b-versatile":
        print("All keys failed for llama-3.3-70b-versatile. Falling back to llama-3.1-8b-instant...")
        fallback_model = "llama-3.1-8b-instant"
        for _ in range(keys_to_try):
            try:
                client = Groq(api_key=settings.GROQ_KEYS[current_key])
                completion = client.chat.completions.create(
                    model=fallback_model,
                    messages=messages,
                    temperature=0.4,
                    stream=False,
                )
                return completion.choices[0].message.content
            except Exception as e:
                last_error = e
                current_key = (current_key + 1) % keys_to_try
                print(f"Groq fallback failed. Rotating to key index {current_key}. Error: {str(e)}")

    raise last_error


def stream_response(
    prompt: str,
):
    global current_key
    text_prompt, image_url = parse_multimodal_prompt(prompt)

    if image_url:
        model = "llama-3.2-11b-vision-preview"
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": text_prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_url
                        }
                    }
                ]
            }
        ]
    else:
        model = "llama-3.3-70b-versatile"
        messages = [
            {
                "role": "user",
                "content": prompt,
            }
        ]

    keys_to_try = len(settings.GROQ_KEYS)
    last_error = None

    for _ in range(keys_to_try):
        try:
            client = Groq(api_key=settings.GROQ_KEYS[current_key])
            completion = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.4,
                stream=True,
            )
            for chunk in completion:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
            return # Successful stream complete
        except Exception as e:
            last_error = e
            current_key = (current_key + 1) % keys_to_try
            print(f"Groq API stream failed. Rotating to key index {current_key}. Error: {str(e)}")

    # Fallback to llama-3.1-8b-instant for streaming if 70b is rate-limited
    if model == "llama-3.3-70b-versatile":
        print("All keys failed for llama-3.3-70b-versatile streaming. Falling back to llama-3.1-8b-instant...")
        fallback_model = "llama-3.1-8b-instant"
        for _ in range(keys_to_try):
            try:
                client = Groq(api_key=settings.GROQ_KEYS[current_key])
                completion = client.chat.completions.create(
                    model=fallback_model,
                    messages=messages,
                    temperature=0.4,
                    stream=True,
                )
                for chunk in completion:
                    delta = chunk.choices[0].delta.content
                    if delta:
                        yield delta
                return
            except Exception as e:
                last_error = e
                current_key = (current_key + 1) % keys_to_try
                print(f"Groq streaming fallback failed. Rotating to key index {current_key}. Error: {str(e)}")

    raise last_error