/**
 * Convert bigint nanoseconds to a Date
 */
export function nsToDate(ns: bigint): Date {
  return new Date(Number(ns) / 1_000_000);
}

/**
 * Format a timestamp for display in a conversation list (relative time or date)
 */
export function formatConversationTime(ns: bigint): string {
  const date = nsToDate(ns);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Today: show time
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * Format a message timestamp for display in a chat
 */
export function formatMessageTime(ns: bigint): string {
  const date = nsToDate(ns);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Get initials from a username
 */
export function getInitials(username: string): string {
  return username
    .split(/[\s_-]+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

/**
 * Generate a consistent hue for a username (for avatar backgrounds)
 */
export function usernameToHue(username: string): number {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash) % 360;
}
