import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";

function formatLuck(n) { return `${Number(n || 1).toFixed(2)}x`; }
function rarityStyle(rarities, id) {
  const r = (rarities || []).find(x => x.id === id);
  return r ? { background: `${r.color}22`, color: r.color, borderColor: `${r.color}66` } : {};
}
function randName(pool) {
  if (!pool?.length) return "Rolling…";
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function RollPage({ ctx }) {
  const { auth, refresh } = ctx;
  const rarities = auth.config?.rarities || [];
  const [status, setStatus] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [displayName, setDisplayName] = useState("Ready to roll");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoLog, setAutoLog] = useState([]);
  const [now, setNow] = useState(Date.now());
  const autoRef = useRef(false);
  const poolNamesRef = useRef(["peppy", "Cookiezi", "WhiteCat", "mrekk", "Azer", "Vaxei", "chocomint", "Rafis", "Aricin", "idke"]);

  async function loadStatus() {
    try { const s = await api.rollStatus(); setStatus(s); } catch (e) { setError(e.message); }
  }
  useEffect(() => { loadStatus(); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const temp = status?.luck?.activeTemporary;
  const remainingMs = temp ? Math.max(0, new Date(temp.expiresAt).getTime() - now) : 0;
  useEffect(() => { if (temp && remainingMs === 0) loadStatus(); }, [remainingMs, temp]);

  function fmtRemaining(ms) {
    const s = Math.floor(ms / 1000); const m = Math.floor(s / 60); const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  async function animateNormal(finalName, ms = 3500) {
    const start = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        const elapsed = Date.now() - start;
        if (elapsed >= ms) { setDisplayName(finalName); resolve(); return; }
        const p = elapsed / ms;
        const interval = 50 + p * p * 350; // slow down
        setDisplayName(randName(poolNamesRef.current));
        setTimeout(tick, interval);
      };
      tick();
    });
  }

  async function doRoll(mode = "normal") {
    setError(""); setRolling(true); setResult(null);
    try {
      const promise = api.roll(mode, 1);
      if (mode === "normal") await animateNormal("…", 3500);
      else if (mode === "quick") await animateNormal("…", 700);
      const res = await promise;
      const player = res.player;
      if (player?.username) poolNamesRef.current = [player.username, ...poolNamesRef.current].slice(0, 30);
      setDisplayName(player?.username || "Unknown");
      setResult(res);
      setStatus((s) => s ? { ...s, luck: res.luck, stats: res.stats } : s);
      refresh().catch(() => {});
    } catch (e) {
      setError(e.message); setDisplayName("Roll failed");
    } finally { setRolling(false); }
  }

  async function runAuto() {
    if (autoRef.current) { autoRef.current = false; setAutoRunning(false); return; }
    autoRef.current = true; setAutoRunning(true); setError(""); setAutoLog([]);
    try {
      while (autoRef.current) {
        const res = await api.roll("auto", 25);
        const batch = res.results || [];
        setAutoLog((prev) => [...batch.filter(r=>r.ok).map(r=>r.player).reverse(), ...prev].slice(0, 30));
        setStatus((s) => s ? { ...s, luck: res.luck, stats: res.stats } : s);
        const hadError = batch.some(r => !r.ok);
        if (hadError) { setError(batch.find(r=>!r.ok)?.error || "Auto roll stopped"); break; }
      }
    } catch (e) { setError(e.message); }
    autoRef.current = false; setAutoRunning(false); refresh().catch(()=>{});
  }

  const totalRolls = status?.stats?.total_rolls || 0;
  const autoUnlocked = totalRolls >= (status?.rolling?.auto?.unlockRolls ?? 250);
  const quickUnlocked = totalRolls >= (status?.rolling?.quick?.unlockRolls ?? 5000);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid cols-4">
        <div className="panel stat"><strong>{formatLuck(status?.luck?.finalLuck)}</strong>Current luck</div>
        <div className="panel stat"><strong>{status?.luck?.equippedPermanent?.name || "None"}</strong>Equipped permanent item</div>
        <div className="panel stat"><strong>{temp && remainingMs > 0 ? fmtRemaining(remainingMs) : "Inactive"}</strong>Luck Clover timer</div>
        <div className="panel stat"><strong>{totalRolls.toLocaleString()}</strong>Total rolls</div>
      </div>

      <div className="grid cols-2">
        <div className="roll-stage">
          <div className={`roll-name ${rolling ? "shimmer" : "reveal"}`}>{displayName}</div>
          {result?.player && !rolling && (
            <div className="player-card reveal">
              <img src={result.player.avatar_url || ""} alt="" />
              <div className="info">
                <h3>{result.player.username} {result.isNew && <span className="badge" style={{background:"#1d3b2a",color:"#6ee7b7",borderColor:"#2f6b4b"}}>NEW</span>}</h3>
                <p>Rank: {result.player.global_rank ? `#${result.player.global_rank.toLocaleString()}` : "Unranked"} · PP: {Math.round(result.player.pp || 0).toLocaleString()}</p>
                <p><span className="badge" style={rarityStyle(rarities, result.player.rarity_id)}>{rarities.find(r=>r.id===result.player.rarity_id)?.name || result.player.rarity_id}</span></p>
                <p><a href={result.player.profile_url} target="_blank" rel="noreferrer">osu! profile</a></p>
              </div>
            </div>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary lg" onClick={() => doRoll("normal")} disabled={rolling || autoRunning}>Roll</button>
            <button className="btn" onClick={() => doRoll("quick")} disabled={rolling || autoRunning || !quickUnlocked} title={!quickUnlocked ? `Unlocks at ${status?.rolling?.quick?.unlockRolls ?? 5000} rolls` : ""}>Quick Roll {!quickUnlocked && "🔒"}</button>
            <button className="btn" onClick={runAuto} disabled={rolling || !autoUnlocked} title={!autoUnlocked ? `Unlocks at ${status?.rolling?.auto?.unlockRolls ?? 250} rolls` : ""}>{autoRunning ? "Stop Auto" : "Auto Roll"} {!autoUnlocked && "🔒"}</button>
          </div>
          {error && <div className="banner error" style={{margin:0}}>{error}</div>}
          <div className="muted small">Auto: {autoUnlocked ? "Unlocked" : `Locked (${status?.rolling?.auto?.unlockRolls ?? 250} rolls)`} · Quick: {quickUnlocked ? "Unlocked" : `Locked (${status?.rolling?.quick?.unlockRolls ?? 5000} rolls)`}</div>
        </div>

        <div className="panel">
          <h3 style={{marginTop:0}}>Recent / Auto discoveries</h3>
          {autoLog.length === 0 && <div className="muted">Run rolls to see discoveries here. Auto roll shows recent batch results.</div>}
          <div className="feed-list">
            {autoLog.map((p, i) => (
              <div key={`${p.id}-${i}`} className="feed-item">
                <img className="avatar" src={p.avatar_url || ""} alt="" />
                <div style={{flex:1}}>
                  <div><strong>{p.username}</strong> <span className="badge" style={rarityStyle(rarities, p.rarity_id)}>{rarities.find(r=>r.id===p.rarity_id)?.name || p.rarity_id}</span></div>
                  <div className="meta">#{p.global_rank?.toLocaleString?.() || "?"} · {Math.round(p.pp||0)}pp</div>
                </div>
                <a href={p.profile_url} target="_blank" rel="noreferrer">Profile</a>
              </div>
            ))}
          </div>
          <div style={{marginTop:12}}>
            <GlobalFeed rarities={rarities} />
          </div>
        </div>
      </div>
    </div>
  );
}

function GlobalFeed({ rarities }) {
  const [items, setItems] = useState([]);
  const sinceRef = useRef(0);
  useEffect(() => {
    let alive = true;
    async function poll(initial=false) {
      try {
        const res = await api.feed(initial ? undefined : sinceRef.current || undefined);
        if (!alive) return;
        const list = res.items || [];
        if (initial) {
          setItems(list.slice(-30).reverse());
          sinceRef.current = list.length ? list[list.length - 1].id : 0;
        } else if (list.length) {
          sinceRef.current = list[list.length - 1].id;
          setItems(prev => [...list.reverse(), ...prev].slice(0, 30));
        }
      } catch {}
    }
    poll(true);
    const t = setInterval(() => poll(false), 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  function rstyle(id){ return rarities?.length ? (function(){const r=rarities.find(x=>x.id===id);return r?{background:`${r.color}22`,color:r.color,borderColor:`${r.color}66`}:{}})() : {}; }
  return (
    <div>
      <h4 style={{margin:"0 0 8px"}}>Global discovery feed</h4>
      <div className="feed-list" style={{maxHeight:220}}>
        {items.length===0 && <div className="muted small">No notable discoveries yet.</div>}
        {items.map(it => (
          <div key={it.id} className="feed-item">
            {it.user_osu_id ? <a href={`https://osu.ppy.sh/users/${it.user_osu_id}`} target="_blank" rel="noreferrer"><img className="avatar sm" src={it.user_avatar||""} alt="" /></a> : <img className="avatar sm" src={it.user_avatar||""} alt="" />}
            <div style={{flex:1}}>
              <div className="small">{it.user_osu_id ? <a href={`https://osu.ppy.sh/users/${it.user_osu_id}`} target="_blank" rel="noreferrer"><strong>{it.user_username}</strong></a> : <strong>{it.user_username}</strong>} found <a href={`https://osu.ppy.sh/users/${it.osu_user_id}`} target="_blank" rel="noreferrer"><strong>{it.player_username}</strong></a> <span className="badge" style={rstyle(it.rarity_id)}>{rarities.find(r=>r.id===it.rarity_id)?.name || it.rarity_id}</span></div>
              <div className="meta">#{it.global_rank?.toLocaleString?.() || "?"} · {Math.round(it.pp||0)}pp · <a href={`https://osu.ppy.sh/users/${it.osu_user_id}`} target="_blank" rel="noreferrer">profile</a></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
