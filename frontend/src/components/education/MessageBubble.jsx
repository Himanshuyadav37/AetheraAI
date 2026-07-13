import StreamingMarkdown from "./StreamingMarkdown";
import ResponseToolbar from "./ResponseToolbar";

function MessageBubble({

    message,

    onRegenerate,

}) {

    const isUser = message.role === "user";

    const mode = (message.mode || "learn").toLowerCase();

    const modeClass = `mode-${mode}`;

    return (

        <div
            className={`message ${isUser ? "user" : "assistant"}`}
        >

            <div
                className={`avatar ${
                    isUser
                        ? "user-avatar"
                        : "ai-avatar"
                }`}
            >

                {isUser ? "Y" : "AI"}

            </div>

            <div className="message-wrapper">

                {

                    !isUser && (

                        <div className="message-title">

                            <h4>

                                {

                                    message.title ||

                                    "NexusAI Education AI"

                                }

                            </h4>

                            <span
                                className={`mode-badge ${modeClass}`}
                            >

                                {mode}

                            </span>

                        </div>

                    )

                }

                <div className="message-content">

                    {

                        isUser ? (

                            <div className="user-message">

                                <p>

                                    {message.content}

                                </p>

                            </div>

                        ) : (

                            <>

                                <StreamingMarkdown

                                    content={message.content}

                                />

                                <ResponseToolbar

                                    content={message.content}

                                    onRegenerate={() => {

                                        if (

                                            onRegenerate

                                        ) {

                                            onRegenerate(

                                                message

                                            );

                                        }

                                    }}

                                />

                            </>

                        )

                    }

                </div>

            </div>

        </div>

    );

}

export default MessageBubble;