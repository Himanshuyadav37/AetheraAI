export const getAvatarStyle = (username) => {
  const colors = [
    "linear-gradient(135deg, #6366f1, #a855f7)", // Indigo -> Purple
    "linear-gradient(135deg, #06b6d4, #3b82f6)", // Cyan -> Blue
    "linear-gradient(135deg, #ec4899, #f43f5e)", // Pink -> Rose
    "linear-gradient(135deg, #8b5cf6, #10b981)", // Violet -> Emerald
    "linear-gradient(135deg, #f97316, #eab308)", // Orange -> Amber
  ];
  if (!username) return { background: colors[0], color: "#ffffff", fontWeight: "600" };
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return { background: colors[index], color: "#ffffff", fontWeight: "600" };
};
