const pool = require("./db");

async function dropAll() {
  try {
    console.log("Dropping all tables and sequences...");

    await pool.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
    `);

    console.log("All tables dropped successfully.");
  } catch (err) {
    console.error("Drop failed:", err);
  } finally {
    await pool.end();
  }
}

dropAll();
