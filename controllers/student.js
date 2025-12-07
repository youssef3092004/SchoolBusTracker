const pool = require("../config/db");
const pagination = require("../utils/pagination");
const redis = require("../config/redis");
const checkLimit = require("../utils/checkLimit");

/**
 * @route POST /api/v1/students
 * @desc Create a new student under a specific school. Only users with the roles
 *       admin, school, or school_staff can perform this action.
 *
 * @access Private (Admin, School, School Staff)
 *
 * @body {string} parent_id - ID of the parent associated with the student (required)
 * @body {string} school_id - ID of the school where the student will be enrolled (required)
 * @body {string} name - Name of the student (required)
 * @body {string} birthday - Birthday of the student (required)
 * @body {string} grade - Grade of the student (optional)
 * @body {string} class_name - Class of the student (optional)
 * @body {string} image_url - URL of the student's profile image (optional)
 * @body {string} address - Address of the student (optional)
 * @body {string} parent_note - Note from parent (optional)
 *
 * @returns {Object} 201 - Success response with the created student
 * @returns {boolean} success - Indicates creation was successful
 * @returns {string} message - Description of the operation
 * @returns {Object} data - The newly created student record
 *
 * @throws {400} If required fields are missing
 * @throws {403} If the requesting user does not have sufficient privileges
 * @throws {404} If the specified school does not exist
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint performs the following steps:
 * 1. Validate that the requesting user has the correct role (admin, school, school_staff).
 * 2. For school users, verify that they are creating a student for their own school.
 * 3. Validate required fields (`parent_id`, `school_id`, `name`, `birthday`) are provided.
 * 4. Check if the school exists in the database.
 * 5. Check if the school plan allows creating a new student using `checkLimit`.
 * 6. Increment the `students_count` in `SchoolUsage`.
 * 7. Generate a unique `student_code` based on the school name initials and a random number.
 * 8. Insert the new student record into the `Student` table.
 * 9. Clear related Redis cache entries (`students*`) to ensure fresh data on future requests.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Student created successfully",
 *   "data": {
 *     "id": "uuid",
 *     "parent_id": "uuid",
 *     "school_id": "uuid",
 *     "name": "John Doe",
 *     "student_code": "AB-123456",
 *     "birthday": "2010-05-12",
 *     "grade": "5",
 *     "class_name": "A",
 *     "image_url": null,
 *     "address": null,
 *     "parent_note": null,
 *     "created_at": "...",
 *     "updated_at": "..."
 *   }
 * }
 */

