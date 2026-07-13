import os
import json
import boto3

def get_bedrock_client():
    """
    Initializes and returns the Bedrock Runtime client using credentials from env variables.
    """
    return boto3.client(
        service_name="bedrock-runtime",
        region_name=os.getenv("AWS_REGION_NAME", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
    )

def generate_response(prompt: str) -> str:
    """
    Synchronous generation call using Amazon Titan Text Express (AWS Free Tier).
    """
    model_id = "amazon.titan-text-express-v1"
    client = get_bedrock_client()

    body = json.dumps({
        "inputText": prompt,
        "textGenerationConfig": {
            "maxTokenCount": 1024,
            "temperature": 0.3,
            "topP": 0.9,
            "stopSequences": []
        }
    })

    try:
        response = client.invoke_model(
            body=body,
            modelId=model_id,
            accept="application/json",
            contentType="application/json"
        )
        response_body = json.loads(response.get("body").read())
        return response_body["results"][0]["outputText"]
    except Exception as e:
        print(f"AWS Bedrock invoke_model failed: {e}")
        raise e

def stream_response(prompt: str):
    """
    Streaming response generator using Amazon Titan Text Express (AWS Free Tier).
    Yields chunks of text in real-time.
    """
    model_id = "amazon.titan-text-express-v1"
    client = get_bedrock_client()

    body = json.dumps({
        "inputText": prompt,
        "textGenerationConfig": {
            "maxTokenCount": 1024,
            "temperature": 0.3,
            "topP": 0.9,
            "stopSequences": []
        }
    })

    try:
        response = client.invoke_model_with_response_stream(
            body=body,
            modelId=model_id,
            accept="application/json",
            contentType="application/json"
        )
        
        for event in response.get("body"):
            chunk = event.get("chunk")
            if chunk:
                chunk_data = json.loads(chunk.get("bytes").decode("utf-8"))
                # Amazon Titan returns parts inside ['outputText']
                text = chunk_data.get("outputText", "")
                if text:
                    yield text
                    
    except Exception as e:
        print(f"AWS Bedrock streaming failed: {e}")
        yield f"❌ Bedrock Stream Error: {str(e)}"
