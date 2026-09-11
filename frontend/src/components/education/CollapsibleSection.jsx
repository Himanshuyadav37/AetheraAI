import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, HelpCircle, Layers, Code, Sparkles, BookOpen } from "lucide-react";
import "./CollapsibleSection.css";

export default function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  variant = "default", // 'practice' | 'diagram' | 'step' | 'default'
  children,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const getVariantIcon = () => {
    if (icon) return icon;
    switch (variant) {
      case "practice":
        return <HelpCircle size={14} className="sec-icon practice" />;
      case "diagram":
        return <Layers size={14} className="sec-icon diagram" />;
      case "step":
        return <CheckCircle2 size={14} className="sec-icon step" />;
      case "code":
        return <Code size={14} className="sec-icon code" />;
      default:
        return <BookOpen size={14} className="sec-icon default" />;
    }
  };

  return (
    <div className={`md-collapsible-card variant-${variant} ${isOpen ? "is-open" : "is-collapsed"}`}>
      <div 
        className="md-collapsible-header"
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
      >
        <div className="md-collapsible-left">
          <span className="md-collapsible-icon-wrapper">
            {getVariantIcon()}
          </span>
          <span className="md-collapsible-title">{title}</span>
          {badge && <span className="md-collapsible-badge">{badge}</span>}
        </div>

        <div className="md-collapsible-right">
          <span className="md-collapsible-status-text">
            {isOpen ? "Collapse" : "Expand"}
          </span>
          <button 
            type="button" 
            className="md-collapsible-chevron"
            aria-label={isOpen ? "Collapse section" : "Expand section"}
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="md-collapsible-body">
          {children}
        </div>
      )}
    </div>
  );
}
