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
    max_tokens: int = 2500,
):
    global current_key
    text_prompt, image_url = parse_multimodal_prompt(prompt)

    if image_url:
        model = "qwen/qwen3.6-27b"
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
        model = "openai/gpt-oss-120b"
        messages = [
            {
                "role": "user",
                "content": prompt,
            }
        ]

    # Generate cache key based on prompt and model selection
    import hashlib
    cache_key_src = f"groq:{model}:{prompt}"
    cache_key = "groq_cache:" + hashlib.sha256(cache_key_src.encode("utf-8")).hexdigest()

    redis_client = None
    try:
        from core.redis_client import get_redis_client_sync
        redis_client = get_redis_client_sync()
        cached_val = redis_client.get(cache_key)
        if cached_val:
            print(f"[Cache Hit] Groq response loaded from Redis for key {cache_key[:12]}...")
            return cached_val
    except Exception as e:
        pass

    keys_to_try = len(settings.GROQ_KEYS)
    last_error = None

    for _ in range(keys_to_try):
        try:
            client = Groq(api_key=settings.GROQ_KEYS[current_key])
            completion = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.2,
                max_tokens=max_tokens,
                stream=False,
            )
            result = completion.choices[0].message.content
            if redis_client:
                try:
                    redis_client.setex(cache_key, 3600, result)
                except Exception:
                    pass
            return result
        except Exception as e:
            last_error = e
            current_key = (current_key + 1) % keys_to_try
            print(f"Groq API call failed with {model}. Rotating to key index {current_key}. Error: {str(e)}")

    # Fallback to alternative fast models if 120b is rate-limited or TPM exceeded
    fallback_models = ["openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
    safe_max_tokens = min(max_tokens, 2048)

    for fallback_model in fallback_models:
        print(f"Attempting fallback model: {fallback_model}...")
        for _ in range(keys_to_try):
            try:
                client = Groq(api_key=settings.GROQ_KEYS[current_key])
                completion = client.chat.completions.create(
                    model=fallback_model,
                    messages=messages,
                    temperature=0.2,
                    max_tokens=safe_max_tokens,
                    stream=False,
                )
                result = completion.choices[0].message.content
                return result
            except Exception as e:
                last_error = e
                current_key = (current_key + 1) % keys_to_try
                print(f"Groq fallback failed with {fallback_model}. Rotating to key index {current_key}. Error: {str(e)}")

    raise last_error


def stream_response(
    prompt: str,
):
    global current_key
    text_prompt, image_url = parse_multimodal_prompt(prompt)

    if image_url:
        model = "qwen/qwen3.6-27b"
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
        model = "openai/gpt-oss-120b"
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
            print(f"Groq API stream failed with {model}. Rotating to key index {current_key}. Error: {str(e)}")

    # Fallback to openai/gpt-oss-20b for streaming if 120b is rate-limited
    if model == "openai/gpt-oss-120b":
        print("All keys failed for openai/gpt-oss-120b streaming. Falling back to openai/gpt-oss-20b...")
        fallback_model = "openai/gpt-oss-20b"
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
                print(f"Groq streaming fallback failed with {fallback_model}. Rotating to key index {current_key}. Error: {str(e)}")

    raise last_error