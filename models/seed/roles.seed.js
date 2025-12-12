const pool = require("../../config/db");

const roles = [
  {
    name: "super_admin",
    description: "Full unrestricted access to the entire system.",
  },
  {
    name: "admin",
    description:
      "Manage platform-level settings, plans, and high-level configurations.",
  },
  {
    name: "school_admin",
    description: "Manages all operations within a specific school.",
  },

  {
    name: "parent_manager",
    description: "Can manage parent accounts within the school.",
  },
  {
    name: "student_manager",
    description: "Can manage student records and assignments.",
  },
  {
    name: "supervisor_manager",
    description: "Can manage supervisors and their assignments.",
  },
  {
    name: "driver_manager",
    description: "Can manage driver records for school buses.",
  },
  { name: "bus_manager", description: "Can manage buses and bus assignments." },
  {
    name: "attendance_manager",
    description: "Can manage and review attendance records.",
  },
  {
    name: "location_monitor",
    description: "Can view real-time bus location data only.",
  },
  {
    name: "notification_manager",
    description: "Can create and send notifications.",
  },
  {
    name: "school_staff_manager",
    description: "Can assign system roles to school staff.",
  },
  {
    name: "role_permission_manager",
    description: "Can manage roles and permissions within the school.",
  },
  { name: "plan_manager", description: "Can manage subscription plans." },

  {
    name: "parent",
    description:
      "Parent end-user. Can view child information and receive updates.",
  },
  { name: "student", description: "Student end-user account." },
  {
    name: "supervisor",
    description: "Supervisor responsible for bus attendance and reporting.",
  },
  {
    name: "driver",
    description:
      "Driver responsible for operating the bus and updating its location.",
  },
];

async function seedRoles() {
  try {
    for (const role of roles) {
      await pool.query(
        `INSERT INTO Role (name, description) VALUES ($1, $2)
         ON CONFLICT (name) DO NOTHING`,
        [role.name, role.description]
      );
    }

    console.log("✅ Roles seeded successfully.");
    process.exit();
  } catch (error) {
    console.error("❌ Error seeding roles:", error.message);
    process.exit(1);
  }
}

seedRoles();
