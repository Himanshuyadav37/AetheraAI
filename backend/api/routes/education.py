import json

from agents.education.agent import (
    education_agent,
)
from api.models.education import (
    EducationRequest,
    EducationResponse,
)
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from db.conversation_service import create_conversation, add_message
from auth.optional_auth import get_optional_user

router = APIRouter()


# =====================================================
# Normal Chat
# =====================================================


@router.post(
    "/chat",
    response_model=EducationResponse,
)
async def education_chat(
    request: EducationRequest,
    user=Depends(get_optional_user)
):

    try:
        user_id = user.get("sub") if user and user.get("sub") != "system" else "system"
        
        valid_conv_id = request.conversation_id
        if not valid_conv_id:
            valid_conv_id = create_conversation(
                user_id=user_id,
                agent_type="education",
                title=request.prompt[:60],
            )

        # Casual Greeting Check
        is_greeting = any(word in request.prompt.lower().strip("?.!,") for word in ["hello", "hi", "hey", "greetings", "hii", "hy", "how are you"])
        if is_greeting and len(request.prompt.strip()) < 15:
            response_text = "Hello! I am your NexusAI Education AI tutor. What DBMS concept, programming language, or technical topic would you like to learn today?"
            try:
                add_message(valid_conv_id, "user", request.prompt)
                add_message(valid_conv_id, "assistant", response_text)
            except Exception as e:
                print(f"[Education History Save Error] {e}")
            return {
                "success": True,
                "agent": "education",
                "mode": "learn",
                "title": "NexusAI Education AI",
                "response": response_text,
                "conversation_id": valid_conv_id
            }

        # Retrieve RAG context and ground the prompt
        try:
            from services.search_pipeline import retrieve_layered_context
            source_layer, chunks = retrieve_layered_context(
                query=request.prompt,
                project_id=request.project_id,
                org_id=request.org_id,
                session_id=request.session_id,
                top_k=5,
                conversation_id=valid_conv_id
            )
            if chunks:
                context_str = "\n\n".join(
                    f"Source: {c['metadata'].get('filename', 'unknown')} (Page {c['metadata'].get('page_num', 1)}):\n{c['text']}"
                    for c in chunks
                )
                request.prompt = (
                    f"[Retrieved Context from {source_layer.upper()} RAG]\n{context_str}\n"
                    f"[End of Context]\n\n"
                    f"User Request: {request.prompt}"
                )
        except Exception as e:
            print("RAG Context injection failed in education route:", e)

        from services.agent_tools import intercept_mcp_tool_call
        intercepted = intercept_mcp_tool_call(
            prompt=request.prompt,
            agent_type="education",
            conversation_id=valid_conv_id,
            connectors=request.connectors
        )
        if intercepted:
            # Inject conversation_id into intercepted dict
            intercepted["conversation_id"] = valid_conv_id
            return intercepted

        result = education_agent(
            prompt=request.prompt,
            connectors=request.connectors,
        )

        response_text = result.get("response", "")

        # Save messages in history
        try:
            add_message(valid_conv_id, "user", request.prompt)
            add_message(valid_conv_id, "assistant", response_text)
        except Exception as e:
            print(f"[Education History Save Error] {e}")

        # Return conversation_id in response
        result["conversation_id"] = valid_conv_id
        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# =====================================================
# Streaming Chat (ChatGPT Style)
# =====================================================


@router.post(
    "/stream",
)
async def education_stream(
    request: EducationRequest,
    user=Depends(get_optional_user)
):

    try:
        user_id = user.get("sub") if user and user.get("sub") != "system" else "system"
        
        valid_conv_id = request.conversation_id
        if not valid_conv_id:
            valid_conv_id = create_conversation(
                user_id=user_id,
                agent_type="education",
                title=request.prompt[:60],
            )

        # Casual Greeting Check
        is_greeting = any(word in request.prompt.lower().strip("?.!,") for word in ["hello", "hi", "hey", "greetings", "hii", "hy", "how are you"])
        if is_greeting and len(request.prompt.strip()) < 15:
            response_text = "Hello! I am your NexusAI Education AI tutor. What DBMS concept, programming language, or technical topic would you like to learn today?"
            try:
                add_message(valid_conv_id, "user", request.prompt)
                add_message(valid_conv_id, "assistant", response_text)
            except Exception as e:
                print(f"[Education History Save Error] {e}")
            def generate_greeting_stream():
                yield f"data: {json.dumps({'meta': {'title': 'NexusAI Education AI', 'mode': 'learn', 'conversation_id': valid_conv_id}})}\n\n"
                chunk_size = 24
                for index in range(0, len(response_text), chunk_size):
                    token = response_text[index : index + chunk_size]
                    yield f"data: {json.dumps({'token': token})}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(generate_greeting_stream(), media_type="text/event-stream")

        # Retrieve RAG context and ground the prompt
        try:
            from services.search_pipeline import retrieve_layered_context
            source_layer, chunks = retrieve_layered_context(
                query=request.prompt,
                project_id=request.project_id,
                org_id=request.org_id,
                session_id=request.session_id,
                top_k=5,
                conversation_id=valid_conv_id
            )
            if chunks:
                context_str = "\n\n".join(
                    f"Source: {c['metadata'].get('filename', 'unknown')} (Page {c['metadata'].get('page_num', 1)}):\n{c['text']}"
                    for c in chunks
                )
                request.prompt = (
                    f"[Retrieved Context from {source_layer.upper()} RAG]\n{context_str}\n"
                    f"[End of Context]\n\n"
                    f"User Request: {request.prompt}"
                )
        except Exception as e:
            print("RAG Context injection failed in education stream route:", e)

        valid_conv_id = request.conversation_id
        if not valid_conv_id:
            valid_conv_id = create_conversation(
                user_id=user_id,
                agent_type="education",
                title=request.prompt[:60],
            )

        from services.agent_tools import intercept_mcp_tool_call
        intercepted = intercept_mcp_tool_call(
            prompt=request.prompt,
            agent_type="education",
            conversation_id=valid_conv_id,
            connectors=request.connectors
        )
        if intercepted:
            def generate_intercepted():
                yield f"data: {json.dumps({'meta': {'title': intercepted.get('title', 'NexusAI Education AI'), 'mode': intercepted.get('mode', 'learn'), 'conversation_id': valid_conv_id}})}\n\n"
                response_text = str(intercepted.get("response", ""))
                chunk_size = 24
                for index in range(0, len(response_text), chunk_size):
                    token = response_text[index : index + chunk_size]
                    yield f"data: {json.dumps({'token': token})}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(
                generate_intercepted(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        result = education_agent(
            prompt=request.prompt,
            connectors=request.connectors,
        )

        response_text = str(result.get("response", ""))

        # Save messages in history
        try:
            add_message(valid_conv_id, "user", request.prompt)
            add_message(valid_conv_id, "assistant", response_text)
        except Exception as e:
            print(f"[Education Stream History Save Error] {e}")

        def generate():
            yield f"data: {json.dumps({'meta': {'title': result.get('title', 'NexusAI Education AI'), 'mode': result.get('mode', 'learn'), 'conversation_id': valid_conv_id}})}\n\n"

            chunk_size = 24

            for index in range(0, len(response_text), chunk_size):
                token = response_text[index : index + chunk_size]
                yield f"data: {json.dumps({'token': token})}\n\n"

            yield "data: [DONE]\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )
