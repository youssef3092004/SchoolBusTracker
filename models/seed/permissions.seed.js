const pool = require("../../config/db");

const permissions = [
  // Admin
  "create_admin",
  "update_admin",
  "view_admin",
  "view_all_admins",
  "delete_admin",
  "delete_all_admins",

  // Attendance
  "create_attendance",
  "view_all_attendance",
  "view_attendance",
  "update_attendance",
  "delete_attendance",
  "delete_all_attendance",
  "view_attendance_by_student",
  "view_attendance_by_date",
  "view_attendance_summary",

  // Bus
  "create_bus",
  "view_all_buses",
  "view_bus",
  "update_bus",
  "delete_bus",
  "delete_all_buses",
  "view_buses_by_school",
  "view_buses_by_supervisor",

  // Bus Assignment
  "create_bus_assignment",
  "view_all_bus_assignments",
  "view_bus_assignment",
  "update_bus_assignment",
  "delete_bus_assignment",
  "delete_all_bus_assignments",
  "view_assignments_by_supervisor",
  "view_assignments_by_student",

  // Bus Location
  "create_bus_location",
  "view_all_bus_locations",
  "view_bus_location",
  "view_locations_by_bus",
  "update_bus_location",
  "delete_bus_location",
  "delete_all_bus_locations",

  // Driver
  "create_driver",
  "view_all_drivers",
  "view_driver",
  "update_driver",
  "delete_driver",
  "delete_all_drivers",

  // Emergency Contact
  "create_emergency_contact",
  "view_all_emergency_contacts",
  "view_emergency_contact",
  "update_emergency_contact",
  "delete_emergency_contact",
  "delete_all_emergency_contacts",

  // Notification
  "create_notification",
  "view_notification",
  "view_all_notifications",
  "update_notification",
  "delete_notification",
  "delete_all_notifications",

  // Parent
  "create_parent",
  "update_parent",
  "view_parent",
  "view_all_parents",
  "delete_parent",
  "delete_all_parents",

  // Permission
  "create_permission",
  "view_permission",
  "view_all_permissions",
  "update_permission",
  "delete_permission",
  "delete_all_permissions",

  // Plan
  "create_plan",
  "view_plan",
  "view_all_plans",
  "update_plan",
  "delete_plan",
  "delete_all_plans",

  // Role
  "create_role",
  "view_all_roles",
  "view_role",
  "delete_role",
  "delete_all_roles",

  // Permission Role
  "create_permission_role",
  "view_permission_role",
  "view_all_permission_roles",
  "update_permission_role",
  "delete_permission_role",
  "delete_all_permission_roles",
  "delete_all_role_permissions",

  // School
  "create_school",
  "update_school",
  "view_school",
  "view_all_schools",
  "delete_school",
  "delete_all_schools",

  // School Staff
  "create_school_staff",
  "view_school_staff",
  "view_all_school_staff",
  "update_school_staff",
  "delete_school_staff",
  "delete_all_school_staff",

  // Student
  "create_student",
  "view_student",
  "view_all_students",
  "update_student",
  "delete_student",
  "delete_all_students",

  // Supervisor
  "create_supervisor",
  "update_supervisor",
  "view_supervisor",
  "view_all_supervisors",
  "delete_supervisor",
  "delete_all_supervisors",
];

async function seedPermissions() {
  try {
    for (const permission of permissions) {
      await pool.query(
        `INSERT INTO Permission (name, description) VALUES ($1, $2)
         ON CONFLICT (name) DO NOTHING`,
        [permission, `Permission: ${permission.replace(/_/g, " ")}`]
      );
    }

    console.log("✅ Permissions seeded successfully.");
    process.exit();
  } catch (err) {
    console.error("❌ Error seeding permissions:", err.message);
    process.exit(1);
  }
}

seedPermissions();
