'use strict';
/**
 * Centralized game configuration for osu! RNG.
 * Adjust balance here without changing core logic. All probabilities are normalized at runtime.
 */

const RARITIES = [
  { id: 'common',       name: 'Common',       color: '#9ca3af', order: 0, weight: 60.0,   feed: false, announce: false },
  { id: 'uncommon',     name: 'Uncommon',     color: '#22c55e', order: 1, weight: 22.0,   feed: false, announce: false },
  { id: 'rare',         name: 'Rare',         color: '#3b82f6', order: 2, weight: 10.0,   feed: false, announce: false },
  { id: 'epic',         name: 'Epic',         color: '#a855f7', order: 3, weight: 5.0,    feed: false, announce: false },
  { id: 'mythic',       name: 'Mythic',       color: '#ef4444', order: 4, weight: 2.0,    feed: true,  announce: 'special' },
  { id: 'legendary',    name: 'Legendary',    color: '#f59e0b', order: 5, weight: 0.7,    feed: true,  announce: 'special' },
  { id: 'exalted',      name: 'Exalted',      color: '#f97316', order: 6, weight: 0.2,    feed: true,  announce: 'major' },
  { id: 'glorious',     name: 'Glorious',     color: '#eab308', order: 7, weight: 0.07,   feed: true,  announce: 'major' },
  { id: 'transcendant', name: 'Transcendant', color: '#67e8f9', order: 8, weight: 0.02,   feed: true,  announce: 'major' },
  { id: 'dimensional',  name: 'Dimensional',  color: '#f472b6', order: 9, weight: 0.01,   feed: true,  announce: 'major' },
];

/**
 * Determine rarity from osu! player PP ONLY (rank is ignored).
 * PP cutoffs correspond to approximate PP at ranks 1/10/100/500/1000/5000/10000/25k/100k.
 * Thresholds evaluated top-down (highest first): pp >= minPP => that tier.
 * Values are configurable to match current osu! meta.
 */
const RARITY_PP_THRESHOLDS = {
  dimensional:  31000, // ~rank 1
  transcendant: 26000, // ~rank 10
  glorious:     22000, // ~rank 100
  exalted:      18500, // ~rank 500
  legendary:    16500, // ~rank 1000
  mythic:       12500, // ~rank 5000
  epic:         10500, // ~rank 10000
  rare:          8200, // ~rank 25000
  uncommon:      4500, // ~rank 100000
  common:           0, // 100k+
};

// Back-compat export name (shape no longer used for rank; kept to avoid breaking imports)
const RARITY_THRESHOLDS = RARITY_PP_THRESHOLDS;

function getRarityById(id) { return RARITIES.find(r => r.id === id) || RARITIES[0]; }
function getRarityOrder(id) { return getRarityById(id).order; }

/** Luck config - all multipliers are factors applied to higher-rarity odds then renormalized */
const LUCK = {
  baseLuck: 1.0,
  // Luck shifts probability mass toward rarer tiers. Formula in luck service.
  rarityBiasExponent: 0.85, // higher = luck benefits top rarities more
};

const TEMPORARY_ITEMS = {
  luck_clover: {
    id: 'luck_clover',
    name: 'Luck Clover',
    type: 'temporary',
    description: 'Doubles your current luck for a limited time.',
    multiplier: 2.0,
    durationMs: 15 * 60 * 1000, // 15 minutes
    stackable: false, // activating again refreshes duration, does not stack multipliers
  },
};

const PERMANENT_ITEMS = {
  lucky_charm: {
    id: 'lucky_charm', name: 'Lucky Charm', type: 'permanent',
    description: '+20% luck while equipped.', bonus: 0.20,
    unlock: { type: 'rolls', value: 500 },
  },
  golden_clover: {
    id: 'golden_clover', name: 'Golden Clover', type: 'permanent',
    description: '+50% luck while equipped.', bonus: 0.50,
    unlock: { type: 'rolls', value: 2500 },
  },
  premium_charm: {
    id: 'premium_charm', name: 'Premium Charm', type: 'permanent',
    description: '+100% luck while equipped.', bonus: 1.00,
    unlock: { type: 'rolls', value: 10000 },
  },
};

