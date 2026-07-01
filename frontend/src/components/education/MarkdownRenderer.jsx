import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MermaidDiagram from "./MermaidDiagram";
import CodeBlock from "./CodeBlock";

function MarkdownRenderer({ children }) {

    return (

        <ReactMarkdown

            remarkPlugins={[remarkGfm]}

            components={{

                h1: ({ children }) => (

                    <div className="md-section">

                        <h1 className="md-h1">

                            {children}

                        </h1>

                    </div>

                ),

                h2: ({ children }) => (

                    <div className="md-section">

                        <h2 className="md-h2">

                            {children}

                        </h2>

                    </div>

                ),

                h3: ({ children }) => (

                    <div className="md-section">

                        <h3 className="md-h3">

                            {children}

                        </h3>

                    </div>

                ),

                h4: ({ children }) => (

                    <h4 className="md-h4">

                        {children}

                    </h4>

                ),

                p: ({ children }) => (

                    <p className="md-p">

                        {children}

                    </p>

                ),

                ul: ({ children }) => (

                    <ul className="md-ul">

                        {children}

                    </ul>

                ),

                ol: ({ children }) => (

                    <ol className="md-ol">

                        {children}

                    </ol>

                ),

                li: ({ children }) => (

                    <li className="md-li">

                        {children}

                    </li>

                ),

                strong: ({ children }) => (

                    <strong className="md-strong">

                        {children}

                    </strong>

                ),

                em: ({ children }) => (

                    <em className="md-em">

                        {children}

                    </em>

                ),

                hr: () => (

                    <hr className="md-hr" />

                ),

                blockquote: ({ children }) => (

                    <blockquote className="md-blockquote">

                        {children}

                    </blockquote>

                ),

                table: ({ children }) => (

                    <div className="table-wrapper">

                        <table className="md-table">

                            {children}

                        </table>

                    </div>

                ),

                thead: ({ children }) => (

                    <thead>

                        {children}

                    </thead>

                ),

                tbody: ({ children }) => (

                    <tbody>

                        {children}

                    </tbody>

                ),

                tr: ({ children }) => (

                    <tr>

                        {children}

                    </tr>

                ),

                th: ({ children }) => (

                    <th>

                        {children}

                    </th>

                ),

                td: ({ children }) => (

                    <td>

                        {children}

                    </td>

                ),

                img: ({ src, alt }) => (

                    <img

                        src={src}

                        alt={alt}

                        className="md-image"

                    />

                ),

                a: ({ href, children }) => (

                    <a

                        href={href}

                        target="_blank"

                        rel="noopener noreferrer"

                        className="md-link"

                    >

                        {children}

                    </a>

                ),

                code({

                    inline,

                    className,

                    children,

                    ...props

                }) {

                    const match = /language-(\w+)/.exec(

                        className || ""

                    );

                    if (

                        !inline &&

                        match

                    ) {

                        return (

                            <CodeBlock

                                language={match[1]}

                                code={String(children).replace(/\n$/, "")}

                            />

                        );

                    }

                    if (!inline) {

                        return (

                            <CodeBlock

                                language="text"

                                code={String(children).replace(/\n$/, "")}

                            />

                        );

                    }

                    return (

                        <code

                            className="inline-code"

                            {...props}

                        >

                            {children}

                        </code>

                    );

                },

            }}

        >

            {children}

        </ReactMarkdown>

    );

}

export default MarkdownRenderer;