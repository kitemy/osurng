'use strict';
/**
 * Centralized game configuration for osu! RNG.
 * Adjust balance here without changing core logic. All probabilities are normalized at runtime.
 */

const RARITIES = [
  { id: 'common',    name: 'Common',    color: '#9ca3af', order: 0, weight: 65.0,  feed: false, announce: false },
  { id: 'uncommon',  name: 'Uncommon',  color: '#22c55e', order: 1, weight: 22.0,  feed: false, announce: false },
  { id: 'rare',      name: 'Rare',      color: '#3b82f6', order: 2, weight: 9.0,   feed: 'optional', announce: false },
  { id: 'epic',      name: 'Epic',      color: '#a855f7', order: 3, weight: 3.0,   feed: true,  announce: false },
  { id: 'legendary', name: 'Legendary', color: '#f59e0b', order: 4, weight: 0.8,   feed: true,  announce: 'special' },
  { id: 'mythic',    name: 'Mythic',    color: '#ef4444', order: 5, weight: 0.19,  feed: true,  announce: 'major' },
  { id: 'secret',    name: 'Secret',    color: '#e879f9', order: 6, weight: 0.01,  feed: true,  announce: 'major' },
];

/**
 * Determine rarity from osu! player stats.
 * Primary: global rank (lower is better). Secondary: pp.
 * Thresholds are evaluated top-down (highest rarity first).
 * rank: null/undefined means unranked/inactive -> treated as very low.
 */
const RARITY_THRESHOLDS = [
  { id: 'secret',    maxRank: 10,        minPP: 12000 },
  { id: 'mythic',    maxRank: 100,       minPP: 9000  },
  { id: 'legendary', maxRank: 1000,      minPP: 7000  },
  { id: 'epic',      maxRank: 10000,     minPP: 4500  },
  { id: 'rare',      maxRank: 50000,     minPP: 2500  },
  { id: 'uncommon',  maxRank: 250000,    minPP: 1000  },
  { id: 'common',    maxRank: Infinity,  minPP: 0     },
];

function getRarityById(id) { return RARITIES.find(r => r.id === id) || RARITIES[0]; }
function getRarityOrder(id) { return getRarityById(id).order; }

/** Luck config - all multipliers are factors applied to higher-rarity odds then renormalized */
const LUCK = {
  baseLuck: 1.0,
  maxFinalLuck: 10.0, // cap to prevent extreme stacking
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
  includeRarities: ['epic', 'legendary', 'mythic', 'secret'], // rare optional via UI filter/config
  optionalRarities: ['rare'],
  pollIntervalMs: 5000,
  maxItems: 50,
};

const OSU = {
  cacheTtlMs: 6 * 60 * 60 * 1000, // 6h player cache
  playerFetchLimit: 50,            // per API page
  seedPages: 10,                   // pages to seed from rankings on startup/refresh
  rateLimitDelayMs: 1200,          // polite spacing between API calls
};

module.exports = {
  RARITIES, RARITY_THRESHOLDS, LUCK, TEMPORARY_ITEMS, PERMANENT_ITEMS,
  ROLLING, MILESTONES, DAILY_QUESTS, FEED, OSU,
  getRarityById, getRarityOrder,
};
