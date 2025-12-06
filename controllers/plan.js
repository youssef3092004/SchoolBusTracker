const pool = require("../config/db");
const pagination = require("../utils/pagination");
const redis = require("../config/redis");

/**
 * @route POST /api/v1/plans
 * @desc Create a new subscription plan in the system. Only accessible by authenticated admins.
 * @access Private (Admin only, requires JWT token with role: "admin")
 *
 * @body {string} name - Name of the plan. Must be unique.
 * @body {number} max_students - Maximum number of students allowed in this plan.
 * @body {number} max_parent - Maximum number of parents allowed in this plan.
 * @body {number} max_supervisor - Maximum number of supervisors allowed in this plan.
 * @body {number} max_schoolStaff - Maximum number of school staff allowed in this plan.
 * @body {number} price - Price of the plan.
 * @body {string} description - Description of the plan.
 *
 * @throws {403} If the authenticated user is not an admin.
 * @throws {400} If any required fields are missing or if a plan with the same name already exists.
 * @throws {500} If an unexpected server or database error occurs.
 *
 * @returns {Object} 201 - Success response containing the newly created plan data.
 * @returns {boolean} success - Indicates whether the creation was successful.
 * @returns {string} message - Status message describing the outcome.
 * @returns {Object} data - Newly created plan object.
 *
 * @description
 * This route handler allows an admin to create a new subscription plan.
 * The function performs the following steps:
 * 1. Validates that the authenticated user has admin privileges.
 * 2. Ensures that all required fields (name, max_students, max_parent, max_supervisor, max_schoolStaff, price, description) are provided.
 * 3. Checks the database to confirm that the plan name does not already exist.
 * 4. Inserts the new plan into the "Plan" table.
 * 5. Clears any cached plan-related keys in Redis to ensure subsequent requests return fresh data.
 * 6. Returns a 201 response with the newly created plan data.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Plan created successfully",
 *   "data": {
 *     "id": "uuid-generated-id",
 *     "name": "Premium Plan",
 *     "max_students": 100,
 *     "max_parent": 50,
 *     "max_supervisor": 10,
 *     "max_schoolStaff": 15,
 *     "price": 49.99,
 *     "description": "Full access plan for schools",
 *     "created_at": "2025-12-06T12:00:00.000Z",
 *     "updated_at": "2025-12-06T12:00:00.000Z"
 *   }
 * }
 */

