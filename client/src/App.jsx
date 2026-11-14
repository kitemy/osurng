import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { api } from "./api/client";
import RollPage from "./pages/RollPage";
import CollectionPage from "./pages/CollectionPage";
import InventoryPage from "./pages/InventoryPage";
import LeaderboardsPage from "./pages/LeaderboardsPage";
import QuestsPage from "./pages/QuestsPage";
import ProfilePage from "./pages/ProfilePage";

export default function App() {
  const [auth, setAuth] = useState({ loading: true, user: null, stats: null, config: null, error: null });
  const navigate = useNavigate();

  async function refresh() {
    try {
      const [config, profile] = await Promise.all([
        api.config(),
        api.me().catch((e) => (e.message.includes("Not authenticated") ? null : Promise.reject(e))),
      ]);
      if (profile) setAuth({ loading: false, user: profile.user, stats: profile.stats, config, error: null });
      else setAuth({ loading: false, user: null, stats: null, config, error: null });
    } catch (e) {
      setAuth((a) => ({ ...a, loading: false, error: e.message }));
    }
  }

  useEffect(() => { refresh(); }, []);

  async function logout() {
    await api.logout().catch(() => {});
    setAuth((a) => ({ ...a, user: null, stats: null }));
    navigate("/");
  }

  const ctx = useMemo(() => ({ auth, setAuth, refresh, logout }), [auth]);

  if (auth.loading) return <div className="app-loading">Loading osu! RNG…</div>;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">osu! RNG</div>
        <nav className="nav">
          <NavLink to="/">Roll</NavLink>
          <NavLink to="/collection">Collection</NavLink>
          <NavLink to="/inventory">Inventory</NavLink>
          <NavLink to="/leaderboards">Leaderboards</NavLink>
          <NavLink to="/quests">Quests</NavLink>
          <NavLink to="/profile">Profile</NavLink>
        </nav>
        <div className="userbox">
          {auth.user ? (
            <>
              <img className="avatar sm" src={auth.user.avatar_url || ""} alt="" />
              <span>{auth.user.username}</span>
              <button className="btn ghost" onClick={logout}>Logout</button>
            </>
          ) : (
            <a className="btn primary" href={api.loginUrl}>Login with osu!</a>
          )}
        </div>
      </header>

      {auth.error && <div className="banner error">{auth.error}</div>}

      {!auth.user ? (
        <main className="main guest">
          <section className="hero">
            <h1>Roll real osu! players. Build your collection.</h1>
            <p>Login with your osu! account to play, earn luck, complete quests, and climb global leaderboards.</p>
            <a className="btn primary lg" href={api.loginUrl}>Login with osu!</a>
            <p className="hint">This app requires osu! OAuth credentials on the server. For local play, configure <code>.env</code> (see docs).</p>
          </section>
        </main>
      ) : (
        <main className="main">
          <Routes>
            <Route path="/" element={<RollPage ctx={ctx} />} />
            <Route path="/collection" element={<CollectionPage ctx={ctx} />} />
            <Route path="/inventory" element={<InventoryPage ctx={ctx} />} />
            <Route path="/leaderboards" element={<LeaderboardsPage ctx={ctx} />} />
            <Route path="/quests" element={<QuestsPage ctx={ctx} />} />
            <Route path="/profile" element={<ProfilePage ctx={ctx} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      )}
    </div>
  );
}
