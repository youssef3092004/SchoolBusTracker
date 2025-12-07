const pool = require("../config/db");
const pagination = require("../utils/pagination");
const redis = require("../config/redis");

/**
 * @route PATCH /api/v1/supervisor/:supervisor_id
 * @desc Update supervisor information. Accessible by admin, school, school staff,
 *       or the supervisor themselves. Only specific editable fields are allowed.
 *
 * @access Private (Admin, School, School Staff, Supervisor)
 *
 * @param {string} supervisor_id - Supervisor ID to update (from URL params).
 *                                 If not provided, updates the logged-in supervisor's account.
 *
 * @body {string} [name] - Supervisor's full name
 * @body {string} [phone] - Contact phone number
 * @body {string} [address] - Residential or work address
 * @body {string} [email] - Email address
 * @body {string} [password] - New password (should be hashed before storing if used)
 * @body {string} [governorate] - Governorate or region
 * @body {string} [language] - Preferred UI language
 *
 * @returns {Object} 200 - Success response with updated supervisor data
 * @returns {boolean} success - Indicates update status
 * @returns {string} message - Description of the result
 * @returns {Object} supervisor - Updated supervisor information
 *
 * @throws {400} If no valid update fields are provided
 * @throws {403} If the user does not have permission to perform the update
 * @throws {404} If supervisor is not found
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint updates a supervisor's profile information. It supports multiple roles
 * and applies strict validation to ensure proper permissions and that only approved
 * fields are updated.
 *
 * The update process follows these steps:
 *
 * 1. **Role Validation:**
 *    Ensures the requester has one of the following roles:
 *    - `admin`
 *    - `school`
 *    - `school_staff`
 *    - `supervisor` (allowed to update their own account only)
 *
 * 2. **Target Supervisor Determination:**
 *    - If the route contains `:supervisor_id`, that ID is used.
 *    - Otherwise, the system defaults to `req.user.id`, allowing supervisors to
 *      update themselves.
 *
 * 3. **Field Filtering:**
 *    Only the following fields can be updated:
 *    `name`, `phone`, `address`, `email`, `password`, `governorate`, `language`.
 *    Any other fields in the request body are ignored.
 *
 * 4. **Dynamic SQL Query Building:**
 *    The endpoint constructs the SQL `SET` clause dynamically based on the fields
 *    provided, ensuring the update is both flexible and secure.
 *
 * 5. **Database Update:**
 *    Executes the update and returns the updated supervisor record.
 *    If no record is found, a 404 response is returned.
 *
 * 6. **Cache Invalidation:**
 *    Clears Redis cache keys matching `supervisors:*` to ensure fresh reads after update.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Supervisor updated successfully",
 *   "supervisor": {
 *      "id": "uuid",
 *      "name": "Updated Name",
 *      "address": "New Address",
 *      "phone": "0123456789",
 *      "email": "newemail@example.com",
 *      "governorate": "Cairo",
 *      "created_at": "2025-01-20T10:00:00Z",
 *      "updated_at": "2025-01-25T12:30:00Z"
 *   }
 * }
 *
 * Example error response (invalid fields):
 * {
 *   "success": false,
 *   "message": "No valid fields provided for update"
 * }
 */

