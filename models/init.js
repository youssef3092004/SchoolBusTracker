require("dotenv").config();
const pool = require("../config/db");

const createEnums = require("./enums");
const createFunctions = require("./functions");

const createPermissionTable = require("./tables/permission");
const createRolePermissionTable = require("./tables/rolePermission");
const createPlanTable = require("./tables/plan");

const createAdminTable = require("./tables/admin");
const createSchoolTable = require("./tables/school");
const createSchoolStaffTable = require("./tables/schoolStaff");

const createSupervisorTable = require("./tables/supervisor");
const createDriverTable = require("./tables/driver");
const createParentTable = require("./tables/parent");
const createStudentTable = require("./tables/student");
const createBusTable = require("./tables/bus");
const createBusAssignmentTable = require("./tables/busAssignment");
const createBusLocationTable = require("./tables/busLocation");
const createEmergencyContactTable = require("./tables/emergencyContact");
const createAttendanceTable = require("./tables/attendance");
const createNotificationTable = require("./tables/notification");
const createBlackList = require("./tables/blackList");

async function initDB() {
  try {
    console.log("Starting database initialization...\n");

    await createEnums();
    console.log("Enums created.");

    await createFunctions();
    console.log("Functions created.\n");

    await createPermissionTable();
    console.log("Permission table created.");

    await createRolePermissionTable();
    console.log("RolePermission table created.");

    await createPlanTable();
    console.log("Plan table created.\n");

    await createSchoolTable();
    console.log("School table created.");

    await createSchoolStaffTable();
    console.log("SchoolStaff table created.");

    await createAdminTable();
    console.log("Admin table created.\n");

    await createSupervisorTable();
    console.log("Supervisor table created.");

    await createDriverTable();
    console.log("Driver table created.");

    await createParentTable();
    console.log("Parent table created.");

    await createStudentTable();
    console.log("Student table created.\n");

    await createBusTable();
    console.log("Bus table created.");

    await createBusAssignmentTable();
    console.log("BusAssignment table created.");

    await createBusLocationTable();
    console.log("BusLocation table created.");

    await createEmergencyContactTable();
    console.log("EmergencyContact table created.");

    await createAttendanceTable();
    console.log("Attendance table created.");

    await createNotificationTable();
    console.log("Notification table created.\n");

    await createBlackList();
    console.log("BlackList table created.\n");

    console.log("Database initialized successfully!");
  } catch (err) {
    console.error("Error initializing database:");
    console.error(err);
  } finally {
    await pool.end();
    console.log("Database connection closed.");
  }
}

initDB();
