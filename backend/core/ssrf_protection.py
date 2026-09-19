"""
SSRF Protection — Aethera Automation AI

Validates all external URLs before making outbound HTTP requests.
Blocks:
  - Private/loopback addresses (RFC 1918, RFC 4291)
  - Link-local addresses (169.254.x.x, fe80::/10)
  - Cloud metadata endpoints (169.254.169.254, etc.)
  - file://, gopher://, dict:// and other dangerous schemes
  - Hostnames resolving to internal IPs
"""

import ipaddress
import logging
import socket
from urllib.parse import urlparse
from typing import Set

logger = logging.getLogger("aethera.ssrf_protection")

# ── Allowed URL schemes ────────────────────────────────────────────────────
ALLOWED_SCHEMES: Set[str] = {"https", "http"}
PRODUCTION_ALLOWED_SCHEMES: Set[str] = {"https"}

# ── Known metadata / IMDS endpoints to block ──────────────────────────────
BLOCKED_HOSTNAMES: Set[str] = {
    "169.254.169.254",         # AWS/GCP/Azure IMDS
    "metadata.google.internal",
    "metadata.internal",
    "instance-data",
    "localhost",
    "0.0.0.0",
    "::1",
    "[::1]",
}

# ── Integration allowlist — only these base domains are permitted ──────────
# LLM will NEVER produce a URL that gets fetched; all URLs come from config.
INTEGRATION_ALLOWED_DOMAINS: Set[str] = {
    "api.github.com",
    "slack.com",
    "api.slack.com",
    "linear.app",
    "api.linear.app",
    "api.atlassian.com",      # Jira Cloud
    "api.groq.com",
    "api.openai.com",
    "api.anthropic.com",
    "resend.com",
    "api.resend.com",
    "smtp-relay.brevo.com",
}


class SSRFError(ValueError):
    """Raised when a URL fails SSRF validation."""
    pass


def validate_url(url: str, *, require_https: bool = True, use_allowlist: bool = True) -> str:
    """
    Validate a URL against SSRF rules.

    Parameters
    ----------
    url : str
        URL to validate.
    require_https : bool
        If True (default), only https:// is permitted.
    use_allowlist : bool
        If True (default), the hostname must be in INTEGRATION_ALLOWED_DOMAINS.

    Returns
    -------
    str
        The original URL if validation passes.

    Raises
    ------
    SSRFError
        If the URL fails any validation check.
    """
    if not url or not isinstance(url, str):
        raise SSRFError("URL must be a non-empty string.")

    url = url.strip()

    parsed = urlparse(url)

    # 1. Scheme check
    scheme = parsed.scheme.lower()
    allowed = PRODUCTION_ALLOWED_SCHEMES if require_https else ALLOWED_SCHEMES
    if scheme not in allowed:
        raise SSRFError(f"Disallowed URL scheme '{scheme}'. Only {sorted(allowed)} are permitted.")

    # 2. Must have a hostname
    hostname = parsed.hostname
    if not hostname:
        raise SSRFError("URL has no hostname.")

    hostname_lower = hostname.lower().strip("[]")

    # 3. Blocked hostname list
    if hostname_lower in BLOCKED_HOSTNAMES:
        raise SSRFError(f"Blocked hostname: '{hostname_lower}'.")

    # 4. Allowlist check (integration-facing URLs)
    if use_allowlist:
        # Allow exact match or subdomain match
        allowed_match = any(
            hostname_lower == d or hostname_lower.endswith("." + d)
            for d in INTEGRATION_ALLOWED_DOMAINS
        )
        if not allowed_match:
            raise SSRFError(
                f"Hostname '{hostname_lower}' is not in the integration allowlist. "
                f"Allowed: {sorted(INTEGRATION_ALLOWED_DOMAINS)}"
            )

    # 5. DNS resolution check — verify the IP doesn't resolve to a private range
    try:
        addr_infos = socket.getaddrinfo(hostname_lower, None)
        for addr_info in addr_infos:
            ip_str = addr_info[4][0]
            _check_ip_not_private(ip_str, hostname_lower)
    except SSRFError:
        raise
    except OSError as e:
        # DNS resolution failure — treat as blocked
        raise SSRFError(f"DNS resolution failed for '{hostname_lower}': {e}")

    return url


def _check_ip_not_private(ip_str: str, hostname: str) -> None:
    """Raise SSRFError if the IP is in a private/reserved range."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        raise SSRFError(f"Invalid IP address '{ip_str}' for hostname '{hostname}'.")

    if ip.is_loopback:
        raise SSRFError(f"Hostname '{hostname}' resolves to loopback address {ip_str}.")
    if ip.is_private:
        raise SSRFError(f"Hostname '{hostname}' resolves to private IP {ip_str}.")
    if ip.is_link_local:
        raise SSRFError(f"Hostname '{hostname}' resolves to link-local IP {ip_str}.")
    if ip.is_reserved:
        raise SSRFError(f"Hostname '{hostname}' resolves to reserved IP {ip_str}.")
    if ip.is_multicast:
        raise SSRFError(f"Hostname '{hostname}' resolves to multicast IP {ip_str}.")

    # Explicit block for AWS metadata IP range
    try:
        aws_meta = ipaddress.ip_network("169.254.169.254/32")
        if ip in aws_meta:
            raise SSRFError(f"Hostname '{hostname}' resolves to cloud metadata IP {ip_str}.")
    except ValueError:
        pass


def is_url_safe(url: str, *, require_https: bool = True, use_allowlist: bool = True) -> bool:
    """
    Non-raising version of validate_url. Returns True if safe, False otherwise.
    """
    try:
        validate_url(url, require_https=require_https, use_allowlist=use_allowlist)
        return True
    except SSRFError as e:
        logger.warning(f"[SSRF] Blocked URL '{url}': {e}")
        return False
