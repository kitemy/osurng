import React, { useEffect, useState } from "react";
import { api } from "../api/client";

export default function CollectionPage({ ctx }) {
  const rarities = ctx.auth.config?.rarities || [];
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [completion, setCompletion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState({ rarity: "", search: "", sortBy: "discovered_at", order: "desc" });
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await api.collection({ rarity: q.rarity || undefined, search: q.search || undefined, sortBy: q.sortBy, order: q.order, limit: 200 });
      setItems(res.items || []); setTotal(res.total || 0); setCompletion(res.completion || 0);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [q.rarity, q.sortBy, q.order]);
  function rstyle(id){ const r=rarities.find(x=>x.id===id); return r?{background:`${r.color}22`,color:r.color,borderColor:`${r.color}66`}:{}; }

  return (
    <div>
      <div className="row spread"><h2 className="page-title">Collection</h2><div className="muted">Completion: <strong style={{color:"#fff"}}>{completion.toFixed(2)}%</strong> · {total} unique</div></div>
      <div className="panel" style={{marginBottom:12}}>
        <div className="row">
          <input placeholder="Search player..." value={q.search} onChange={e=>setQ(s=>({...s,search:e.target.value}))} />
          <button className="btn" onClick={load}>Search</button>
          <select value={q.rarity} onChange={e=>setQ(s=>({...s,rarity:e.target.value}))}>
            <option value="">All rarities</option>
            {rarities.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select value={q.sortBy} onChange={e=>setQ(s=>({...s,sortBy:e.target.value}))}>
            <option value="discovered_at">Sort: Date</option>
            <option value="rarity">Sort: Rarity</option>
            <option value="rank">Sort: Rank</option>
            <option value="pp">Sort: PP</option>
            <option value="username">Sort: Username</option>
          </select>
          <select value={q.order} onChange={e=>setQ(s=>({...s,order:e.target.value}))}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
      </div>
      {error && <div className="banner error">{error}</div>}
      <div className="panel">
        {loading ? <div className="muted">Loading…</div> : (
          <table className="table">
            <thead><tr><th>Player</th><th>Rarity</th><th>Rank</th><th>PP</th><th>Duplicates</th><th>Discovered</th><th></th></tr></thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id}>
                  <td><div className="row"><img className="avatar sm" src={it.avatar_url||""} alt="" /><strong>{it.username}</strong></div></td>
                  <td><span className="badge" style={rstyle(it.rarity_id)}>{rarities.find(r=>r.id===it.rarity_id)?.name || it.rarity_id}</span></td>
                  <td>{it.global_rank ? `#${Number(it.global_rank).toLocaleString()}` : "—"}</td>
                  <td>{Math.round(it.pp||0).toLocaleString()}</td>
                  <td>{it.duplicates || 0}</td>
                  <td className="muted small">{new Date(it.discovered_at).toLocaleString()}</td>
                  <td><a href={`https://osu.ppy.sh/users/${it.osu_user_id}`} target="_blank" rel="noreferrer">osu!</a></td>
                </tr>
              ))}
              {items.length===0 && <tr><td colSpan={7} className="muted">No players discovered yet.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
