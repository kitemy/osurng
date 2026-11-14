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
- `OSU` cache TTL, seed pages, rate-limit delay. Real rankings seeding is limited by osu! API; use more pages for a larger *real* pool, but very large pools are impractical via rankings alone.
- Seed mock/synthetic pool (scales to 1,000,000+): `node scripts/seedMockPlayers.js [targetCount]` (e.g. `node scripts/seedMockPlayers.js 1000000`, or `SEED_TARGET`/`SEED_BATCH` env vars). Generates synthetic players (IDs 1,000,001+) with rank/pp/rarity bands. Inserting 1M rows can take significant time and DB storage; run against your production DB (`DATABASE_URL`) and ensure adequate resources.
- Seed from rankings (needs creds, real osu! users): `POST /api/admin/seed-rankings?pages=N` with `x-admin-secret`. Successful real seeding removes mock placeholder players (synthetic ID range) and their related feed/roll/collection rows.
- Backfill missing rank/pp for real players: `POST /api/admin/backfill-stats?limit=N` or `node scripts/backfillPlayerStats.js [limit]` (repeat until complete).

## Profiles / links
- Leaderboard entries and global discovery feed items link to osu! profiles (`https://osu.ppy.sh/users/<osu_user_id>`). Feed includes both discovering user and discovered player links. Roll and collection already link to player profiles.