const createPlan = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can create a plan",
      });
    }
    const {
      name,
      max_students,
      max_parent,
      max_supervisor,
      max_schoolStaff,
      price,
      description,
    } = req.body;
    const requiredFields = {
      name,
      max_students,
      max_parent,
      max_supervisor,
      max_schoolStaff,
      price,
      description,
    };

    for (let i in requiredFields) {
      if (!requiredFields[i]) {
        return res.status(400).json({
          success: false,
          message: `${i.charAt(0).toUpperCase() + i.slice(1)} is required`,
        });
      }
    }

    const existingPlan = await pool.query(
      "SELECT * FROM Plan WHERE name = $1",
      [name]
    );
    if (existingPlan.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Plan with this name already exists",
      });
    }

    const newPlan = await pool.query(
      `INSERT INTO Plan 
  (name, max_students, max_parent, max_supervisor, max_schoolstaff, price, description) 
  VALUES ($1, $2, $3, $4, $5, $6, $7) 
  RETURNING *`,
      [
        name,
        max_students,
        max_parent,
        max_supervisor,
        max_schoolStaff,
        price,
        description,
      ]
    );

    const keys = await reids.keys("plans:*");
    if (keys.length > 0) {
      await redis.del(keys);
    }

    return res.status(201).json({
      success: true,
      message: "Plan created successfully",
      data: newPlan.rows[0],
    });
  } catch (error) {
    console.error("Error creating plan:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route GET /api/v1/plans/:id
 * @desc Fetch detailed information of a specific subscription plan using its unique ID.
 * @access Private (Admin only, requires JWT token with role: "admin")
 *
 * @param {string} req.params.id - The unique identifier of the plan to be retrieved.
 *
 * @header Authorization - Bearer token of an authenticated admin. Required.
 *
 * @returns {Object} 200 - Success response containing plan details.
 * @returns {boolean} success - Indicates whether the operation succeeded.
 * @returns {Object} data - Plan object with full details.
 * @returns {string} data.id - Plan ID.
 * @returns {string} data.name - Plan name.
 * @returns {number} data.max_students - Maximum students allowed in this plan.
 * @returns {number} data.max_parent - Maximum parents allowed in this plan.
 * @returns {number} data.max_supervisor - Maximum supervisors allowed in this plan.
 * @returns {number} data.max_schoolStaff - Maximum school staff allowed in this plan.
 * @returns {number} data.price - Price of the plan.
 * @returns {string} data.description - Description of the plan.
 * @returns {string} data.created_at - Timestamp when the plan was created.
 * @returns {string} data.updated_at - Timestamp of last update.
 *
 * @throws {403} If the authenticated user is not an admin.
 * @throws {404} If no plan exists with the specified ID.
 * @throws {500} For unexpected server errors.
 *
 * @description
 * This endpoint retrieves detailed information for a specific subscription plan.
 * Only authenticated users with the `admin` role are allowed to access this resource.
 *
 * Steps performed:
 * 1. Validate that the authenticated user has an admin role.
 * 2. Extract the plan ID from the route parameters.
 * 3. Query the database to fetch the plan details.
 * 4. If the plan is found, return it in the response; otherwise, return a 404 not found error.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid-generated-id",
 *     "name": "Premium Plan",
 *     "max_students": 100,
 *     "max_parent": 50,
 *     "max_supervisor": 10,
 *     "max_schoolStaff": 15,
 *     "price": 49.99,
 *     "description": "Full access plan for schools",
 *     "created_at": "2025-12-06T12:00:00.000Z",
 *     "updated_at": "2025-12-06T12:00:00.000Z"
 *   }
 * }
 */

const getPlanById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can view plan details",
      });
    }
    const id = req.params.id;
    const result = await pool.query("SELECT * FROM Plan WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching plan:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route GET /api/v1/plans
 * @desc Retrieve a paginated list of all subscription plans.
 * @access Private (Admin only, requires JWT token with role: "admin")
 *
 * @header Authorization - Bearer token of an authenticated admin. Required.
 *
 * @queryParam {number} page - The page number for pagination (optional, default handled by middleware).
 * @queryParam {number} limit - Maximum number of plans per page (optional, default handled by middleware).
 *
 * @returns {Object} 200 - Success response containing paginated plans list.
 * @returns {boolean} success - Indicates whether the operation succeeded.
 * @returns {number} page - Current page number.
 * @returns {number} limit - Number of items per page.
 * @returns {number} total - Total number of plans in the database.
 * @returns {number} totalPages - Total available pages.
 * @returns {Array<Object>} data - List of plan objects.
 * @returns {string} data.id - Plan ID.
 * @returns {string} data.name - Plan name.
 * @returns {number} data.max_students - Maximum students allowed in this plan.
 * @returns {number} data.max_parent - Maximum parents allowed in this plan.
 * @returns {number} data.max_supervisor - Maximum supervisors allowed in this plan.
 * @returns {number} data.max_schoolStaff - Maximum school staff allowed in this plan.
 * @returns {number} data.price - Price of the plan.
 * @returns {string} data.description - Description of the plan.
 * @returns {string} data.created_at - Timestamp of plan creation.
 * @returns {string} data.updated_at - Timestamp of last update.
 *
 * @throws {403} If the authenticated user is not an admin.
 * @throws {404} If no plans are found in the database.
 * @throws {500} For unexpected server errors.
 *
 * @description
 * This endpoint returns a paginated list of all subscription plans in the system.
 * Redis caching is used to improve performance for repeated requests with the same
 * page and limit parameters. If cached data exists, it is returned directly without
 * querying the database.
 *
 * Steps performed:
 * 1. Verify the authenticated user has an admin role.
 * 2. Extract pagination parameters (page, limit, skip) from the request.
 * 3. Check Redis for cached results using a key based on page and limit.
 * 4. If cached data exists, return it immediately.
 * 5. Otherwise:
 *    - Query the database for total plan count.
 *    - Fetch paginated plan records sorted by creation date descending.
 *    - Prepare the structured response.
 *    - Store the response in Redis cache with a 1-hour expiration.
 * 6. Return the paginated plan list.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "page": 1,
 *   "limit": 10,
 *   "total": 25,
 *   "totalPages": 3,
 *   "data": [
 *     {
 *       "id": "uuid-generated-id",
 *       "name": "Premium Plan",
 *       "max_students": 100,
 *       "max_parent": 50,
 *       "max_supervisor": 10,
 *       "max_schoolStaff": 15,
 *       "price": 49.99,
 *       "description": "Full access plan for schools",
 *       "created_at": "2025-12-06T12:00:00.000Z",
 *       "updated_at": "2025-12-06T12:00:00.000Z"
 *     }
 *   ]
 * }
 */

