const pool = require("../config/db");

/**
 * @route POST /api/v1/school-usage/:school_id
 * @desc Create a SchoolUsage record for a specific school. Only admins can perform this action.
 *
 * @access Private (Admin)
 *
 * @param {string} school_id - The ID of the school to create the usage record for (from URL params)
 *
 * @returns {Object} 201 - Success response confirming creation
 * @returns {boolean} success - Indicates whether the creation was successful
 * @returns {string} message - Description of the creation result
 * @returns {Object} schoolUsage - The newly created SchoolUsage record
 *
 * @throws {403} If the requesting user is not an admin
 * @throws {404} If the school with the provided ID is not found
 * @throws {400} If a SchoolUsage record already exists for the specified school
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint performs the following steps:
 * 1. Checks that the requesting user has the "admin" role.
 * 2. Verifies that the specified school exists in the database.
 * 3. Checks if a SchoolUsage record already exists for that school.
 * 4. Creates a new SchoolUsage record if it does not already exist.
 * 5. Returns the created SchoolUsage object in the response.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "SchoolUsage record created successfully",
 *   "schoolUsage": {
 *     "id": "uuid",
 *     "school_id": "uuid",
 *     "students_count": 0,
 *     "parents_count": 0,
 *     "supervisors_count": 0,
 *     "schoolStaff_count": 0,
 *     "created_at": "2025-12-07T18:00:00.000Z",
 *     "updated_at": "2025-12-07T18:00:00.000Z"
 *   }
 * }
 *
 * Example error response (record already exists):
 * {
 *   "success": false,
 *   "message": "SchoolUsage record already exists for this school"
 * }
 */

