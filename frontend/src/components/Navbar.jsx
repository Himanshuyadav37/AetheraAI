import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Search, FolderGit2, Menu, ChevronUp, ChevronDown } from "lucide-react";
import { useWorkspace } from "../contexts/WorkspaceContext";
import api from "../services/api";
import "./Navbar.css";

function Navbar() {
  const navigate = useNavigate();
  const { toggleSidebar, isNavbarVisible, setIsNavbarVisible } = useWorkspace();
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(true);
  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);

  // Load execution projects on mount
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await api.get("/ai/executions");
        setProjects(res.data || []);
      } catch (err) {
        console.error("Failed to load search index", err);
      }
    }
    loadProjects();
  }, []);

  // Filter projects when query changes (derived directly in render)
  const trimmedQuery = query.trim().toLowerCase();
  const searchResults = trimmedQuery ? projects.filter((proj) => {
    const name = (proj.project_plan?.project_name || "").toLowerCase();
    const idea = (proj.idea || "").toLowerCase();
    return name.includes(trimmedQuery) || idea.includes(trimmedQuery);
  }) : [];

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleNotifications = () => {
    setShowNotifications(!showNotifications);
    setHasNewNotifications(false);
  };

  return (
    <>
      <header className={`navbar ${isNavbarVisible ? "" : "hidden"}`}>
        {/* Menu toggle button for mobile drawers */}
        <div className="navbar-left">
          <button type="button" className="mobile-menu-btn" onClick={toggleSidebar} aria-label="Toggle menu" id="mobile-menu-toggle">
            <Menu size={20} />
          </button>
        </div>

        <div className="navbar-right">
          {/* Search Box with project history autocomplete */}
          <div className="search-box" style={{ position: "relative" }} ref={dropdownRef}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search projects..."
              value={query}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDropdown(true);
              }}
            />

            {showDropdown && searchResults.length > 0 && (
              <div style={{
                position: "absolute",
                top: "42px",
                right: 0,
                width: "280px",
                background: "#171717",
                border: "1px solid #2a2a2a",
                borderRadius: "10px",
                zIndex: 1000,
                padding: "6px",
                boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
                maxHeight: "300px",
                overflowY: "auto"
              }}>
                <div style={{ padding: "4px 8px", fontSize: "11px", color: "#a3a3a3", borderBottom: "1px solid #2a2a2a", marginBottom: "4px" }}>
                  Matching Projects ({searchResults.length})
                </div>
                {searchResults.map((proj) => {
                  const name = proj.project_plan?.project_name || proj.idea || "Untitled Project";
                  return (
                    <button
                      key={proj._id}
                      onClick={() => {
                        setQuery("");
                        setShowDropdown(false);
                        navigate(`/projects/${proj._id}`);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 12px",
                        background: "transparent",
                        border: "none",
                        color: "#ffffff",
                        fontSize: "13px",
                        cursor: "pointer",
                        borderRadius: "6px",
                        transition: "background 0.15s"
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = "#212121"}
                      onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <FolderGit2 size={13} style={{ color: "#a3a3a3", flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ position: "relative" }} ref={notificationRef}>
            <button className="icon-btn" onClick={handleToggleNotifications}>
              <Bell size={18} />
              {hasNewNotifications && <span className="notification-dot"></span>}
            </button>

            {showNotifications && (
              <div style={{
                position: "absolute",
                top: "42px",
                right: 0,
                width: "300px",
                background: "#171717",
                border: "1px solid #2a2a2a",
                borderRadius: "10px",
                zIndex: 1000,
                padding: "12px",
                boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
                color: "#ffffff"
              }}>
                <div style={{ paddingBottom: "6px", fontSize: "12px", color: "#a3a3a3", borderBottom: "1px solid #2a2a2a", marginBottom: "8px", fontWeight: "600" }}>
                  Notifications
                </div>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}>
                  <div style={{
                    background: "rgba(139, 92, 246, 0.08)",
                    border: "1px solid rgba(139, 92, 246, 0.25)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "12px",
                    lineHeight: "1.5"
                  }}>
                    <span style={{ color: "#a78bfa", fontWeight: "bold", display: "block", marginBottom: "4px" }}>
                      🚀 Incoming Update
                    </span>
                    A complete RAG (Retrieval-Augmented Generation) implementation is coming soon! Empower your AI agents with local document knowledge bases.
                  </div>
                </div>
              </div>
            )}
          </div>

          <button 
            type="button" 
            className="icon-btn collapse-navbar-btn" 
            onClick={() => setIsNavbarVisible(false)} 
            title="Collapse Navbar"
          >
            <ChevronUp size={18} />
          </button>
        </div>
      </header>

      {!isNavbarVisible && (
        <button
          type="button"
          className="navbar-show-btn"
          onClick={() => setIsNavbarVisible(true)}
          title="Expand Navbar"
          id="navbar-expand-trigger"
        >
          <ChevronDown size={16} />
        </button>
      )}
    </>
  );
}

export default Navbar;