const getAllPlans = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can view all plans",
      });
    }

    const { page, limit, skip } = pagination(req);

    const cacheKey = `plans:${page}:${limit}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log("Returning data from Redis cache");
      return res.status(200).json(JSON.parse(cachedData));
    }

    const countResult = await pool.query("SELECT COUNT(*) AS total FROM Plan");
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    const result = await pool.query(
      "SELECT * FROM Plan ORDER BY CREATED_AT DESC LIMIT $1 OFFSET $2",
      [limit, skip]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No plans found",
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

    console.log("Storing data in Redis cache");
    await redis.setEx(cacheKey, 3600, JSON.stringify(responseData));

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching plans:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route PATCH /api/v1/plans/:id
 * @desc Update an existing subscription plan by its ID. Only accessible to admins.
 * @access Private (Admin only, requires JWT token with role: "admin")
 *
 * @header Authorization - Bearer token of an authenticated admin. Required.
 *
 * @param {string} req.params.id - The unique identifier of the plan to update.
 *
 * @body {string} [name] - New name of the plan.
 * @body {number} [max_students] - Maximum number of students allowed.
 * @body {number} [max_parent] - Maximum number of parents allowed.
 * @body {number} [max_supervisor] - Maximum number of supervisors allowed.
 * @body {number} [max_schoolStaff] - Maximum number of school staff allowed.
 * @body {number} [price] - New price of the plan.
 * @body {string} [description] - New description of the plan.
 *
 * @returns {Object} 200 - Success response with updated plan data.
 * @returns {boolean} success - Indicates whether the update succeeded.
 * @returns {string} message - Describes the outcome of the update.
 * @returns {Object} data - Updated plan object.
 * @returns {string} data.id - Plan ID.
 * @returns {string} data.name - Plan name.
 * @returns {number} data.max_students - Maximum students allowed.
 * @returns {number} data.max_parent - Maximum parents allowed.
 * @returns {number} data.max_supervisor - Maximum supervisors allowed.
 * @returns {number} data.max_schoolStaff - Maximum school staff allowed.
 * @returns {number} data.price - Price of the plan.
 * @returns {string} data.description - Description of the plan.
 * @returns {string} data.created_at - Timestamp of plan creation.
 * @returns {string} data.updated_at - Timestamp of last update.
 *
 * @throws {403} If the authenticated user is not an admin.
 * @throws {400} If no valid fields are provided for update.
 * @throws {404} If the plan with the specified ID does not exist.
 * @throws {500} For unexpected server errors.
 *
 * @description
 * This endpoint updates an existing subscription plan. Only fields provided in the
 * request body and listed as allowed are updated. The update is dynamic, meaning
 * only supplied valid fields are modified.
 *
 * Steps performed:
 * 1. Verify that the authenticated user has an admin role.
 * 2. Extract the plan ID from route parameters.
 * 3. Validate that at least one allowed field is provided for update.
 * 4. Build a dynamic SQL UPDATE query based on the provided fields.
 * 5. Execute the update and return the updated plan record.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Plan updated successfully",
 *   "data": {
 *     "id": "uuid-generated-id",
 *     "name": "Premium Plan",
 *     "max_students": 100,
 *     "max_parent": 50,
 *     "max_supervisor": 10,
 *     "max_schoolStaff": 15,
 *     "price": 49.99,
 *     "description": "Full access plan for schools",
 *     "created_at": "2025-12-06T12:00:00.000Z",
 *     "updated_at": "2025-12-06T12:30:00.000Z"
 *   }
 * }
 */

const updatePlanById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can update plans",
      });
    }

    const planId = req.params.id;
    const allowedFields = [
      "name",
      "max_students",
      "max_parent",
      "max_supervisor",
      "max_schoolStaff",
      "price",
      "description",
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
    values.push(planId);

    const query = `
      UPDATE Plan
      SET ${setClause}
      WHERE id = $${values.length}
      RETURNING id, name, max_students, max_parent, max_supervisor, max_schoolStaff, price, description, created_at, updated_at;
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Plan updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating plan:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route DELETE /api/v1/plans/:id
 * @desc Delete a specific subscription plan by its ID. Only accessible to admins.
 * @access Private (Admin only, requires JWT token with role: "admin")
 *
 * @header Authorization - Bearer token of an authenticated admin. Required.
 *
 * @param {string} req.params.id - The unique identifier of the plan to delete.
 *
 * @returns {Object} 200 - Success response confirming deletion.
 * @returns {boolean} success - Indicates whether the deletion succeeded.
 * @returns {string} message - Describes the outcome of the deletion.
 *
 * @throws {403} If the authenticated user is not an admin.
 * @throws {404} If the plan with the specified ID does not exist.
 * @throws {500} For unexpected server errors.
 *
 * @description
 * This endpoint allows an authorized admin to delete a subscription plan by its ID.
 * The following steps are performed:
 * 1. Verify that the requester has an admin role.
 * 2. Extract the plan ID from route parameters.
 * 3. Execute the deletion in the database.
 * 4. Invalidate any cached plan data in Redis to ensure fresh data for future requests.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Plan deleted successfully."
 * }
 *
 * Example error response (plan not found):
 * {
 *   "success": false,
 *   "message": "Plan not found."
 * }
 */

