const express = require("express");
const {
	getCompanies,
	getCompany,
	createCompany,
	updateCompany,
	deleteCompany,
} = require("../controllers/companies");
const bookingRouter = require("./bookings");
const paymentRouter = require("./payments");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// Re-route into other resource routers
router.use("/:companyId/bookings", bookingRouter);
router.use("/:companyId/payments", paymentRouter);

router
	.route("/")
	.get(getCompanies)
	.post(protect, authorize("admin"), createCompany);
router
	.route("/:id")
	.get(getCompany)
	.put(protect, authorize("admin"), updateCompany)
	.delete(protect, authorize("admin"), deleteCompany);

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Company:
 *       type: object
 *       required:
 *         - name
 *         - address
 *         - district
 *         - province
 *         - postalcode
 *         - tel
 *         - website
 *         - description
 *         - managerAccount
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: The auto-generated id of the company
 *         name:
 *           type: string
 *           description: Company name
 *         address:
 *           type: string
 *           description: House No., Street, Road
 *         district:
 *           type: string
 *           description: District
 *         province:
 *           type: string
 *           description: Province
 *         postalcode:
 *           type: string
 *           description: 5-digit postal code
 *         tel:
 *           type: string
 *           description: Telephone number
 *         website:
 *           type: string
 *           description: Company website URL
 *         description:
 *           type: string
 *           description: Brief description of the company
 *         managerAccount:
 *           type: string
 *           description: The User ID of the company manager
 *         logo:
 *           type: string
 *           description: Google Drive link for the company logo
 *         photoList:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of Google Drive links for company photos
 *       example:
 *         id: 5f9f1b9b9c9d440000a1b2c3
 *         name: RizzExpress
 *         address: 123 Main St
 *         district: Pathumwan
 *         province: Bangkok
 *         postalcode: "10330"
 *         tel: "0812345678"
 *         website: https://www.rizzexpress.com
 *         description: A fast delivery service company.
 *         managerAccount: 60a1b2c3d4e5f6a7b8c9d0e1
 *         logo: https://drive.google.com/file/d/1a2b3c4d5e/view
 *         photoList:[
 *           "https://drive.google.com/file/d/1a2b3c4d5e_1/view",
 *           "https://drive.google.com/file/d/1a2b3c4d5e_2/view"
 *         ]
 */

/**
 * @swagger
 * tags:
 *   name: Companies
 *   description: The companies managing API
 */

/**
 * @swagger
 * /companies:
 *   get:
 *     summary: Returns the list of all the companies
 *     tags: [Companies]
 *     responses:
 *       200:
 *         description: The list of the companies with pagination
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
 *                   example: 25
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     next:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 3
 *                         limit:
 *                           type: integer
 *                           example: 25
 *                     prev:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 25
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Company'
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Create a new company
 *     tags: [Companies]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Company'
 *     responses:
 *       201:
 *         description: The company was successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Company'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Some server error
 */

/**
 * @swagger
 * /companies/{id}:
 *   get:
 *     summary: Get the company by id
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The company id
 *     responses:
 *       200:
 *         description: The company description by id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Company'
 *       404:
 *         description: The company was not found
 *   put:
 *     security:
 *       - bearerAuth:[]
 *     summary: Update the company by id
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The company id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: NoCortisol Inc.
 *     responses:
 *       200:
 *         description: The company was successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Company'
 *       400:
 *         description: Validation error
 *       404:
 *         description: The company was not found
 *       500:
 *         description: Some error happened
 *   delete:
 *     security:
 *       - bearerAuth:[]
 *     summary: Remove the company by id
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The company id
 *     responses:
 *       200:
 *         description: The company was deleted
 *       404:
 *         description: The company was not found
 */
