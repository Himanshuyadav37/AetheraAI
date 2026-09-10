import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Check, X, Building, Shield, Bell, ArrowRight, Loader2 } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import "./TeamInviteNotification.css";

export default function TeamInviteNotification() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState([]);
  const [activeInvite, setActiveInvite] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [dismissedIds, setDismissedIds] = useState(new Set());

  const fetchPendingInvites = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/api/teams/invites/pending");
      const list = res.data || [];
      setInvites(list);

      // Find the first un-dismissed invite to display in the popup banner
      const unDismissed = list.find((inv) => !dismissedIds.has(inv.id));
      setActiveInvite(unDismissed || null);
    } catch (err) {
      // Silently fail if not authenticated or network error
    }
  }, [user, dismissedIds]);

  useEffect(() => {
    if (!user) return;
    fetchPendingInvites();

    // Poll periodically every 12 seconds
    const interval = setInterval(fetchPendingInvites, 12000);

    // Listen for custom trigger events
    const handleRefresh = () => fetchPendingInvites();
    window.addEventListener("refresh_team_invites", handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("refresh_team_invites", handleRefresh);
    };
  }, [user, fetchPendingInvites]);

  const handleAccept = async (invite) => {
    if (!invite || processingId) return;
    setProcessingId(invite.id);
    try {
      const res = await api.post(`/api/teams/invites/${invite.id}/accept`);
      // Update local state
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      setActiveInvite(null);

      // Broadcast update to all components
      window.dispatchEvent(new CustomEvent("my_teams_updated"));
      window.dispatchEvent(new CustomEvent("refresh_team_invites"));

      // Navigate to team workspace
      navigate("/team-workspace");
    } catch (err) {
      alert("Error accepting invitation: " + (err.response?.data?.detail || err.message));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invite) => {
    if (!invite || processingId) return;
    setProcessingId(invite.id);
    try {
      await api.post(`/api/teams/invites/${invite.id}/decline`);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      setActiveInvite(null);
      window.dispatchEvent(new CustomEvent("refresh_team_invites"));
    } catch (err) {
      alert("Error declining invitation: " + (err.response?.data?.detail || err.message));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismiss = (inviteId) => {
    setDismissedIds((prev) => new Set(prev).add(inviteId));
    setActiveInvite(null);
  };

  if (!user || !activeInvite) return null;

  return (
    <div className="team-invite-toast-container" role="alert" aria-live="assertive">
      <div className="team-invite-card">
        {/* Glow accent */}
        <div className="team-invite-glow" />

        <div className="team-invite-header">
          <div className="team-invite-badge">
            <Users size={14} className="team-invite-icon" />
            <span>Workspace Invitation</span>
          </div>
          <button
            type="button"
            className="team-invite-close-btn"
            onClick={() => handleDismiss(activeInvite.id)}
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>

        <div className="team-invite-body">
          <h4 className="team-invite-title">{activeInvite.team_name || "Team Workspace"}</h4>
          {activeInvite.team_description && (
            <p className="team-invite-desc">{activeInvite.team_description}</p>
          )}

          <div className="team-invite-meta">
            <span className="team-invite-sender">
              Invited by <strong>{activeInvite.inviter_email}</strong>
            </span>
            <span className="team-invite-role-tag">Role: {activeInvite.role || "Member"}</span>
          </div>
        </div>

        <div className="team-invite-actions">
          <button
            type="button"
            className="team-invite-accept-btn"
            disabled={processingId === activeInvite.id}
            onClick={() => handleAccept(activeInvite)}
          >
            {processingId === activeInvite.id ? (
              <>
                <Loader2 size={13} className="spin-icon" /> Joining...
              </>
            ) : (
              <>
                <Check size={14} /> Accept & Join
              </>
            )}
          </button>

          <button
            type="button"
            className="team-invite-decline-btn"
            disabled={processingId === activeInvite.id}
            onClick={() => handleDecline(activeInvite)}
          >
            <X size={14} /> Decline
          </button>
        </div>
      </div>
    </div>
  );
}
