import { Send } from "lucide-react";

function ChatInput({

    prompt,

    setPrompt,

    loading,

    onSend,

}) {

    function handleKeyDown(e) {

        if (

            e.key === "Enter" &&

            !e.shiftKey

        ) {

            e.preventDefault();

            onSend();

        }

    }

    return (

        <div className="education-input">

            <textarea

                rows={2}

                value={prompt}

                placeholder="Ask anything about coding, exams, notes, interview..."

                onChange={(e) =>

                    setPrompt(

                        e.target.value

                    )

                }

                onKeyDown={handleKeyDown}

                disabled={loading}

            />

            <button

                onClick={() => onSend()}

                disabled={

                    loading ||

                    !prompt.trim()

                }

                className="send-btn"

            >

                <Send size={20} />

            </button>

        </div>

    );

}

export default ChatInput;