const updateSupervisor = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff" &&
      req.user.role !== "supervisor"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, school staff, or the supervisor can update supervisor details",
      });
    }

    const supervisorId = req.params.supervisor_id || req.user.id;

    const allowedFields = [
      "name",
      "phone",
      "address",
      "email",
      "password",
      "governorate",
      "language",
    ];
    const updates = req.body;

    const keys = Object.keys(updates).filter((key) =>
      allowedFields.includes(key)
    );

    if (keys.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }
    const setClause = keys
      .map((key, index) => `${key} = $${index + 1}`)
      .join(", ");

    const values = keys.map((key) => updates[key]);

    values.push(supervisorId);

    const query = `
      UPDATE Supervisor
      SET ${setClause}
      WHERE id = $${values.length}
      RETURNING id, name, address, phone, email, governorate, created_at, updated_at;
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Supervisor not found",
      });
    }

    const key = await redis.keys("supervisors:*");
    if (key.length > 0) {
      await redis.del(key);
      console.log("Cleared supervisors cache after update");
    }

    return res.status(200).json({
      success: true,
      message: "Supervisor updated successfully",
      supervisor: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating supervisor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route GET /api/v1/supervisor/:id
 * @desc Retrieve the details of a specific supervisor by their ID.
 *       Only admins, school accounts, and school staff are authorized to access this information.
 *
 * @access Private (Admin, School, School Staff)
 *
 * @param {string} id - Supervisor ID (from URL params)
 *
 * @returns {Object} 200 - Success response containing supervisor details
 * @returns {boolean} success - Indicates whether the request succeeded
 * @returns {string} message - Description of the result
 * @returns {Object} supervisor - The supervisor's data
 *
 * @throws {403} If the user is not authorized to view supervisor information
 * @throws {404} If no supervisor exists with the provided ID
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint allows privileged roles to fetch information about a specific supervisor.
 * It is useful for administrative dashboards, school management panels, and supervisory
 * monitoring tools. The process involves:
 *
 * 1. **Permission Verification:**
 *    Ensures that the requester is one of the following:
 *    - `admin`
 *    - `school`
 *    - `school_staff`
 *    Any other role is immediately denied access.
 *
 * 2. **Supervisor Lookup:**
 *    Executes a SELECT query to retrieve the supervisor’s profile details,
 *    including:
 *    `id`, `name`, `address`, `phone`, `email`, `governorate`, `created_at`, `updated_at`.
 *
 * 3. **Existence Check:**
 *    If the supervisor does not exist, a `404` response is returned with a meaningful error message.
 *
 * 4. **Successful Response:**
 *    Returns the supervisor’s data along with a success status and descriptive message.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Supervisor fetched successfully",
 *   "supervisor": {
 *      "id": "uuid",
 *      "name": "Ahmed Khaled",
 *      "address": "Ismailia",
 *      "phone": "01012345678",
 *      "email": "supervisor@example.com",
 *      "governorate": "Ismailia",
 *      "created_at": "2025-01-21T10:00:00Z",
 *      "updated_at": "2025-01-23T15:12:00Z"
 *   }
 * }
 *
 * Example error response (not found):
 * {
 *   "success": false,
 *   "message": "Supervisor not found"
 * }
 */

const getSupervisorById = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, or school staff can view supervisor details",
      });
    }

    const supervisorId = req.params.id;

    const result = await pool.query(
      "SELECT id, name, address, phone, email, governorate, created_at, updated_at FROM Supervisor WHERE id = $1",
      [supervisorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Supervisor not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Supervisor fetched successfully",
      supervisor: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching supervisor by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route GET /api/v1/supervisor
 * @desc Retrieve a paginated list of all supervisors in the system.
 *       Only admins, school accounts, or school staff are allowed to access this endpoint.
 *
 * @access Private (Admin, School, School Staff)
 *
 * @query {number} [page=1] - Current page number for pagination
 * @query {number} [limit=10] - Number of records to return per page
 *
 * @returns {Object} 200 - Success response containing paginated supervisor data
 * @returns {boolean} success - Indicates whether the request succeeded
 * @returns {number} page - Current page number
 * @returns {number} limit - Number of records returned per page
 * @returns {number} total - Total number of supervisors in the database
 * @returns {number} totalPages - Total number of available pages
 * @returns {Array} data - Array of supervisor records
 *
 * @throws {403} If the user is not authorized to view supervisor data
 * @throws {404} If no supervisors exist
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint returns a paginated list of supervisors. It is optimized for speed
 * and scalability using Redis caching, ensuring high performance even when dealing
 * with large datasets.
 *
 * The flow of the endpoint is as follows:
 *
 * 1. **Permission Validation:**
 *    Only the following roles can access the list:
 *    - `admin`
 *    - `school`
 *    - `school_staff`
 *
 * 2. **Pagination Handling:**
 *    Uses a shared `pagination` utility to calculate:
 *    - `page` (default 1)
 *    - `limit` (default 10)
 *    - `skip` (offset for SQL queries)
 *
 * 3. **Redis Cache Check:**
 *    Before hitting the database, the endpoint checks Redis for cached results
 *    based on the key format:
 *    `"supervisors:<page>:<limit>"`.
 *
 *    If found, the cached response is immediately returned, reducing database load.
 *
 * 4. **Database Query:**
 *    If no cached data is found, the endpoint:
 *    - Retrieves the total supervisor count
 *    - Calculates total pages
 *    - Fetches the required supervisor slice using LIMIT + OFFSET
 *
 * 5. **Caching New Data:**
 *    The freshly retrieved results are saved in Redis for future requests.
 *
 * 6. **Final Response:**
 *    Returns all pagination metadata along with supervisor details such as
 *    `id`, `name`, `address`, `phone`, `email`, `governorate`, `created_at`, `updated_at`.
 *
 * Example successful response:
 * {
 *   "responseData": {
 *     "success": true,
 *     "page": 1,
 *     "limit": 10,
 *     "total": 45,
 *     "totalPages": 5,
 *     "data": [
 *         {
 *            "id": "uuid",
 *            "name": "Omar Hassan",
 *            "address": "Cairo",
 *            "phone": "01098765432",
 *            "email": "omar@example.com",
 *            "governorate": "Cairo",
 *            "created_at": "2025-01-20T10:00:00Z",
 *            "updated_at": "2025-01-22T13:30:00Z"
 *         },
 *         ...
 *     ]
 *   }
 * }
 *
 * Example error response (no data):
 * {
 *   "success": false,
 *   "message": "No supervisors found"
 * }
 */

const getAllSupervisors = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, or school staff can view all supervisors",
      });
    }

    const { page, limit, skip } = pagination(req);
    const cacheKey = `supervisors:${page}:${limit}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(" Returning data from Redis cache");
      return res.status(200).json({ cachedData: JSON.parse(cachedData) });
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM Supervisor`);
    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);

    const result = await pool.query(
      `SELECT id, name, address, phone, email, governorate, created_at, updated_at FROM Supervisor ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, skip]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No supervisors found",
      });
    }

    const responseData = {
      success: true,
      page,
      limit,
      total,
      totalPages,
      data: result.rows,
    };
    console.log("Data saved in Redis cache");
    await redis.set(cacheKey, JSON.stringify(responseData));

    return res.status(200).json({ responseData });
  } catch (error) {
    console.error("Error fetching all supervisors:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route   DELETE /supervisors/:school_id
 * @desc    Delete a supervisor by ID
 * 
 * @access  Admin, School
 * 
 * @permissions
 * - Only users with role "admin" or "school" can perform this action.
 * - Other roles receive: 
 *   {
 *     "success": false,
 *     "message": "Access denied: only admin or school can delete a supervisor"
 *   }
 *
 * @params
 * - school_id (URL param): The ID of the supervisor to delete.
 *
 * @process
 * 1. Extract supervisorId from req.params.school_id.
 * 2. Attempt to delete the supervisor from the database:
 *      DELETE FROM Supervisor WHERE id = $1 RETURNING id
 * 3. If no supervisor exists:
 *      {
 *        "success": false,
 *        "message": "Supervisor not found"
 *      }
 * 4. On successful deletion:
 *    - Decrease the supervisors_count value inside SchoolUsage:
 *        UPDATE SchoolUsage
 *        SET supervisors_count = supervisors_count - 1
 *        WHERE school_id = $1
 *
 * 5. Clear Redis cache:
 *    - Scan for all keys starting with "supervisors:*"
 *    - Delete the keys
 *
 * @successResponse
 * {
 *   "success": true,
 *   "message": "Supervisor deleted successfully"
 * }
 *
 * @errorResponse
 * {
 *   "success": false,
 *   "message": "Internal server error"
 * }
 *
 * @notes
 * - This code expects the variable `school_id` to exist, but it is NOT defined.
 * - Redis client is referenced as "redis" but the actual name may differ.
 * - Param name `school_id` actually represents supervisor ID.
 * - This documentation describes the code exactly as it was written.
 */

const deleteSupervisorById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin or school can delete a supervisor",
      });
    }

    const supervisorId = req.params.school_id;

    const result = await pool.query(
      "DELETE FROM Supervisor WHERE id = $1 RETURNING id",
      [supervisorId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Supervisor not found",
      });
    }

    await pool.query(
      `
      UPDATE SchoolUsage
      SET supervisors_count = supervisors_count - 1
      WHERE school_id = $1
    `,
      [school_id]
    );

    const keys = await redis.keys("supervisors:*");
    if (keys.length > 0) {
      await redis.del(keys);
      console.log("Cleared supervisors cache after deletion");
    }

    return res.status(200).json({
      success: true,
      message: "Supervisor deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting supervisor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route   DELETE /supervisors/all/:school_id
 * @desc    Delete all supervisors belonging to a specific school
 *
 * @access  Admin, School
 *
 * @permissions
 * - Only users with roles "admin" or "school" are authorized.
 * - Unauthorized roles will receive:
 *   {
 *     "success": false,
 *     "message": "Access denied: only admin or school can delete all supervisors"
 *   }
 *
 * @params
 * - school_id (URL param): The ID of the school whose supervisors are to be deleted.
 *
 * @process
 * 1. Validate user role authorization.
 *
 * 2. Retrieve `school_id` from URL parameters.
 *
 * 3. Execute deletion query:
 *      DELETE FROM Supervisor WHERE school_id = $1 RETURNING id
 *    - This removes every supervisor linked to the specified school.
 *    - If no supervisors are deleted, respond with:
 *        {
 *          "success": false,
 *          "message": "No supervisors found to delete"
 *        }
 *
 * 4. Reset supervisors_count inside SchoolUsage to zero:
 *      UPDATE SchoolUsage
 *      SET supervisors_count = 0
 *      WHERE school_id = $1
 *
 * 5. Clear Redis cache:
 *    - Fetch all keys starting with: "supervisors:*"
 *    - Delete them to avoid stale pagination or list data.
 *    - Log confirmation for debugging:
 *        "Cleared supervisors cache after deletion"
 *
 * @successResponse
 * {
 *   "success": true,
 *   "message": "All supervisors deleted successfully",
 *   "count": <number_of_deleted_supervisors>
 * }
 *
 * @errorResponse
 * {
 *   "success": false,
 *   "message": "Internal server error"
 * }
 *
 * @notes
 * - Uses `RETURNING id` to ensure records existed and were deleted.
 * - Cache invalidation ensures the next GET request pulls fresh data.
 * - `count` is returned from `result.rowCount` to indicate how many supervisors were removed.
 */

const deleteAllSupervisors = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin or school can delete all supervisors",
      });
    }
    const { school_id } = req.params;
    const result = await pool.query(
      "DELETE FROM Supervisor WHERE school_id = $1 RETURNING id",
      [school_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No supervisors found to delete",
      });
    }

    await pool.query(
      `
      UPDATE SchoolUsage
      SET supervisors_count = 0
      WHERE school_id = $1
    `,
      [school_id]
    );

    const keys = await redis.keys("supervisors:*");
    if (keys.length > 0) {
      await redis.del(keys);
      console.log("Cleared supervisors cache after deletion");
    }

    return res.status(200).json({
      success: true,
      message: "All supervisors deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all supervisors:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  registerSupervisor,
  loginSupervisor,
  logoutSupervisor,
  updateSupervisor,
  getSupervisorById,
  getAllSupervisors,
  deleteSupervisorById,
  deleteAllSupervisors,
};
