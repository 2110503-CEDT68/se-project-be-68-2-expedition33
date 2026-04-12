const express = require("express");
const {
	getBookings,
	getBooking,
	addBooking,
	updateBooking,
	deleteBooking,
} = require("../controllers/bookings");
const { protect, authorize } = require("../middleware/auth");

// Allows this router to read :companyId from parent routers
const router = express.Router({ mergeParams: true });

router
	.route("/")
	.get(protect, getBookings)
	.post(protect, authorize("user", "admin"), addBooking);
router
	.route("/:id")
	.get(protect, getBooking)
	.put(protect, updateBooking)
	.delete(protect, deleteBooking);

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Booking:
 *       type: object
 *       required:
 *         - bookingDate
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: The auto-generated id of the booking
 *         bookingDate:
 *           type: string
 *           format: date
 *           description: The date of the booking (Must be between May 10-13, 2022)
 *         user:
 *           type: string
 *           format: uuid
 *           description: The user ID who made the booking
 *         company:
 *           type: string
 *           format: uuid
 *           description: The company ID being booked
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The timestamp when the booking was created
 *       example:
 *         id: "64c8d1f2e4b0c2a1d8f9e0a2"
 *         bookingDate: "2022-05-10"
 *         user: "60df1b9b9c9d440000a1b2c4"
 *         company: "60d0fe4f5311236168a109ca"
 *         createdAt: "2022-04-08T03:24:21.000Z"
 */

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: The job fair bookings API
 */

/**
 * @swagger
 * /bookings:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get all bookings
 *     tags: [Bookings]
 *     responses:
 *       200:
 *         description: The list of the bookings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 2
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Booking'
 *       500:
 *         description: Some server error
 */

/**
 * @swagger
 * /companies/{companyId}/bookings:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get all bookings for a specific company
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: companyId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the company
 *     responses:
 *       200:
 *         description: The list of the bookings for this company
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 1
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Booking'
 *       500:
 *         description: Some server error
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Create a new booking for a specific company
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: companyId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the company to book
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingDate
 *             properties:
 *               bookingDate:
 *                 type: string
 *                 format: date
 *                 example: "2022-05-10"
 *               user:
 *                 type: string
 *                 format: uuid
 *                 example: "60df1b9b9c9d440000a1b2c4"
 *     responses:
 *       201:
 *         description: The booking was successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Validation error or max bookings reached
 *       404:
 *         description: Company not found
 */

/**
 * @swagger
 * /bookings/{id}:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get the booking by id
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The booking id
 *     responses:
 *       200:
 *         description: The booking description by id
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Booking'
 *       403:
 *         description: Not authorized to view this booking
 *       404:
 *         description: The booking was not found
 *   put:
 *     security:
 *       - bearerAuth: []
 *     summary: Update the booking by id
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The booking id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bookingDate:
 *                 type: string
 *                 format: date
 *                 example: "2022-05-13"
 *     responses:
 *       200:
 *         description: The booking was successfully updated
 *       400:
 *         description: Invalid date range
 *       403:
 *         description: Not authorized to update this booking
 *       404:
 *         description: The booking was not found
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     summary: Remove the booking by id
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The booking id
 *     responses:
 *       200:
 *         description: The booking was deleted
 *       403:
 *         description: Not authorized to delete this booking
 *       404:
 *         description: The booking was not found
 */
