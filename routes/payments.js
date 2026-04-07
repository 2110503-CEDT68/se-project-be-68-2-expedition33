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
