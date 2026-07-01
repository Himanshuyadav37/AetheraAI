import ReactMarkdown from "react-markdown";

function ReportViewer({ report, review }) {
  return (
    <div className="research-report-shell">
      <section className="research-report-main">
        <ReactMarkdown>{report || "No report generated yet."}</ReactMarkdown>
      </section>

      {review && (
        <aside className="research-review-panel">
          <h3>Quality Review</h3>
          <ReactMarkdown>{review}</ReactMarkdown>
        </aside>
      )}
    </div>
  );
}

export default ReportViewer;