const createStudent = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin or school or school_staff can create students",
      });
    }
    const {
      parent_id,
      school_id,
      name,
      birthday,
      grade,
      class_name,
      image_url,
      address,
      parent_note,
    } = req.body;

    if (req.user.role === "school") {
      const schoolCheck = await pool.query(
        "SELECT * FROM School WHERE id = $1",
        [req.user.id]
      );
      if (
        schoolCheck.rows.length === 0 ||
        schoolCheck.rows[0].id !== school_id
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied: cannot register parent for another school",
        });
      }
    }

    const requiredFields = { parent_id, school_id, name, birthday };

    for (let i in requiredFields) {
      if (!requiredFields[i]) {
        return res.status(400).json({
          success: false,
          message: `${i.charAt(0).toUpperCase() + i.slice(1)} is required`,
        });
      }
    }

    const school_name = await pool.query(
      `SELECT name FROM School WHERE id = $1`,
      [school_id]
    );

    if (school_name.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }

    const isLimitReached = await checkLimit(school_id, "student");

    if (isLimitReached) {
      return res.status(400).json({
        success: false,
        message: "Student limit reached for this plan",
      });
    }

    await pool.query(
      `
      UPDATE SchoolUsage
      SET students_count = students_count + 1
      WHERE school_id = $1
    `,
      [school_id]
    );

    const schoolName = school_name.rows[0].name;

    const firstCharWord = schoolName
      .split(/\s+/)
      .map((word) => word[0].toUpperCase())
      .join("");

    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const studentCode = `${firstCharWord}-${randomDigits}`;

    const result = await pool.query(
      `INSERT INTO Student 
  (parent_id, school_id, name, student_code, birthday, grade, class_name, image_url, address, parent_note)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  RETURNING *`,
      [
        parent_id,
        school_id,
        name,
        studentCode,
        birthday,
        grade || null,
        class_name || null,
        image_url || null,
        address || null,
        parent_note || null,
      ]
    );

    const keys = await redis.keys("students*");
    if (keys.length > 0) {
      await redis.del(keys);
      console.log("Cleared students cache in redis");
    }

    return res.status(201).json({
      success: true,
      message: "Student created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating student:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route GET /api/v1/students
 * @desc Fetch all students with pagination. Only users with roles admin, school, or school_staff can access this endpoint.
 *
 * @access Private (Admin, School, School Staff)
 *
 * @query {number} page - Page number for pagination (optional, defaults to 1)
 * @query {number} limit - Number of students per page (optional, defaults to 10)
 *
 * @returns {Object} 200 - Success response containing students and pagination metadata
 * @returns {boolean} success - Indicates whether the fetch was successful
 * @returns {number} page - Current page number
 * @returns {number} limit - Number of items per page
 * @returns {number} total - Total number of students
 * @returns {number} totalPages - Total number of pages
 * @returns {Array} data - Array of student objects
 *
 * @throws {403} If the requesting user does not have sufficient privileges
 * @throws {404} If no students are found
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint performs the following steps:
 * 1. Validates that the requesting user has the correct role (admin, school, school_staff).
 * 2. Reads pagination parameters (`page`, `limit`) from the request.
 * 3. Checks Redis cache for existing data with the key `students:{page}:{limit}`.
 *    - If cached data exists, returns it immediately.
 * 4. Queries the total number of students to calculate total pages.
 * 5. Fetches students from the `Student` table with limit and offset for pagination.
 * 6. Returns 404 if no students are found.
 * 7. Caches the response in Redis for 10 minutes to improve performance on subsequent requests.
 *
 * Example successful response:
 * {
 *   "responseData": {
 *     "success": true,
 *     "page": 1,
 *     "limit": 10,
 *     "total": 50,
 *     "totalPages": 5,
 *     "data": [
 *       {
 *         "id": "uuid",
 *         "name": "John Doe",
 *         "address": "123 Street",
 *         "phone": "01000000000",
 *         "email": "john@example.com",
 *         "governorate": "Cairo",
 *         "created_at": "...",
 *         "updated_at": "..."
 *       },
 *       ...
 *     ]
 *   }
 * }
 */

const getAllStudents = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin, school, or school staff can view all students",
      });
    }
    const { page, limit, skip } = pagination(req);
    const cacheKey = `students:${page}:${limit}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log("Returning data from Redis cache");
      return res.status(200).json({ responseData: JSON.parse(cachedData) });
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM Student`);
    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);

    const result = await pool.query(
      `SELECT id, name, address, phone, email, governorate, created_at, updated_at 
       FROM Student 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, skip]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No students found",
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

    await redis.setEx(cacheKey, 600, JSON.stringify(responseData));
    console.log("Data saved in Redis cache");

    return res.status(200).json({ responseData });
  } catch (error) {
    console.error("Error fetching all students:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route GET /api/v1/students/:id
 * @desc Fetch a specific student by ID. Only users with roles admin, school, or school_staff can access this endpoint.
 *
 * @access Private (Admin, School, School Staff)
 *
 * @param {string} id - The ID of the student to fetch (from URL params)
 *
 * @returns {Object} 200 - Success response containing the student details
 * @returns {boolean} success - Indicates whether the fetch was successful
 * @returns {Object} data - The student record
 *
 * @throws {403} If the requesting user does not have sufficient privileges
 * @throws {404} If the student with the specified ID is not found
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint performs the following steps:
 * 1. Validates that the requesting user has the correct role (admin, school, school_staff).
 * 2. Retrieves the student ID from URL parameters.
 * 3. Queries the `Student` table to fetch the student with the provided ID.
 * 4. Returns 404 if no student is found.
 * 5. Returns the student details if found.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "parent_id": "uuid",
 *     "school_id": "uuid",
 *     "name": "John Doe",
 *     "student_code": "AB-123456",
 *     "birthday": "2010-05-12",
 *     "grade": "5",
 *     "class_name": "A",
 *     "image_url": null,
 *     "address": "123 Street",
 *     "parent_note": null,
 *     "created_at": "...",
 *     "updated_at": "..."
 *   }
 * }
 */

const getStudentById = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin or school or school_staff can view student details",
      });
    }
    const id = req.params.id;
    const result = await pool.query("SELECT * FROM Student WHERE id = $1", [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching student:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route PATCH /api/v1/students/:id
 * @desc Update an existing student's details by ID. Only users with roles admin, school, school_staff, or parent can update student records.
 *
 * @access Private (Admin, School, School Staff, Parent)
 *
 * @param {string} id - The ID of the student to update (from URL params)
 * @body {string} parent_id - ID of the parent associated with the student (optional)
 * @body {string} school_id - ID of the school (optional)
 * @body {string} name - Student's name (optional)
 * @body {string} student_code - Unique code for the student (optional)
 * @body {string} birthday - Student's birthday (optional)
 * @body {string} grade - Grade of the student (optional)
 * @body {string} class_name - Class name of the student (optional)
 * @body {string} image_url - URL of the student's profile image (optional)
 * @body {string} address - Address of the student (optional)
 * @body {string} parent_note - Note from parent (optional)
 *
 * @returns {Object} 200 - Success response containing updated student details
 * @returns {boolean} success - Indicates whether the update was successful
 * @returns {string} message - Description of the operation
 * @returns {Object} data - The updated student record
 *
 * @throws {400} If no valid fields are provided for update
 * @throws {403} If the requesting user does not have sufficient privileges
 * @throws {404} If the student with the specified ID is not found
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint performs the following steps:
 * 1. Validates that the requesting user has the correct role (admin, school, school_staff, parent).
 * 2. Retrieves the student ID from URL parameters.
 * 3. Filters the request body to allow updates only on valid fields.
 * 4. Returns 400 if no valid fields are provided for update.
 * 5. Updates the student record in the database and sets `updated_at` to the current timestamp.
 * 6. Returns 404 if no student is found with the provided ID.
 * 7. Clears Redis cache keys related to students (`students*`) to ensure fresh data on future requests.
 * 8. Returns the updated student data in the response.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Student updated successfully",
 *   "data": {
 *     "id": "uuid",
 *     "parent_id": "uuid",
 *     "school_id": "uuid",
 *     "name": "John Doe",
 *     "student_code": "AB-123456",
 *     "birthday": "2010-05-12",
 *     "grade": "5",
 *     "class_name": "A",
 *     "image_url": null,
 *     "address": "123 Street",
 *     "parent_note": null,
 *     "created_at": "...",
 *     "updated_at": "..."
 *   }
 * }
 */

const updateStudentById = async (req, res, next) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "school" &&
      req.user.role !== "school_staff" &&
      req.user.role !== "parent"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: only admin or school or parent can update students",
      });
    }
    const id = req.params.id;
    const allowFields = [
      "parent_id",
      "school_id",
      "name",
      "student_code",
      "birthday",
      "grade",
      "class_name",
      "image_url",
      "address",
      "parent_note",
    ];

    const updates = req.body;
    const keys = Object.keys(updates).filter((key) =>
      allowFields.includes(key)
    );

    if (keys.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid allowFields provided for update",
      });
    }

    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(", ");
    const values = keys.map((key) => updates[key]);
    values.push(id);

    const result = await pool.query(
      `UPDATE Student
       SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const key = await redis.keys("students*");
    if (key.length > 0) {
      await redis.del(key);
      console.log("Cleared students cache in redis");
    }

    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating student:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route DELETE /api/v1/students/:id
 * @desc Delete a specific student by ID. Only users with roles admin or school can perform this action.
 *
 * @access Private (Admin, School)
 *
 * @param {string} id - The ID of the student to delete (from URL params)
 *
 * @returns {Object} 200 - Success response confirming deletion
 * @returns {boolean} success - Indicates whether the deletion was processed
 * @returns {string} message - Description of the deletion result
 *
 * @throws {403} If the requesting user does not have sufficient privileges
 * @throws {404} If the student with the specified ID is not found
 * @throws {500} For unexpected server errors
 *
 * @description
 * This endpoint performs the following steps:
 * 1. Validates that the requesting user has the correct role (admin, school).
 * 2. Decrements the `students_count` in the `SchoolUsage` table for the associated school.
 * 3. Deletes the student record from the `Student` table using the provided ID.
 * 4. Returns 404 if no student is found with the specified ID.
 * 5. Clears Redis cache keys related to students (`students*`) to ensure fresh data on future requests.
 * 6. Returns a success message upon successful deletion.
 *
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "Student deleted successfully"
 * }
 */

