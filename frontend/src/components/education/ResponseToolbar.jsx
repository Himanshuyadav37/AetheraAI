import {

    Copy,

    RotateCcw,

    ThumbsUp,

    ThumbsDown,

    Download,

    Share2,

    Volume2,

} from "lucide-react";

import { useState } from "react";

function ResponseToolbar({

    content,

    onRegenerate,

}) {

    const [copied, setCopied] = useState(false);

    async function copyResponse() {

        try {

            await navigator.clipboard.writeText(content);

            setCopied(true);

            setTimeout(() => {

                setCopied(false);

            }, 1800);

        }

        catch (err) {

            console.error(err);

        }

    }

    function exportMarkdown() {

        const blob = new Blob(

            [content],

            {

                type:"text/markdown",

            }

        );

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url;

        a.download = "education-response.md";

        a.click();

        URL.revokeObjectURL(url);

    }

    function shareResponse(){

        if(navigator.share){

            navigator.share({

                title:"NexusAI Education AI",

                text:content,

            });

        }

    }

    function speak(){

        speechSynthesis.cancel();

        const utterance =

            new SpeechSynthesisUtterance(content);

        utterance.rate=1;

        utterance.pitch=1;

        speechSynthesis.speak(

            utterance

        );

    }

    return(

        <div className="response-toolbar">

            <button

                onClick={copyResponse}

            >

                <Copy size={16}/>

                {

                    copied

                    ?

                    "Copied"

                    :

                    "Copy"

                }

            </button>

            <button

                onClick={onRegenerate}

            >

                <RotateCcw size={16}/>

                Regenerate

            </button>

            <button>

                <ThumbsUp size={16}/>

            </button>

            <button>

                <ThumbsDown size={16}/>

            </button>

            <button

                onClick={exportMarkdown}

            >

                <Download size={16}/>

                Markdown

            </button>

            <button

                onClick={shareResponse}

            >

                <Share2 size={16}/>

                Share

            </button>

            <button

                onClick={speak}

            >

                <Volume2 size={16}/>

                Read

            </button>

        </div>

    );

}

export default ResponseToolbar;