const express = require("express");
const pool = require("./config/db");
require("dotenv").config();

const adminRoutes = require("./routes/admin");
const parentRoutes = require("./routes/parent");
const permissionRoutes = require("./routes/permission");
const planRoutes = require("./routes/plan");
const rolePermissionRoutes = require("./routes/rolePermission");
const schoolRoutes = require("./routes/school");
const schoolStaffRoutes = require("./routes/schoolStaff");
const supervisorRoutes = require("./routes/supervisor");

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

app.use("/api/admin", adminRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/permission", permissionRoutes);
app.use("/api/plan", planRoutes);
app.use("/api/role-permission", rolePermissionRoutes);
app.use("/api/school", schoolRoutes);
app.use("/api/school-staff", schoolStaffRoutes);
app.use("/api/supervisor", supervisorRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
