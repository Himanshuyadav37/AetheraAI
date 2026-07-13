
import React from "react";

function ChatInput({

  value,

  onChange,

  agentType,

  loading,

  onSend

}) {

  function handleSend() {

    if (!value.trim()) return;

    onSend(value);

  }

  function handleKeyDown(e) {

    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {

      e.preventDefault();

      handleSend();

    }

  }

  function getPlaceholder() {

    switch (agentType) {

      case "engineer":
        return "Build an AI Resume Analyzer using FastAPI and MongoDB";

      case "conversational":
        return "Ask NexusAI anything...";

      case "research":
        return "Research AI Coding Agents";

      case "education":
        return "Teach me DBMS Normalization";

      case "automation":
        return "Create an automation workflow";

      default:
        return "Enter your prompt...";
    }

  }

  return (

    <div className="chat-input-container">

      <textarea

        value={value}

        onChange={(e) =>
          onChange(
            e.target.value
          )
        }

        onKeyDown={handleKeyDown}

        placeholder={
          getPlaceholder()
        }

      />

      <button

        onClick={handleSend}

        disabled={loading}

      >

        {

          loading

            ? "Processing..."

            : agentType === "engineer"

            ? "Generate Project"

            : "Run AI"

        }

      </button>

    </div>

  );

}

export default ChatInput;