const deletePlanById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete a plan",
      });
    }
    const id = req.params.id;

    const result = await pool.query(
      "DELETE FROM Plan WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Plan not found.",
      });
    }

    const keys = await redis.keys("plans:*");
    if (keys.length > 0) {
      await redis.del(keys);
    }

    res.status(200).json({
      success: true,
      message: "Plan deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting plan:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route DELETE /api/v1/plans
 * @desc Delete all subscription plans from the system. Only accessible to admins.
 * @access Private (Admin only, requires JWT token with role: "admin")
 *
 * @header Authorization - Bearer token of an authenticated admin. Required.
 *
 * @returns {Object} 200 - Success response confirming deletion of all plans.
 * @returns {boolean} success - Indicates whether the deletion succeeded.
 * @returns {string} message - Describes the outcome of the deletion.
 * @returns {number} count - Number of plans deleted.
 *
 * @throws {403} If the authenticated user is not an admin.
 * @throws {404} If no plans exist in the database.
 * @throws {500} For unexpected server errors.
 *
 * @description
 * This endpoint allows an authorized admin to delete all subscription plans.
 * The following steps are performed:
 * 1. Verify that the requester has an admin role.
 * 2. Execute deletion of all records from the Plan table in the database.
 * 3. Invalidate any cached plan data in Redis to ensure fresh data for future requests.
 * 4. Return the total number of deleted plans along with a success message.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "All plans deleted successfully.",
 *   "count": 5
 * }
 *
 * Example error response (no plans found):
 * {
 *   "success": false,
 *   "message": "No plans found to delete."
 * }
 */

const deleteAllPlans = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin can delete plans",
      });
    }

    const result = await pool.query("DELETE FROM Plan RETURNING *");

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No plans found to delete.",
      });
    }

    const keys = await redis.keys("plans:*");
    if (keys.length > 0) {
      await redis.del(keys);
    }

    res.status(200).json({
      success: true,
      message: "All plans deleted successfully.",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting plans:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createPlan,
  getPlanById,
  getAllPlans,
  updatePlanById,
  deletePlanById,
  deleteAllPlans,
};
