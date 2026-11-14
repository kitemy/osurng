import React, { useEffect, useState } from "react";
import { api } from "../api/client";

const tabs = [
  { id: "totalRolls", label: "Most total rolls", field: "value", fmt: v => Number(v||0).toLocaleString() },
  { id: "highestRarity", label: "Highest rarity", field: "value", fmt: (v, row, rarities) => (rarities.find(r=>r.id===v)?.name || v || "—") },
  { id: "uniquePlayers", label: "Most unique players", field: "value", fmt: v => Number(v||0).toLocaleString() },
  { id: "highestRank", label: "Highest-ranked player discovered", field: "value", fmt: v => v ? `#${Number(v).toLocaleString()}` : "—" },
  { id: "totalDiscoveries", label: "Most total discoveries", field: "value", fmt: v => Number(v||0).toLocaleString() },
  { id: "completion", label: "Highest collection completion", field: "value", fmt: v => `${Number(v||0).toFixed(2)}%` },
];

export default function LeaderboardsPage({ ctx }) {
  const rarities = ctx.auth.config?.rarities || [];
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("totalRolls");
  const [error, setError] = useState("");

  useEffect(() => { api.leaderboards().then(setData).catch(e=>setError(e.message)); }, []);

  const rows = data?.[tab] || [];
  const t = tabs.find(x=>x.id===tab);
  return (
    <div>
      <h2 className="page-title">Leaderboards</h2>
      {error && <div className="banner error">{error}</div>}
      <div className="panel" style={{marginBottom:12}}>
        <div className="row" style={{flexWrap:"wrap"}}>
          {tabs.map(x => <button key={x.id} className={`btn ${tab===x.id?"primary":""}`} onClick={()=>setTab(x.id)}>{x.label}</button>)}
        </div>
      </div>
      <div className="panel">
        <table className="table">
          <thead><tr><th>#</th><th>User</th><th>{t?.label}</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id || i}>
                <td>{i+1}</td>
                <td><div className="row"><img className="avatar sm" src={r.avatar_url||""} alt="" /> <strong>{r.username}</strong></div></td>
                <td>{t?.fmt(r[t.field], r, rarities)}</td>
              </tr>
            ))}
            {rows.length===0 && <tr><td colSpan={3} className="muted">No data yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
