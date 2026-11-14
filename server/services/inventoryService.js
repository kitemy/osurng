'use strict';
const { query, queryOne, transaction } = require('../db');
const { PERMANENT_ITEMS, TEMPORARY_ITEMS } = require('../../config/gameConfig');
const { computeFinalLuck } = require('./rarityService');

async function getEquippedPermanent(userId) {
  const row = await queryOne(`SELECT item_id FROM inventory_items WHERE user_id=? AND item_type='permanent' AND is_equipped=1 LIMIT 1`, [userId]);
  if (!row) return null;
  return PERMANENT_ITEMS[row.item_id] || null;
}

async function getActiveTemporaryMultiplier(userId) {
  const now = new Date().toISOString();
  await query(`DELETE FROM active_effects WHERE user_id=? AND expires_at <= ?`, [userId, now]);
  const row = await queryOne(`SELECT multiplier, expires_at, item_id FROM active_effects WHERE user_id=? ORDER BY expires_at DESC LIMIT 1`, [userId]);
  return row ? { multiplier: Number(row.multiplier), expiresAt: row.expires_at, itemId: row.item_id } : null;
}

async function getUserLuck(userId) {
  const perm = await getEquippedPermanent(userId);
  const temp = await getActiveTemporaryMultiplier(userId);
  const permanentBonus = perm ? perm.bonus : 0;
  const temporaryMultiplier = temp ? temp.multiplier : 1;
  const finalLuck = computeFinalLuck({ permanentBonus, temporaryMultiplier });
  return {
    baseLuck: 1.0,
    permanentBonus,
    temporaryMultiplier,
    finalLuck,
    equippedPermanent: perm ? { id: perm.id, name: perm.name, bonus: perm.bonus } : null,
    activeTemporary: temp,
  };
}

async function ensureInventoryRow(db, userId, itemId, itemType) {
  await db.query(`INSERT INTO inventory_items (user_id,item_id,item_type,quantity,is_equipped) VALUES (?,?,?,?,0) ON CONFLICT (user_id,item_id,item_type) DO NOTHING`, [userId, itemId, itemType, 0]);
}

async function grantItem(userId, itemId, itemType, quantity = 1) {
  return transaction(async (db) => {
    await ensureInventoryRow(db, userId, itemId, itemType);
    await db.query(`UPDATE inventory_items SET quantity = quantity + ? WHERE user_id=? AND item_id=? AND item_type=?`, [quantity, userId, itemId, itemType]);
    return getInventoryTx(db, userId);
  });
}

async function getInventoryTx(db, userId) {
  const items = await db.query(`SELECT item_id,item_type,quantity,is_equipped FROM inventory_items WHERE user_id=? ORDER BY item_type,item_id`, [userId]);
  const enriched = (items || []).map(it => {
    const def = it.item_type === 'permanent' ? PERMANENT_ITEMS[it.item_id] : TEMPORARY_ITEMS[it.item_id];
    return { ...it, quantity: Number(it.quantity||0), is_equipped: !!Number(it.is_equipped), definition: def || null };
  }).filter(i => i.definition);
  const luck = await getUserLuckTx(db, userId);
  return { items: enriched, definitions: { permanent: PERMANENT_ITEMS, temporary: TEMPORARY_ITEMS }, luck };
}

async function getUserLuckTx(db, userId) {
  const permRow = await db.queryOne(`SELECT item_id FROM inventory_items WHERE user_id=? AND item_type='permanent' AND is_equipped=1 LIMIT 1`, [userId]);
  const perm = permRow ? (PERMANENT_ITEMS[permRow.item_id] || null) : null;
  const now = new Date().toISOString();
  await db.query(`DELETE FROM active_effects WHERE user_id=? AND expires_at <= ?`, [userId, now]);
  const temp = await db.queryOne(`SELECT multiplier, expires_at, item_id FROM active_effects WHERE user_id=? ORDER BY expires_at DESC LIMIT 1`, [userId]);
  const permanentBonus = perm ? perm.bonus : 0;
  const temporaryMultiplier = temp ? Number(temp.multiplier) : 1;
  const finalLuck = computeFinalLuck({ permanentBonus, temporaryMultiplier });
  return {
    baseLuck: 1.0, permanentBonus, temporaryMultiplier, finalLuck,
    equippedPermanent: perm ? { id: perm.id, name: perm.name, bonus: perm.bonus } : null,
    activeTemporary: temp ? { multiplier: Number(temp.multiplier), expiresAt: temp.expires_at, itemId: temp.item_id } : null,
  };
}

async function equipPermanent(userId, itemId) {
  const def = PERMANENT_ITEMS[itemId];
  if (!def) throw new Error('Unknown permanent item');
  return transaction(async (db) => {
    const row = await db.queryOne(`SELECT quantity FROM inventory_items WHERE user_id=? AND item_id=? AND item_type='permanent'`, [userId, itemId]);
    if (!row || Number(row.quantity) <= 0) throw new Error('Item not owned');
    await db.query(`UPDATE inventory_items SET is_equipped=0 WHERE user_id=? AND item_type='permanent'`, [userId]);
    await db.query(`UPDATE inventory_items SET is_equipped=1 WHERE user_id=? AND item_id=? AND item_type='permanent'`, [userId, itemId]);
    return getInventoryTx(db, userId);
  });
}

async function unequipPermanent(userId) {
  return transaction(async (db) => {
    await db.query(`UPDATE inventory_items SET is_equipped=0 WHERE user_id=? AND item_type='permanent'`, [userId]);
    return getInventoryTx(db, userId);
  });
}

async function activateTemporary(userId, itemId) {
  const def = TEMPORARY_ITEMS[itemId];
  if (!def) throw new Error('Unknown temporary item');
  return transaction(async (db) => {
    const row = await db.queryOne(`SELECT quantity FROM inventory_items WHERE user_id=? AND item_id=? AND item_type='temporary'`, [userId, itemId]);
    if (!row || Number(row.quantity) <= 0) throw new Error('No items available');
    await db.query(`UPDATE inventory_items SET quantity = quantity - 1 WHERE user_id=? AND item_id=? AND item_type='temporary'`, [userId, itemId]);
    const now = Date.now();
    const expiresAt = new Date(now + def.durationMs).toISOString();
    if (!def.stackable) {
      await db.query(`DELETE FROM active_effects WHERE user_id=? AND item_id=?`, [userId, itemId]);
    }
    await db.query(`INSERT INTO active_effects (user_id,effect_type,item_id,multiplier,expires_at) VALUES (?,?,?,?,?)`,
      [userId, 'luck', itemId, def.multiplier, expiresAt]);
    return { activated: true, itemId, expiresAt, inventory: await getInventoryTx(db, userId), luck: await getUserLuckTx(db, userId) };
  });
}

async function getInventory(userId) {
  const items = await query(`SELECT item_id,item_type,quantity,is_equipped FROM inventory_items WHERE user_id=? ORDER BY item_type,item_id`, [userId]);
  const enriched = (items || []).map(it => {
    const def = it.item_type === 'permanent' ? PERMANENT_ITEMS[it.item_id] : TEMPORARY_ITEMS[it.item_id];
    return { ...it, quantity: Number(it.quantity||0), is_equipped: !!Number(it.is_equipped), definition: def || null };
  }).filter(i => i.definition);
  return { items: enriched, definitions: { permanent: PERMANENT_ITEMS, temporary: TEMPORARY_ITEMS }, luck: await getUserLuck(userId) };
}

module.exports = { getUserLuck, getInventory, grantItem, equipPermanent, unequipPermanent, activateTemporary, getEquippedPermanent, getActiveTemporaryMultiplier };
