const express = require("express");
const {
	getPayments,
	getPayment,
	addPayment,
	updatePayment,
	deletePayment,
} = require("../controllers/payments");
const { protect, authorize } = require("../middleware/auth");

// Allows this router to read :companyId from parent routers
const router = express.Router({ mergeParams: true });

router
	.route("/")
	.get(protect, authorize("admin", "company"), getPayments)
	.post(protect, authorize("admin", "company"), addPayment);
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
 *     PaymentCompanySummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The company id
 *         name:
 *           type: string
 *         address:
 *           type: string
 *         district:
 *           type: string
 *         province:
 *           type: string
 *         postalcode:
 *           type: string
 *         tel:
 *           type: string
 *         website:
 *           type: string
 *         description:
 *           type: string
 *         logo:
 *           type: string
 *         photoList:
 *           type: array
 *           items:
 *             type: string
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
 *           allOf:
 *             - $ref: '#/components/schemas/PaymentCompanySummary'
 *           description: Populated company fields selected from Company
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
 *                 enum: [PAYMENT_INITIATED, PAYMENT_AUTHORIZED, PAYMENT_FAILED, PAYMENT_SUCCESS, PAYMENT_CANCELLED]
 *               payload:
 *                 type: object
 *                 properties:
 *                   oldStatus:
 *                     type: string
 *                     enum: [initiated, authorized, captured, cancelled, failed]
 *                     nullable: true
 *                   newStatus:
 *                     type: string
 *                     enum: [initiated, authorized, captured, cancelled, failed]
 *                   transactionId:
 *                     type: string
 *                     nullable: true
 *                   errorMessage:
 *                     type: string
 *                     nullable: true
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
 *         company:
 *           id: "60d0fe4f5311236168a109ca"
 *           name: "Acme Event Co"
 *           address: "123 Main Road"
 *           district: "Bang Kapi"
 *           province: "Bangkok"
 *           postalcode: "10240"
 *           tel: "021234567"
 *           website: "https://acme-events.example"
 *           description: "Event organizer"
 *           logo: "https://cdn.example.com/logo.png"
 *           photoList:
 *             - "https://cdn.example.com/photo-1.jpg"
 *             - "https://cdn.example.com/photo-2.jpg"
 *         totalPrice: 200
 *         status: "initiated"
 *         dateList:
 *           - "2022-05-10T00:00:00.000Z"
 *           - "2022-05-11T00:00:00.000Z"
 *         events:
 *           - eventType: "PAYMENT_INITIATED"
 *             payload:
 *               oldStatus: null
 *               newStatus: "initiated"
 *               transactionId: null
 *               errorMessage: null
 *             createdAt: "2022-05-08T03:24:21.000Z"
 *         createdAt: "2022-05-08T03:24:21.000Z"
 *         updatedAt: "2022-05-08T03:24:21.000Z"
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
 *     description: Access --- Private (Admin, Company). Company role gets only their own payments.
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
 */

/**
 * @swagger
 * /companies/{companyId}/payments:
 *   post:
 *     summary: Add a new payment item
 *     description: Access --- Private (Admin, Company). Calculates total price based on dateList length.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the company to bill
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dateList
 *             properties:
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
 *       400:
 *         description: Validation error or invalid date range
 *       404:
 *         description: Company not found
 */

/**
 * @swagger
 * /payments/{id}:
 *   get:
 *     summary: Get a payment by id
 *     description: Access --- Private (Admin, Company). Ownership check enforced for Company role.
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
 *         description: The payment data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 *   put:
 *     summary: Update payment status
 *     description: Access --- Private (Admin only). Updates status and appends to event log.
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [initiated, authorized, captured, cancelled, failed]
 *                 example: "captured"
 *     responses:
 *       200:
 *         description: The payment was updated
 *   delete:
 *     summary: Cancel a payment
 *     description: Access --- Private (Admin, Company). Marks the status as 'cancelled' and logs the event instead of removing the record.
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
 *         description: Payment successfully cancelled
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
