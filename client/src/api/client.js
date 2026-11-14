const API_BASE = "";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  me: () => request("/api/profile"),
  config: () => request("/api/config"),
  rollStatus: () => request("/api/roll/status"),
  roll: (mode, count) => request("/api/roll", { method: "POST", body: JSON.stringify({ mode, count }) }),
  inventory: () => request("/api/inventory"),
  equip: (itemId) => request("/api/inventory/equip", { method: "POST", body: JSON.stringify({ itemId }) }),
  unequip: () => request("/api/inventory/unequip", { method: "POST" }),
  activate: (itemId) => request("/api/inventory/activate", { method: "POST", body: JSON.stringify({ itemId }) }),
  collection: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v !== undefined && v !== ""));
    return request(`/api/collection?${qs.toString()}`);
  },
  leaderboards: () => request("/api/leaderboards"),
  quests: () => request("/api/quests"),
  claimQuest: (questId) => request("/api/quests/claim", { method: "POST", body: JSON.stringify({ questId }) }),
  feed: (sinceId) => request(`/api/feed${sinceId ? `?sinceId=${sinceId}` : ""}`),
  logout: () => request("/auth/logout", { method: "POST" }),
  loginUrl: "/auth/login",
};
