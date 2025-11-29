require("dotenv").config();
const { Pool } = require("pg");

const isProd = process.env.NODE_ENV === "production";

let pool;

if (isProd) {
  //! Supabase (Vercel)
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  console.log("Using Supabase (production)");
} else {
  //! Local PostgreSQL (localhost)
  pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: false,
  });
  console.log("✅ Using Local PostgreSQL (development)");
}

pool
  .connect()
  .then(() => console.log("Connected to PostgreSQL successfully"))
  .catch((err) => console.error("Connection error:", err.message));

module.exports = pool;
