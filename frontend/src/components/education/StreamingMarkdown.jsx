import MarkdownRenderer from "./MarkdownRenderer";

function StreamingMarkdown({ content }) {
  return <MarkdownRenderer>{content || ""}</MarkdownRenderer>;
}

export default StreamingMarkdown;
