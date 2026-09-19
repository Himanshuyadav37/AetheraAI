import MarkdownRenderer from "./education/MarkdownRenderer";

function MessageBubble({
  message
}) {
  const isUser = message.role === "user";

  return (
    <div className={isUser ? "user-message" : "assistant-message"}>
      <div className="message-header">
        <strong>
          {isUser ? "You" : "Aethera AI"}
        </strong>
      </div>
      <div className="message-content">
        <MarkdownRenderer>
          {message.content}
        </MarkdownRenderer>
      </div>
    </div>
  );
}

export default MessageBubble;