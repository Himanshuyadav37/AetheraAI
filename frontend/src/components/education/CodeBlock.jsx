import { useState } from "react";

import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";

import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function CodeBlock({

    language = "text",

    code = "",

}) {

    const [copied, setCopied] = useState(false);

    const [expanded, setExpanded] = useState(false);

    const lines = code.split("\n");

    const isLong = lines.length > 30;

    const displayCode =

        !expanded && isLong

            ? lines.slice(0, 30).join("\n")

            : code;

    async function copyCode() {

        try {

            await navigator.clipboard.writeText(code);

            setCopied(true);

            setTimeout(() => {

                setCopied(false);

            }, 1800);

        }

        catch (err) {

            console.error(err);

        }

    }

    return (

        <div className="nf-code">

            <div className="nf-code-header">

                <div className="nf-code-left">

                    <span className="nf-dot red"></span>

                    <span className="nf-dot yellow"></span>

                    <span className="nf-dot green"></span>

                    <span className="nf-language">

                        {language.toUpperCase()}

                    </span>

                </div>

                <div className="nf-code-actions">

                    {

                        isLong && (

                            <button

                                className="nf-btn"

                                onClick={() =>

                                    setExpanded(

                                        !expanded

                                    )

                                }

                            >

                                {

                                    expanded

                                    ?

                                    <>

                                        <ChevronUp size={15}/>

                                        Collapse

                                    </>

                                    :

                                    <>

                                        <ChevronDown size={15}/>

                                        Expand

                                    </>

                                }

                            </button>

                        )

                    }

                    <button

                        className="nf-btn"

                        onClick={copyCode}

                    >

                        {

                            copied

                            ?

                            <>

                                <Check size={15}/>

                                Copied

                            </>

                            :

                            <>

                                <Copy size={15}/>

                                Copy

                            </>

                        }

                    </button>

                </div>

            </div>

            <SyntaxHighlighter

                language={language}

                style={oneDark}

                showLineNumbers

                wrapLongLines

                customStyle={{

                    margin:0,

                    borderRadius:0,

                    background:"#0d1117",

                    fontSize:"14px",

                    padding:"22px",

                }}

            >

                {displayCode}

            </SyntaxHighlighter>

        </div>

    );

}

export default CodeBlock;