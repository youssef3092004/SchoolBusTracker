const pool = require("../../config/db");

async function seedRolePermissions() {
  try {
    const { rows: roles } = await pool.query(`SELECT id, name FROM Role`);
    const { rows: perms } = await pool.query(`SELECT id, name FROM permission`);

    const adminRole = roles.find((r) => r.name === "admin");
    if (!adminRole) throw new Error("Admin role not found");

    for (const perm of perms) {
      await pool.query(
        `INSERT INTO RolePermission (role, permission_id, is_allowed)
         VALUES ($1, $2, true)`,
        [adminRole.id, perm.id]
      );
    }

    console.log("✅ Admin now has FULL access to all permissions.");
    process.exit();
  } catch (error) {
    console.error("❌ Error seeding role permissions:", error.message);
    process.exit(1);
  }
}

seedRolePermissions();
