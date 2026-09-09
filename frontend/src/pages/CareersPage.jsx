import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Briefcase,
  MapPin,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Zap,
  Shield,
  Heart,
  Globe2,
  Compass,
  Laptop,
  Plane,
  GraduationCap,
  Upload,
  Check,
  Building,
  Users,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import "./Careers.css";

const OPEN_POSITIONS = [
  {
    id: "senior-neural-engineer",
    title: "Senior Neural Mesh Systems Engineer",
    department: "AI Systems",
    location: "Remote (Global)",
    type: "Full-time",
    compensation: "$220k – $310k • 0.25% – 0.60% Equity",
    experience: "5+ Years",
    overview: "Architect and scale our ultra-low latency (140ms) distributed inference routing mesh connecting Groq, Gemini, Claude, and on-premise GPU clusters.",
    responsibilities: [
      "Design high-throughput asynchronous routing pipelines handling 50k+ concurrent LLM token streams.",
      "Implement real-time semantic classifier models with sub-2ms embedding evaluations.",
      "Optimize memory allocation and GPU kernel bindings across multi-cloud clusters.",
      "Collaborate with security teams on zero-trust execution sandboxes."
    ],
    qualifications: [
      "Extensive experience in Rust, Go, or C++ distributed systems.",
      "Deep understanding of LLM inference architectures (vLLM, TensorRT-LLM, CUDA).",
      "Proven track record scaling mission-critical microservices to millions of daily requests."
    ]
  },
  {
    id: "staff-research-scientist",
    title: "Staff AI Research Scientist (Multi-Agent Synthesis)",
    department: "AI Research",
    location: "San Francisco, CA / Remote",
    type: "Full-time",
    compensation: "$260k – $380k • 0.35% – 0.80% Equity",
    experience: "Staff Level",
    overview: "Lead foundational research in autonomous multi-agent consensus, recursive self-correction, and long-horizon tool execution frameworks.",
    responsibilities: [
      "Invent and publish novel reasoning architectures for recursive multi-agent collaboration.",
      "Develop reinforcement learning from environmental feedback (RLEF) algorithms.",
      "Partner with product engineers to deploy state-of-the-art model checkpoints directly into NexusAI OS."
    ],
    qualifications: [
      "PhD or equivalent track record in Machine Learning, AI, or Computer Science.",
      "First-author publications at NeurIPS, ICML, ICLR, or CVPR.",
      "Hands-on expertise training and fine-tuning 70B+ parameter frontier models."
    ]
  },
  {
    id: "lead-frontend-architect",
    title: "Lead Frontend Architect (Design Systems & WebGL)",
    department: "Full-Stack",
    location: "Remote (Global)",
    type: "Full-time",
    compensation: "$190k – $270k • 0.20% – 0.45% Equity",
    experience: "6+ Years",
    overview: "Craft the world's most elegant, fluid, and responsive AI operating system interface across web, desktop, and mobile canvases.",
    responsibilities: [
      "Lead frontend engineering across React, TypeScript, Vite, WebGL, and custom canvas rendering engines.",
      "Architect our monochromatic design system tokens ensuring 100% aesthetic perfection in Light & Dark modes.",
      "Build real-time collaborative multi-user whiteboards and AI streaming message renderers."
    ],
    qualifications: [
      "Obsessive attention to UI/UX details, micro-interactions, and 60fps animations.",
      "Deep expertise in React internals, performance profiling, and state machines.",
      "Experience building developer tools or complex creative software (Figma, Linear, VS Code)."
    ]
  },
  {
    id: "safety-alignment-engineer",
    title: "AI Red Teamer & Safety Alignment Engineer",
    department: "AI Safety",
    location: "San Francisco, CA / London, UK",
    type: "Full-time",
    compensation: "$200k – $290k • 0.25% – 0.50% Equity",
    experience: "4+ Years",
    overview: "Pressure-test NexusAI's autonomous agents against adversarial jailbreaks, prompt injections, data exfiltration, and unintended tool executions.",
    responsibilities: [
      "Design automated adversarial fuzzing suites to discover safety vulnerabilities in real time.",
      "Develop automated PII masking and zero-knowledge privacy filtering algorithms.",
      "Interface with enterprise customers on SOC2 Type II compliance and threat model audits."
    ],
    qualifications: [
      "Strong background in offensive security, vulnerability research, or AI alignment.",
      "Experience building safety benchmarks and automated red-teaming pipelines.",
      "Deep familiarity with OWASP Top 10 for LLMs and MITRE ATLAS."
    ]
  },
  {
    id: "principal-distributed-rag",
    title: "Principal Distributed Systems Architect (Vector & RAG)",
    department: "AI Systems",
    location: "Remote (Global)",
    type: "Full-time",
    compensation: "$240k – $340k • 0.30% – 0.70% Equity",
    experience: "7+ Years",
    overview: "Build the next-generation hybrid vector search engine capable of indexing billions of enterprise documents with sub-20ms retrieval latencies.",
    responsibilities: [
      "Architect distributed vector indexing pipelines combining HNSW, BM25, and sparse re-ranking.",
      "Scale our multi-tenant document ingestion workers across petabyte-scale knowledge bases.",
      "Ensure high availability and ACID guarantees for enterprise document permissions."
    ],
    qualifications: [
      "Expertise in vector search engines (Milvus, Qdrant, Pinecone) and distributed databases.",
      "Proficiency in Go, Rust, or C++ with memory profiling and eBPF tracing.",
      "Experience deploying systems on Kubernetes across multi-region hybrid clouds."
    ]
  },
  {
    id: "solutions-architect-devrel",
    title: "Developer Experience & Solutions Architect",
    department: "DevRel",
    location: "San Francisco, CA / Bangalore / Remote",
    type: "Full-time",
    compensation: "$160k – $230k • 0.15% – 0.35% Equity",
    experience: "3+ Years",
    overview: "Empower the global developer ecosystem to build on NexusAI via open-source SDKs, technical documentation, MCP servers, and enterprise onboarding.",
    responsibilities: [
      "Maintain official Python, TypeScript, and Go client SDKs.",
      "Build reference enterprise agent templates and MCP connector plugins.",
      "Present at developer conferences and engage with our open-source developer community."
    ],
    qualifications: [
      "Polyglot programmer with exceptional technical writing and communication skills.",
      "Active open-source contributions or experience running technical developer communities.",
      "Passion for developer tools and AI engineering."
    ]
  }
];

