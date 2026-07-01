function ResearchTimeline({ steps = [] }) {
  if (!steps.length) {
    return <p className="timeline-empty">No research timeline recorded.</p>;
  }

  return (
    <div className="execution-timeline">
      {steps.map((step, index) => (
        <div key={`${step.agent}-${index}`} className="timeline-item">
          <div className="timeline-time">
            {step.timestamp ? new Date(step.timestamp).toLocaleTimeString() : "--"}
          </div>
          <div className="timeline-content">
            <div className="timeline-header">
              <span className={`badge ${(step.agent || '').toLowerCase()}`}>{step.agent}</span>
              <span className="timeline-message">{step.message}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ResearchTimeline;