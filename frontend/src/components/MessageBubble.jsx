import ReactMarkdown from "react-markdown";

function MessageBubble({

  message

}) {

  const isUser =
    message.role === "user";

  return (

    <div
      className={
        isUser
          ? "user-message"
          : "assistant-message"
      }
    >

      <div
        className="message-header"
      >

        <strong>

          {

            isUser

              ? "You"

              : "NexusAI"

          }

        </strong>

      </div>

      <div
        className="message-content"
      >

        <ReactMarkdown>

          {

            message.content

          }

        </ReactMarkdown>

      </div>

    </div>

  );

}

export default MessageBubble;