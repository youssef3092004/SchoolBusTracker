const pool = require("../../config/db");

async function createBlackList() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS BlackList (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      token TEXT NOT NULL,
      expired_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_blacklist_token ON BlackList(token);
  `);
}

module.exports = createBlackList;
