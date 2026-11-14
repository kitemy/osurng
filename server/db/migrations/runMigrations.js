'use strict';
(async () => {
  const { runMigrations } = require('./schema.sql.js');
  await runMigrations();
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
