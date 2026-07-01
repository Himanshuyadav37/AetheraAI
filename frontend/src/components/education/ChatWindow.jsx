import MessageBubble from "./MessageBubble";
import LoadingBubble from "./LoadingBubble";

function ChatWindow({

    messages,

    loading,

    onRegenerate,

}) {

    return (

        <div className="output-card education-chat" style={{ padding: 0, flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>

            <div className="chat-header">

                <div>

                    <h2>

                        AI Tutor

                    </h2>

                    <p>

                        Learn • Code • Exams • Notes • Interview • Quiz

                    </p>

                </div>

            </div>

            <div className="chat-body">

                {

                    messages.map(

                        (message) => (

                            <MessageBubble

                                key={message.id}

                                message={message}

                                onRegenerate={onRegenerate}

                            />

                        )

                    )

                }

                {

                    loading && (

                        <LoadingBubble />

                    )

                }

            </div>

        </div>

    );

}

export default ChatWindow;