const deleteStudentById = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin or school can delete students",
      });
    }

    await pool.query(
      `
      UPDATE SchoolUsage
      SET students_count = students_count - 1
      WHERE school_id = $1
    `,
      [school_id]
    );

    const id = req.params.id;
    const result = await pool.query(
      `DELETE FROM Student WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const keys = await redis.keys("students*");
    if (keys.length > 0) {
      await redis.del(keys);
      console.log("Cleared students cache in redis");
    }

    return res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting student:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * @route DELETE /api/v1/students/school/:school_id
 * @desc Delete all students for a specific school. Only users with roles admin or school can perform this action.
 * 
 * @access Private (Admin, School)
 * 
 * @param {string} school_id - The ID of the school whose students should be deleted (from URL params)
 * 
 * @returns {Object} 200 - Success response confirming deletion of all students
 * @returns {boolean} success - Indicates whether the deletion was processed
 * @returns {string} message - Description of the deletion result
 * @returns {number} count - The number of student records deleted
 * 
 * @throws {403} If the requesting user does not have sufficient privileges
 * @throws {404} If no students are found for deletion
 * @throws {500} For unexpected server errors
 * 
 * @description
 * This endpoint performs the following steps:
 * 1. Validates that the requesting user has the correct role (admin, school).
 * 2. Resets the `students_count` in the `SchoolUsage` table for the given school to 0.
 * 3. Deletes all student records from the `Student` table.
 * 4. Returns 404 if no students were found in the database.
 * 5. Clears Redis cache keys related to students (`students*`) to ensure fresh data on future requests.
 * 6. Returns a success message along with the count of deleted student records.
 * 
 * Example successful response:
 * {
 *   "success": true,
 *   "message": "All students deleted successfully",
 *   "count": 25
 * }
 */

const deleteAllStudents = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "school") {
      return res.status(403).json({
        success: false,
        message: "Access denied: only admin or school can delete all students",
      });
    }

    const { school_id } = req.params;

    await pool.query(
      `
      UPDATE SchoolUsage
      SET students_count = 0
      WHERE school_id = $1
    `,
      [school_id]
    );

    const result = await pool.query("DELETE FROM Student");
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No students found",
      });
    }

    const keys = await redis.keys("students*");
    if (keys.length > 0) {
      await redis.del(keys);
      console.log("Cleared students cache in redis");
    }

    return res.status(200).json({
      success: true,
      message: "All students deleted successfully",
      count: result.rowCount,
    });
  } catch (error) {
    console.error("Error deleting all students:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudentById,
  deleteStudentById,
  deleteAllStudents,
};