const createSchoolUsage = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only admins can create school usage records",
      });
    }
    const { school_id } = req.params;
    const schoolExists = await pool.query(
      "SELECT * FROM School WHERE id = $1",
      [school_id]
    );
    if (schoolExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }
    const usageExists = await pool.query(
      "SELECT * FROM SchoolUsage WHERE school_id = $1",
      [school_id]
    );
    if (usageExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "SchoolUsage record already exists for this school",
      });
    }
    const newUsage = await pool.query(
      "INSERT INTO SchoolUsage (school_id) VALUES ($1) RETURNING *",
      [school_id]
    );
    return res.status(201).json({
      success: true,
      message: "SchoolUsage record created successfully",
      schoolUsage: newUsage.rows[0],
    });
  } catch (error) {
    console.error("Error creating SchoolUsage record:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route GET /api/v1/school-usage/:school_id
 * @desc Fetch the SchoolUsage record for a specific school. Only admins can access this endpoint.
 *
 * @access Private (Admin)
 *
 * @param {string} school_id - The ID of the school to fetch the usage record for (from URL params)
 *
 * @returns {Object} 200 - Success response with the SchoolUsage record
 * @returns {boolean} success - Indicates whether the request was successful
 * @returns {Object} schoolUsage - The SchoolUsage record for the specified school
 *
 * @throws {403} If the requesting user is not an admin
 * @throws {404} If a SchoolUsage record is not found for the specified school
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint performs the following steps:
 * 1. Verifies that the requesting user has the "admin" role.
 * 2. Queries the database for the SchoolUsage record associated with the given school ID.
 * 3. Returns the record if found, or a 404 error if not found.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "schoolUsage": {
 *     "id": "uuid",
 *     "school_id": "uuid",
 *     "students_count": 10,
 *     "parents_count": 8,
 *     "supervisors_count": 2,
 *     "schoolStaff_count": 3,
 *     "created_at": "2025-12-07T18:00:00.000Z",
 *     "updated_at": "2025-12-07T18:00:00.000Z"
 *   }
 * }
 *
 * Example error response (not found):
 * {
 *   "success": false,
 *   "message": "SchoolUsage record not found for this school"
 * }
 */

const getSchoolUsage = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only admins can create school usage records",
      });
    }
    const { school_id } = req.params;
    const usage = await pool.query(
      "SELECT * FROM SchoolUsage WHERE school_id = $1",
      [school_id]
    );
    if (usage.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "SchoolUsage record not found for this school",
      });
    }
    return res.status(200).json({
      success: true,
      schoolUsage: usage.rows[0],
    });
  } catch (error) {
    console.error("Error fetching SchoolUsage record:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route GET /api/v1/school-usage/:school_id
 * @desc Fetch a specific SchoolUsage record by school ID. Only admins can access this endpoint.
 *
 * @access Private (Admin)
 *
 * @param {string} school_id - The ID of the school to fetch the SchoolUsage record for (from URL params)
 *
 * @returns {Object} 200 - Success response containing the SchoolUsage record
 * @returns {boolean} success - Indicates whether the request was successful
 * @returns {Object} schoolUsage - The SchoolUsage record for the specified school
 *
 * @throws {403} If the requesting user is not an admin
 * @throws {404} If a SchoolUsage record is not found for the specified school
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint performs the following steps:
 * 1. Checks that the requesting user has the "admin" role.
 * 2. Queries the database for the SchoolUsage record associated with the provided school ID.
 * 3. Returns the record if found; otherwise, returns a 404 error.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "schoolUsage": {
 *     "id": "uuid",
 *     "school_id": "uuid",
 *     "students_count": 15,
 *     "parents_count": 12,
 *     "supervisors_count": 3,
 *     "schoolStaff_count": 4,
 *     "created_at": "2025-12-07T18:00:00.000Z",
 *     "updated_at": "2025-12-07T18:00:00.000Z"
 *   }
 * }
 *
 * Example error response (not found):
 * {
 *   "success": false,
 *   "message": "SchoolUsage record not found for this school"
 * }
 */

const getSchoolUsageById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only admins can create school usage records",
      });
    }
    const { school_id } = req.params;
    const usage = await pool.query(
      "SELECT * FROM SchoolUsage WHERE school_id = $1",
      [school_id]
    );
    if (usage.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "SchoolUsage record not found for this school",
      });
    }
    return res.status(200).json({
      success: true,
      schoolUsage: usage.rows[0],
    });
  } catch (error) {
    console.error("Error fetching SchoolUsage by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route DELETE /api/v1/school-usage/:school_id
 * @desc Delete a specific SchoolUsage record by school ID. Only admins can perform this action.
 *
 * @access Private (Admin)
 *
 * @param {string} school_id - The ID of the school whose SchoolUsage record will be deleted (from URL params)
 *
 * @returns {Object} 200 - Success response confirming deletion
 * @returns {boolean} success - Indicates whether the deletion was processed
 * @returns {string} message - Description of the deletion result
 *
 * @throws {403} If the requesting user is not an admin
 * @throws {404} If the SchoolUsage record for the provided school ID is not found
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint performs the following steps:
 * 1. Checks that the requesting user has the "admin" role.
 * 2. Queries the database to verify that a SchoolUsage record exists for the given school ID.
 * 3. Deletes the SchoolUsage record if it exists.
 * 4. Returns a success message confirming the deletion.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "SchoolUsage record deleted successfully"
 * }
 *
 * Example error response (not found):
 * {
 *   "success": false,
 *   "message": "SchoolUsage record not found for this school"
 * }
 */

const deleteSchoolUsageById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only admins can delete school usage records",
      });
    }
    const { school_id } = req.params;
    const usage = await pool.query(
      "SELECT * FROM SchoolUsage WHERE school_id = $1",
      [school_id]
    );
    if (usage.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "SchoolUsage record not found for this school",
      });
    }
    await pool.query("DELETE FROM SchoolUsage WHERE school_id = $1", [
      school_id,
    ]);
    return res.status(200).json({
      success: true,
      message: "SchoolUsage record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting SchoolUsage record:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route DELETE /api/v1/school-usage
 * @desc Delete all SchoolUsage records from the database. Only admins can perform this action.
 *
 * @access Private (Admin)
 *
 * @returns {Object} 200 - Success response confirming deletion of all records
 * @returns {boolean} success - Indicates whether the deletion was processed
 * @returns {string} message - Description of the deletion result
 * @returns {number} count - Number of SchoolUsage records deleted
 *
 * @throws {403} If the requesting user is not an admin
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint performs the following steps:
 * 1. Checks that the requesting user has the "admin" role.
 * 2. Deletes all SchoolUsage records from the database.
 * 3. Returns a success message along with the number of deleted records.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "All SchoolUsage records deleted successfully",
 *   "count": 15
 * }
 */

const deleteAllSchoolUsage = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only admins can delete school usage records",
      });
    }
    const result = await pool.query("DELETE FROM SchoolUsage");
    return res.status(200).json({
      success: true,
      message: "All SchoolUsage records deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all SchoolUsage records:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createSchoolUsage,
  getSchoolUsage,
  getSchoolUsageById,
  deleteSchoolUsageById,
  deleteAllSchoolUsage,
};
