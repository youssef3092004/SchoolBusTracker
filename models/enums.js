const pool = require("../config/db");

async function createEnums() {
  await pool.query(`
    DO $$ BEGIN
      CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);

  await pool.query(`
    DO $$ BEGIN
      CREATE TYPE notification_status AS ENUM (
        'bus_departure', 'bus_arrival', 'child_boarding', 'delay', 'absence_reported'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);

  await pool.query(`
    DO $$ BEGIN
      CREATE TYPE bus_status AS ENUM ('active', 'inactive');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
}

module.exports = createEnums;
