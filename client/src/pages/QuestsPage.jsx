import React, { useEffect, useState } from "react";
import { api } from "../api/client";

export default function QuestsPage() {
  const [quests, setQuests] = useState([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    try { const res = await api.quests(); setQuests(res.quests || []); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function claim(id) {
    setError(""); setMsg("");
    try { const res = await api.claimQuest(id); setQuests(res.quests || []); setMsg("Reward claimed"); }
    catch (e) { setError(e.message); }
  }

  return (
    <div>
      <h2 className="page-title">Daily Quests</h2>
      <p className="muted">Quests reset daily (server timezone). Progress updates automatically from your rolls and discoveries.</p>
      {error && <div className="banner error">{error}</div>}
      {msg && <div className="banner ok">{msg}</div>}
      <div className="grid cols-2">
        {quests.map(q => {
          const def = q.definition || {};
          const pct = Math.min(100, Math.round((q.progress / (def.target || 1)) * 100));
          return (
            <div key={q.quest_def_id} className="panel">
              <div className="row spread"><strong>{def.description || q.quest_def_id}</strong>
                <span className="badge" style={q.claimed ? {background:"#173a6b",color:"#9fd0ff"} : q.completed ? {background:"#1d3b2a",color:"#6ee7b7"} : {}}>{q.claimed ? "Claimed" : q.completed ? "Completed" : "In progress"}</span>
              </div>
              <div className="muted small" style={{margin:"6px 0"}}>Progress: {q.progress} / {def.target}</div>
              <div className="progress"><span style={{width:`${pct}%`}} /></div>
              <div className="muted small" style={{marginTop:8}}>
                Rewards: {(def.rewards||[]).map((r,i)=> r.type==="item" ? `${r.quantity||1}x ${r.itemId}` : r.type).join(", ") || "—"}
              </div>
              <div style={{marginTop:10}}>
                <button className="btn primary" disabled={!q.completed || q.claimed} onClick={()=>claim(q.quest_def_id)}>Claim</button>
              </div>
            </div>
          );
        })}
        {quests.length===0 && <div className="panel muted">No quests available.</div>}
      </div>
    </div>
  );
}