const ROLLING = {
  normal: { animationMs: 3500, unlockRolls: 0 },
  auto:   { animationMs: 0,    unlockRolls: 250 },
  quick:  { animationMs: 700,  unlockRolls: 5000 },
  rollCooldownMs: 250, // anti-spam; server-enforced
  maxAutoBatch: 100,   // max rolls per auto-roll request chunk
};

const MILESTONES = [
  { rolls: 100,   rewards: [{ type: 'item', itemId: 'luck_clover', itemType: 'temporary', quantity: 1 }] },
  { rolls: 500,   rewards: [{ type: 'item', itemId: 'lucky_charm',  itemType: 'permanent', quantity: 1 }] },
  { rolls: 1000,  rewards: [{ type: 'item', itemId: 'luck_clover', itemType: 'temporary', quantity: 2 }] },
  { rolls: 2500,  rewards: [{ type: 'item', itemId: 'golden_clover', itemType: 'permanent', quantity: 1 }] },
  { rolls: 5000,  rewards: [{ type: 'item', itemId: 'luck_clover', itemType: 'temporary', quantity: 3 }] },
  { rolls: 10000, rewards: [{ type: 'item', itemId: 'premium_charm', itemType: 'permanent', quantity: 1 }] },
  { rolls: 50000, rewards: [{ type: 'item', itemId: 'luck_clover', itemType: 'temporary', quantity: 10 }] },
];

const DAILY_QUESTS = [
  { id: 'roll_100',    description: 'Perform 100 rolls',        type: 'rolls',            target: 100,  rewards: [{ type: 'item', itemId: 'luck_clover', itemType: 'temporary', quantity: 1 }] },
  { id: 'roll_500',    description: 'Perform 500 rolls',        type: 'rolls',            target: 500,  rewards: [{ type: 'item', itemId: 'luck_clover', itemType: 'temporary', quantity: 2 }] },
  { id: 'roll_1000',   description: 'Perform 1,000 rolls',      type: 'rolls',            target: 1000, rewards: [{ type: 'item', itemId: 'luck_clover', itemType: 'temporary', quantity: 3 }] },
  { id: 'unique_5',    description: 'Discover 5 unique players',type: 'unique_discoveries', target: 5,  rewards: [{ type: 'item', itemId: 'luck_clover', itemType: 'temporary', quantity: 1 }] },
  { id: 'rarity_epic', description: 'Discover an Epic player or higher', type: 'min_rarity', rarityId: 'epic', target: 1, rewards: [{ type: 'item', itemId: 'luck_clover', itemType: 'temporary', quantity: 2 }] },
];

const FEED = {
  // Global discovery feed only shows Mythic or higher
  includeRarities: ['mythic', 'legendary', 'exalted', 'glorious', 'transcendant', 'dimensional'],
  optionalRarities: [],
  pollIntervalMs: 5000,
  maxItems: 50,
};

const OSU = {
  cacheTtlMs: 6 * 60 * 60 * 1000, // 6h player cache
  playerFetchLimit: 50,            // per API page
  seedPages: 10,                   // pages to seed from rankings on startup/refresh
  rateLimitDelayMs: 1200,          // polite spacing between API calls
  // Large pool: osu! rankings API is limited; for very large pools (e.g. 1,000,000) use `node scripts/seedMockPlayers.js 1000000`.
  // Real osu! players are seeded via rankings; mock players use synthetic IDs (1,000,001+) and are removed when real ranking seed succeeds.
};

module.exports = {
  RARITIES, RARITY_THRESHOLDS, RARITY_PP_THRESHOLDS, LUCK, TEMPORARY_ITEMS, PERMANENT_ITEMS,
  ROLLING, MILESTONES, DAILY_QUESTS, FEED, OSU,
  getRarityById, getRarityOrder,
};
