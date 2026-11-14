import React, { useEffect, useState } from "react";
import { api } from "../api/client";

export default function InventoryPage({ ctx }) {
  const [inv, setInv] = useState(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(Date.now());

  async function load() {
    try { setInv(await api.inventory()); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setInterval(()=>setNow(Date.now()), 1000); return ()=>clearInterval(t); }, []);
  useEffect(() => { if (inv?.luck?.activeTemporary && new Date(inv.luck.activeTemporary.expiresAt).getTime() <= now) load(); }, [now]);

  async function act(fn) {
    setError(""); setMsg("");
    try { const res = await fn(); setInv(res.inventory || res); if (res.activated) setMsg(`Activated ${res.itemId}`); }
    catch (e) { setError(e.message); }
  }

  const permanentOwned = (inv?.items || []).filter(i => i.item_type === "permanent");
  const temporaryOwned = (inv?.items || []).filter(i => i.item_type === "temporary");
  const temp = inv?.luck?.activeTemporary;
  const remainingMs = temp ? Math.max(0, new Date(temp.expiresAt).getTime() - now) : 0;
  const fmt = (ms) => { const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; };

  return (
    <div>
      <h2 className="page-title">Inventory</h2>
      {error && <div className="banner error">{error}</div>}
      {msg && <div className="banner ok">{msg}</div>}

      <div className="grid cols-2" style={{marginBottom:12}}>
        <div className="panel">
          <h3 style={{marginTop:0}}>Luck status</h3>
          <div className="kv">
            <div className="k">Final luck</div><div><strong>{Number(inv?.luck?.finalLuck || 1).toFixed(2)}x</strong></div>
            <div className="k">Base</div><div>{Number(inv?.luck?.baseLuck || 1).toFixed(2)}x</div>
            <div className="k">Permanent bonus</div><div>+{Math.round((inv?.luck?.permanentBonus||0)*100)}%</div>
            <div className="k">Temporary multiplier</div><div>{Number(inv?.luck?.temporaryMultiplier || 1).toFixed(2)}x</div>
            <div className="k">Equipped</div><div>{inv?.luck?.equippedPermanent?.name || "None"}</div>
            <div className="k">Active effect</div><div>{temp && remainingMs>0 ? `${temp.itemId} (${fmt(remainingMs)} left)` : "None"}</div>
          </div>
        </div>
        <div className="panel">
          <h3 style={{marginTop:0}}>Available item definitions</h3>
          <div className="muted small" style={{marginBottom:8}}>Permanent luck items (earn through play/milestones):</div>
          {Object.values(inv?.definitions?.permanent || {}).map(d => (
            <div key={d.id} className="row spread" style={{padding:"6px 0", borderBottom:"1px solid var(--border)"}}>
              <div><strong>{d.name}</strong> <span className="muted">+{Math.round(d.bonus*100)}% luck</span><div className="muted small">{d.description} · Unlock: {d.unlock?.type === "rolls" ? `${d.unlock.value} rolls` : "progression"}</div></div>
            </div>
          ))}
          <div className="muted small" style={{margin:"10px 0 8px"}}>Temporary items:</div>
          {Object.values(inv?.definitions?.temporary || {}).map(d => (
            <div key={d.id} style={{padding:"6px 0"}}>
              <strong>{d.name}</strong> <span className="muted">{d.multiplier}x for {Math.round((d.durationMs||0)/60000)} min</span>
              <div className="muted small">{d.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid cols-2">
        <div className="panel">
          <h3 style={{marginTop:0}}>Permanent items owned</h3>
          {permanentOwned.length===0 && <div className="muted">No permanent items yet. Earn them via milestones and progression.</div>}
          {permanentOwned.map(it => (
            <div key={it.item_id} className="row spread" style={{padding:"8px 0", borderBottom:"1px solid var(--border)"}}>
              <div>
                <strong>{it.definition?.name}</strong> {it.is_equipped && <span className="badge" style={{background:"#173a6b",color:"#9fd0ff",borderColor:"#2b7fff"}}>Equipped</span>}
                <div className="muted small">{it.definition?.description}</div>
              </div>
              <div className="row">
                {it.is_equipped ? (
                  <button className="btn" onClick={() => act(() => api.unequip())}>Unequip</button>
                ) : (
                  <button className="btn primary" onClick={() => act(() => api.equip(it.item_id))}>Equip</button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="panel">
          <h3 style={{marginTop:0}}>Temporary items</h3>
          {temporaryOwned.length===0 && <div className="muted">No temporary items. Earn Luck Clovers from quests and milestones.</div>}
          {temporaryOwned.map(it => (
            <div key={it.item_id} className="row spread" style={{padding:"8px 0", borderBottom:"1px solid var(--border)"}}>
              <div>
                <strong>{it.definition?.name}</strong> <span className="muted">x{it.quantity}</span>
                <div className="muted small">{it.definition?.description}</div>
              </div>
              <button className="btn primary" disabled={it.quantity<=0} onClick={() => act(() => api.activate(it.item_id))}>Activate</button>
            </div>
          ))}
          {temporaryOwned.filter(i=>i.quantity>0).length===0 && temporaryOwned.length>0 && <div className="muted small">You have no consumables left.</div>}
        </div>
      </div>
    </div>
  );
}
