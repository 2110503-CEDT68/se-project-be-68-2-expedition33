const express = require("express");
const {
	getPayments,
	getPayment,
	createPayment,
	updatePayment,
	deletePayment,
} = require("../controllers/payments");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router
	.route("/")
	.get(protect, authorize("admin", "company"), getPayments)
	.post(protect, authorize("admin", "company"), createPayment);
router
	.route("/:id")
	.get(protect, authorize("admin", "company"), getPayment)
	.put(protect, authorize("admin", "company"), updatePayment)
	.delete(protect, authorize("admin", "company"), deletePayment);

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Payment:
 *       type: object
 *       required:
 *         - company
 *         - totalPrice
 *         - dateList
 *       properties:
 *         company:
 *           type: string
 *           description: The ObjectId of the company
 *         totalPrice:
 *           type: number
 *           description: Total payment amount
 *         status:
 *           type: string
 *           enum: [initiated, authorized, captured, cancelled, failed]
 *           default: initiated
 *         dateList:
 *           type: array
 *           items:
 *             type: string
 *             format: date-time
 *         events:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               payload:
 *                 type: object
 *               createdAt:
 *                 type: string
 *                 format: date-time
 *       example:
 *         company: "60d0fe4f5311236168a109ca"
 *         totalPrice: 1500
 *         status: "initiated"
 *         dateList: ["2026-05-10T00:00:00.000Z", "2026-05-11T00:00:00.000Z"]
 */

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: The payment management API
 */

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: Returns the list of all payments
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The list of the payments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: number
 *                 pagination:
 *                   type: object
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Payment'
 *   post:
 *     summary: Create a new payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Payment'
 *     responses:
 *       201:
 *         description: The payment was successfully created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 */

/**
 * @swagger
 * /payments/{id}:
 *   get:
 *     summary: Get a payment by ID
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The payment ID
 *     responses:
 *       200:
 *         description: The payment description by id
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 *       404:
 *         description: The payment was not found
 *   put:
 *     summary: Update a payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The payment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Payment'
 *     responses:
 *       200:
 *         description: The payment was updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 *   delete:
 *     summary: Remove the payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The payment ID
 *     responses:
 *       200:
 *         description: The payment was deleted
 */
