# Modifying osu! RNG

Primary balance/config: `config/gameConfig.js`

## Rarity
- `RARITIES`: id, name, color, order (used for comparisons/feed), base `weight` (roll distribution), feed/announce flags.
- `RARITY_THRESHOLDS`: evaluated highest->lowest in `server/services/rarityService.js:computeRarity`. Conditions: `global_rank <= maxRank && pp >= minPP`. Null/unranked treated as Infinity.
- Every player must resolve to a rarity; fallback is `common`.

## Luck
- `LUCK.baseLuck`, `LUCK.maxFinalLuck`, `LUCK.rarityBiasExponent` control final luck cap and how strongly luck shifts mass to higher tiers.
- Formula: `finalLuck = min(maxFinalLuck, baseLuck * (1 + permanentBonus) * temporaryMultiplier)` (`computeFinalLuck`).
- Probabilities: base weights adjusted by tier factor and renormalized to 100% (`getRarityProbabilities`). Higher luck should not reduce higher-tier odds; normalization keeps totals exact.

## Items
- `TEMPORARY_ITEMS.luck_clover`: `multiplier`, `durationMs` (server-side expiry stored in `active_effects.expires_at`). `stackable:false` refreshes duration.
- `PERMANENT_ITEMS`: `bonus` and `unlock` metadata. Only one permanent item equipped at a time (`inventory_items.is_equipped`).

## Rolling & unlocks
- `ROLLING.normal/auto/quick`: `animationMs`, `unlockRolls` (auto 250, quick 5000 by default).
- `rollCooldownMs` server-enforced; `maxAutoBatch` limits auto batch size per request.

## Progression & quests
- `MILESTONES`: roll thresholds and rewards (granted once, tracked in `milestone_rewards`).
- `DAILY_QUESTS`: id, description, type (`rolls`, `unique_discoveries`, `min_rarity`), target, rewards. Progress updated in `server/services/questService.js` on each roll; claims are transactional.
- Quest period defaults to UTC day key; adjust `TIMEZONE` and period logic if you need strict local timezone resets.

## Global feed
- `FEED.includeRarities`, `optionalRarities`, `pollIntervalMs`, `maxItems`. Feed rows inserted on qualifying discoveries (`server/services/userService.js`).

## osu! / pool
- `OSU` cache TTL, seed pages, rate-limit delay. Seed mock pool: `node scripts/seedMockPlayers.js`. Seed from rankings (needs creds): `POST /api/admin/seed-rankings?pages=N`.

## Server-side authority
- Rolls, luck, inventory changes, quest/milestone rewards, and stats are computed and persisted on the server with DB transactions. Client displays results only.
