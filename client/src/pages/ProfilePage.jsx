import React from "react";

export default function ProfilePage({ ctx }) {
  const { auth } = ctx;
  const user = auth.user;
  const stats = auth.stats || {};
  const rarities = auth.config?.rarities || [];
  const highestName = rarities.find(r=>r.id===stats.highest_rarity_id)?.name || stats.highest_rarity_id || "—";
  const completion = stats.totalPlayersInPool ? (stats.unique_players / stats.totalPlayersInPool) * 100 : 0;

  return (
    <div>
      <h2 className="page-title">Profile</h2>
      <div className="grid cols-2">
        <div className="panel">
          <div className="row" style={{marginBottom:12}}>
            <img className="avatar" src={user?.avatar_url||""} alt="" style={{width:64,height:64}} />
            <div>
              <h3 style={{margin:0}}>{user?.username}</h3>
              <div className="muted">osu! ID: {user?.osu_user_id}</div>
              <div className="muted small">Joined: {user?.created_at ? new Date(user.created_at).toLocaleString() : "—"}</div>
            </div>
          </div>
          <div className="kv">
            <div className="k">Total rolls</div><div>{Number(stats.total_rolls||0).toLocaleString()}</div>
            <div className="k">Unique players</div><div>{Number(stats.unique_players||0).toLocaleString()}</div>
            <div className="k">Total discoveries</div><div>{Number(stats.total_discoveries||0).toLocaleString()}</div>
            <div className="k">Highest rarity</div><div>{highestName}</div>
            <div className="k">Highest-ranked player found</div><div>{stats.highest_player_rank ? `#${Number(stats.highest_player_rank).toLocaleString()}` : "—"}</div>
            <div className="k">Highest PP found</div><div>{Math.round(stats.highest_pp||0).toLocaleString()}</div>
            <div className="k">Collection completion</div><div>{completion.toFixed(2)}%</div>
            <div className="k">Players in pool</div><div>{Number(stats.totalPlayersInPool||0).toLocaleString()}</div>
          </div>
        </div>
        <div className="panel">
          <h3 style={{marginTop:0}}>Notes</h3>
          <ul className="muted" style={{lineHeight:1.6}}>
            <li>All rolls, luck, inventory, and quests are validated server-side.</li>
            <li>Progress saves automatically to the database.</li>
            <li>Temporary luck effects use server timestamps and persist across refresh/reconnect.</li>
            <li>Auto Roll unlocks at 250 rolls; Quick Roll unlocks at 5,000 rolls (configurable).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
