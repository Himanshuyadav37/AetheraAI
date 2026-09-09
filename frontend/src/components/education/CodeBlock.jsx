import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
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
    const isPreviewable = ["html", "jsx", "javascript", "js", "svg", "css", "xml", "markdown", "md"].includes(language.toLowerCase());

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

    function handleOpenInCanvas() {
        window.dispatchEvent(new CustomEvent("nexusai-open-canvas", {
            detail: {
                type: language.toLowerCase(),
                language: language.toLowerCase(),
                content: code,
                title: `${language.toUpperCase()} Canvas Preview`
            }
        }));
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
                    {isPreviewable && (
                        <button
                            type="button"
                            className="nf-btn"
                            onClick={handleOpenInCanvas}
                            style={{ 
                                background: "rgba(255, 255, 255, 0.1)", 
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                color: "#ffffff",
                                fontWeight: "600"
                            }}
                            title="Open in interactive Live Canvas"
                        >
                            <Sparkles size={13} style={{ color: "#38bdf8" }} />
                            Live Canvas
                        </button>
                    )}

                    {isLong && (
                        <button
                            className="nf-btn"
                            onClick={() => setExpanded(!expanded)}
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