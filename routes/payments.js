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
	.put(protect, authorize("admin"), updatePayment)
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
 *         id:
 *           type: string
 *           description: The auto-generated id of the payment
 *         company:
 *           type: string
 *           description: The Object id of the company
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
 *               eventType:
 *                 type: string
 *               payload:
 *                 type: object
 *               createdAt:
 *                 type: string
 *                 format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         id: "64c8d1f2e4b0c2a1d8f9e0a1"
 *         company: "60d0fe4f5311236168a109ca"
 *         totalPrice: 1500
 *         status: "initiated"
 *         "dateList": ["2022-05-10T00:00:00.000Z", "2022-05-11T00:00:00.000Z"]
 *         createdAt: "2022-04-08T03:24:21.000Z"
 *         updatedAt: "2022-04-08T03:24:21.000Z"
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
 *     description: Access - Private (Admin, Company)
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
 *     summary: Create a new payment (Invoice)
 *     description: Access - Private (Admin, Company). Automatically calculates total price based on dates.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - company
 *               - dateList
 *             properties:
 *               company:
 *                 type: string
 *                 example: "60d0fe4f5311236168a109ca"
 *               dateList:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: date-time
 *                 example: ["2022-05-10T00:00:00.000Z", "2022-05-11T00:00:00.000Z"]
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
 *     summary: Get a payment by id
 *     description: Access - Private (Admin, Company)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The payment id
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
 *     summary: Update a payment status (Webhook / Internal)
 *     description: Access - Private (Admin). Used to update payment status and log events.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The payment id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [initiated, authorized, captured, cancelled, failed]
 *                 example: "failed"
 *               errorMessage:
 *                 type: string
 *                 description: Optional error message if payment failed
 *                 example: "Insufficient funds"
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
 *     summary: Remove the payment by id
 *     description: Access - Private (Admin, Company)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The payment id
 *     responses:
 *       200:
 *         description: The payment was deleted
 */
