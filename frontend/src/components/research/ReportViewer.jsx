import MarkdownRenderer from "../education/MarkdownRenderer";

function ReportViewer({ report, review }) {
  return (
    <div className="research-report-shell">
      <section className="research-report-main">
        <MarkdownRenderer>{report || "No report generated yet."}</MarkdownRenderer>
      </section>

      {review && (
        <aside className="research-review-panel">
          <h3>Quality Review</h3>
          <MarkdownRenderer>{review}</MarkdownRenderer>
        </aside>
      )}
    </div>
  );
}

export default ReportViewer;