export default function CareersPage() {
  const navigate = useNavigate();
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedLocation, setSelectedLocation] = useState("All");
  const [activeJobModal, setActiveJobModal] = useState(null);

  // Application form state
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    linkedIn: "",
    portfolio: "",
    notes: "",
    resumeAttached: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Filtered positions
  const filteredJobs = useMemo(() => {
    return OPEN_POSITIONS.filter((job) => {
      const matchDept = selectedDept === "All" || job.department === selectedDept;
      const matchLoc = selectedLocation === "All" || job.location.includes(selectedLocation) || (selectedLocation === "Remote" && job.location.includes("Remote"));
      return matchDept && matchLoc;
    });
  }, [selectedDept, selectedLocation]);

  const handleOpenJob = (job) => {
    setActiveJobModal(job);
    setIsSubmitted(false);
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      linkedIn: "",
      portfolio: "",
      notes: "",
      resumeAttached: false
    });
  };

  const handleSubmitApplication = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 1200);
  };

  return (
    <div className="careers-page">
      {/* Sticky Header */}
      <header className="careers-topbar">
        <Link to="/" className="careers-brand">
          <div className="careers-brand-logo">N</div>
          <span className="careers-brand-text">NexusAI</span>
          <span className="careers-badge">Careers</span>
        </Link>

        <div className="careers-nav-links">
          <Link to="/docs" className="careers-link">Documentation</Link>
          <Link to="/workspace" className="careers-link">Workspace</Link>
          <button
            type="button"
            className="careers-btn-primary"
            onClick={() => {
              const el = document.getElementById("open-positions");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          >
            View Open Roles <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="careers-hero">
        <div className="careers-hero-badge">
          <span /> We're hiring worldwide across AI Research & Engineering
        </div>
        <h1>Build the Neural Intelligence Infrastructure of Tomorrow</h1>
        <p className="careers-hero-sub">
          NexusAI is creating the unified operating system for autonomous engineering, semantic model routing, and frontier agent collaboration. Join our mission to redefine human-AI teaming.
        </p>

        <div className="careers-hero-actions">
          <button
            type="button"
            className="careers-btn-primary"
            style={{ padding: "12px 26px", fontSize: "15px" }}
            onClick={() => {
              const el = document.getElementById("open-positions");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Explore 6 Open Roles <ArrowRight size={16} />
          </button>
          <Link to="/docs" className="careers-link" style={{ padding: "12px 20px", fontSize: "15px", border: "1px solid var(--careers-border)" }}>
            Read Our Architecture Docs
          </Link>
        </div>
      </section>

      {/* Scale Stats Bar */}
      <div className="careers-stats-bar">
        <div className="careers-stat-card">
          <div className="careers-stat-value">$45M+</div>
          <div className="careers-stat-label">Series A & Seed Funded</div>
        </div>
        <div className="careers-stat-card">
          <div className="careers-stat-value">100+</div>
          <div className="careers-stat-label">Enterprise Neural Clusters</div>
        </div>
        <div className="careers-stat-card">
          <div className="careers-stat-value">14</div>
          <div className="careers-stat-label">Countries with Remote Team Members</div>
        </div>
        <div className="careers-stat-card">
          <div className="careers-stat-value">140ms</div>
          <div className="careers-stat-label">Global P99 Inference Latency</div>
        </div>
      </div>

      {/* Engineering Values Section */}
      <section className="careers-section">
        <div className="careers-section-header">
          <span className="careers-section-tag">OUR DNA</span>
          <h2>How We Build & Execute</h2>
          <p>We hold high standards for craftsmanship, speed of execution, and intellectual honesty.</p>
        </div>

        <div className="careers-values-grid">
          <div className="careers-value-card">
            <div className="careers-value-icon"><Zap size={22} /></div>
            <h3>Extreme Ownership & Speed</h3>
            <p>We minimize meetings, eliminate bureaucratic approval chains, and trust exceptional engineers with direct production access.</p>
          </div>

          <div className="careers-value-card">
            <div className="careers-value-icon"><Sparkles size={22} /></div>
            <h3>First-Principles AI</h3>
            <p>We don't wrap APIs blindly. We dissect model latencies, rewrite kernels, and construct novel multi-agent neural architectures.</p>
          </div>

          <div className="careers-value-card">
            <div className="careers-value-icon"><Laptop size={22} /></div>
            <h3>Obsessive Craftsmanship</h3>
            <p>Every micro-interaction, keyboard shortcut, and design token must feel instantaneous, fluid, and delightful.</p>
          </div>

          <div className="careers-value-card">
            <div className="careers-value-icon"><Shield size={22} /></div>
            <h3>Frontier Safety & Alignment</h3>
            <p>Autonomous agents demand rigorous safety guarantees, zero-data leaks, and uncompromised privacy by design.</p>
          </div>
        </div>
      </section>

      {/* Benefits & Perks Section */}
      <section className="careers-section">
        <div className="careers-section-header">
          <span className="careers-section-tag">COMPENSATION & BENEFITS</span>
          <h2>Silicon Valley Tier Benefits</h2>
          <p>We invest heavily in our team so you can do the best work of your career without friction.</p>
        </div>

        <div className="careers-perks-grid">
          <div className="careers-perk-card">
            <div className="careers-perk-icon"><DollarSign size={20} /></div>
            <h3>Top 1% Compensation & Equity</h3>
            <p>Industry-leading base salaries and generous early-stage equity grants with transparent 10-year exercise windows.</p>
          </div>

          <div className="careers-perk-card">
            <div className="careers-perk-icon"><Heart size={20} /></div>
            <h3>100% Comprehensive Healthcare</h3>
            <p>Full medical, dental, and vision coverage for you and your dependents with zero deductible options.</p>
          </div>

          <div className="careers-perk-card">
            <div className="careers-perk-icon"><Laptop size={20} /></div>
            <h3>$12,000 Annual Tech & GPU Stipend</h3>
            <p>High-end MacBook Pro / Linux workstation of your choice plus unlimited cloud GPU compute for experimentation.</p>
          </div>

          <div className="careers-perk-card">
            <div className="careers-perk-icon"><Globe2 size={20} /></div>
            <h3>Remote-First Flexibility</h3>
            <p>Work from anywhere in the world. We provide co-working pass allowances and home-office setup grants.</p>
          </div>

          <div className="careers-perk-card">
            <div className="careers-perk-icon"><Plane size={20} /></div>
            <h3>2x Yearly Global Team Retreats</h3>
            <p>All-expenses-paid international retreats (previous trips to Tokyo, Zurich, and Bali) for deep bonding and strategy.</p>
          </div>

          <div className="careers-perk-card">
            <div className="careers-perk-icon"><GraduationCap size={20} /></div>
            <h3>Continuous Learning & Sabbaticals</h3>
            <p>$4,000/yr conference and book budget, plus sponsored sabbaticals to publish AI safety and systems research.</p>
          </div>
        </div>
      </section>

      {/* Open Positions Section */}
      <section className="careers-section" id="open-positions">
        <div className="careers-section-header">
          <span className="careers-section-tag">OPPORTUNITIES</span>
          <h2>Open Positions</h2>
          <p>Find your next mission. We review all applications within 48 business hours.</p>
        </div>

        {/* Filter Toolbar */}
        <div className="careers-filter-bar">
          <div className="careers-filter-chips">
            {["All", "AI Systems", "AI Research", "Full-Stack", "AI Safety", "DevRel"].map((dept) => (
              <button
                key={dept}
                type="button"
                className={`careers-chip ${selectedDept === dept ? "active" : ""}`}
                onClick={() => setSelectedDept(dept)}
              >
                {dept}
              </button>
            ))}
          </div>

          <select
            className="careers-location-select"
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
          >
            <option value="All">All Locations</option>
            <option value="Remote">Remote Only</option>
            <option value="San Francisco">San Francisco, CA</option>
            <option value="London">London, UK</option>
            <option value="Bangalore">Bangalore, India</option>
          </select>
        </div>

        {/* Jobs List */}
        <div className="careers-jobs-list">
          {filteredJobs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--careers-text-muted)" }}>
              No roles currently match your filter criteria. Try selecting "All".
            </div>
          ) : (
            filteredJobs.map((job) => (
              <div
                key={job.id}
                className="careers-job-card"
                onClick={() => handleOpenJob(job)}
              >
                <div className="careers-job-info">
                  <h3 className="careers-job-title">{job.title}</h3>
                  <div className="careers-job-meta">
                    <span className="careers-job-pill"><Building size={12} /> {job.department}</span>
                    <span className="careers-job-pill"><MapPin size={12} /> {job.location}</span>
                    <span className="careers-job-pill">{job.experience}</span>
                    <span className="careers-job-comp">{job.compensation}</span>
                  </div>
                </div>
                <div className="careers-job-action">
                  <span>Apply Now</span>
                  <ArrowRight size={16} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Interactive Job Detail & Application Modal */}
      {activeJobModal && (
        <div className="careers-modal-backdrop" onClick={() => setActiveJobModal(null)}>
          <div className="careers-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="careers-modal-header">
              <div className="careers-modal-title">
                <h3>{activeJobModal.title}</h3>
                <p>{activeJobModal.department} • {activeJobModal.location} • {activeJobModal.compensation}</p>
              </div>
              <button
                type="button"
                className="careers-modal-close"
                onClick={() => setActiveJobModal(null)}
              >
                &times;
              </button>
            </div>

            <div className="careers-modal-body">
              {!isSubmitted ? (
                <>
                  <div className="careers-role-overview">
                    <strong>Role Summary:</strong> {activeJobModal.overview}
                  </div>

                  <h4 style={{ fontSize: "14px", margin: "16px 0 8px 0", color: "var(--careers-text)" }}>Key Responsibilities:</h4>
                  <ul style={{ paddingLeft: "20px", fontSize: "13px", color: "var(--careers-text-muted)", lineHeight: 1.6, margin: "0 0 20px 0" }}>
                    {activeJobModal.responsibilities.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>

                  <h4 style={{ fontSize: "14px", margin: "16px 0 8px 0", color: "var(--careers-text)" }}>Qualifications & Experience:</h4>
                  <ul style={{ paddingLeft: "20px", fontSize: "13px", color: "var(--careers-text-muted)", lineHeight: 1.6, margin: "0 0 24px 0" }}>
                    {activeJobModal.qualifications.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>

                  <hr style={{ borderColor: "var(--careers-border)", margin: "24px 0" }} />

                  <form onSubmit={handleSubmitApplication}>
                    <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 16px 0", color: "var(--careers-text)" }}>
                      Submit Your Application
                    </h3>

                    <div className="careers-form-row">
                      <div className="careers-form-group">
                        <label className="careers-form-label">Full Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Alex Morgan"
                          className="careers-form-input"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        />
                      </div>
                      <div className="careers-form-group">
                        <label className="careers-form-label">Email Address *</label>
                        <input
                          type="email"
                          required
                          placeholder="alex@example.com"
                          className="careers-form-input"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="careers-form-row">
                      <div className="careers-form-group">
                        <label className="careers-form-label">Phone / WhatsApp</label>
                        <input
                          type="tel"
                          placeholder="+1 (555) 019-2834"
                          className="careers-form-input"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                      <div className="careers-form-group">
                        <label className="careers-form-label">LinkedIn or GitHub Profile *</label>
                        <input
                          type="url"
                          required
                          placeholder="https://linkedin.com/in/... or github.com/..."
                          className="careers-form-input"
                          value={formData.linkedIn}
                          onChange={(e) => setFormData({ ...formData, linkedIn: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="careers-form-group">
                      <label className="careers-form-label">Resume / CV (PDF or DOCX) *</label>
                      <div
                        className="careers-upload-box"
                        onClick={() => setFormData({ ...formData, resumeAttached: true })}
                      >
                        <div className="careers-upload-icon">
                          {formData.resumeAttached ? <CheckCircle2 size={28} color="#10b981" /> : <Upload size={28} />}
                        </div>
                        <div className="careers-upload-title">
                          {formData.resumeAttached ? "Resume Attached: resume_2026.pdf" : "Click to attach or drag & drop Resume"}
                        </div>
                        <div className="careers-upload-sub">PDF, DOCX up to 10MB</div>
                      </div>
                    </div>

                    <div className="careers-form-group">
                      <label className="careers-form-label">Why NexusAI? (Optional)</label>
                      <textarea
                        rows={3}
                        placeholder="Tell us about a challenging engineering or AI systems problem you've solved..."
                        className="careers-form-input"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        style={{ resize: "vertical" }}
                      />
                    </div>

                    <div className="careers-modal-footer" style={{ padding: "16px 0 0 0", borderTop: "none" }}>
                      <button
                        type="button"
                        className="careers-btn-secondary"
                        onClick={() => setActiveJobModal(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="careers-btn-primary"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Submitting Application..." : "Submit Application →"}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="careers-success-state">
                  <div className="careers-success-icon">
                    <Check size={28} />
                  </div>
                  <h3>Application Received!</h3>
                  <p>
                    Thank you for applying for the <strong>{activeJobModal.title}</strong> role at NexusAI. Our talent engineering team will review your credentials and get back to you within 48 business hours.
                  </p>
                  <button
                    type="button"
                    className="careers-btn-primary"
                    onClick={() => setActiveJobModal(null)}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
