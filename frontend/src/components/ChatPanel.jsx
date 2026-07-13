import {
  useEffect,
  useRef
} from "react";

import MessageBubble from "./MessageBubble";

function ChatPanel({

  messages

}) {

  const chatEndRef =
    useRef(null);

  useEffect(() => {

    chatEndRef.current?.scrollIntoView({

      behavior: "smooth"

    });

  }, [messages]);

  return (

    <div className="output-card">

      <h2>

        Conversation

      </h2>

      <div
        className="chat-container"
      >

        {

          messages.length === 0 ? (

            <div
              className="empty-chat"
            >

              <h3>

                Start a Conversation

              </h3>

              <p>

                Ask NexusAI anything.

              </p>

            </div>

          ) : (

            messages.map(

              (
                message,
                index
              ) => (

                <MessageBubble

                  key={index}

                  message={message}

                />

              )

            )

          )

        }

        <div
          ref={chatEndRef}
        />

      </div>

    </div>

  );

}

export default ChatPanel;