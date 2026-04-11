const Company = require("../models/Company");
const Payment = require("../models/Payment");

// allowed date range
const START_DATE = new Date("2022-05-10");
const END_DATE = new Date("2022-05-13");

// price per organized day
const DEFAULT_DAILY_RATE = 100; // Default daily rate waiting for SUA AND PI MAX

// add const for cleaner code
const isValidPaymentDate = (date) => date >= START_DATE && date <= END_DATE;
const toDateKey = (date) => date.toISOString().split("T")[0]; // "YYYY-MM-DD"
const statusLog = (oldStatus, newStatus) => {
	if (oldStatus === null && newStatus == "initiated") {
		return "PAYMENT_INITIATED";
	} else if (oldStatus == "initiated" && newStatus == "authorized") {
		return "PAYMENT_AUTHORIZED";
	} else if (oldStatus == "authorized" && newStatus == "captured") {
		return "PAYMENT_SUCCESS";
	} else if (oldStatus == "authorized" && newStatus == "failed") {
		return "PAYMENT_FAILED";
	} else if (oldStatus == "authorized" && newStatus == "cancelled") {
		return "PAYMENT_CANCELLED";
	} else {
		return null;
	}
};
const authorizePayment = async (req, payment) => {
	if (req.user.role === "admin") return true;

	if (req.user.role === "company") {
		const company = await Company.findOne({ managerAccount: req.user.id });

		return payment.company.toString() === company?.id;
	}

	return false;
};

//@desc		Get all payments
//@route	GET /api/v1/payments
//@access	Private
exports.getPayments = async (req, res) => {
	let query;

	// Copy req.query to avoid mutating the original
	const reqQuery = { ...req.query };

	// Exclude non-filter fields before building the query
	const removeFields = ["select", "sort", "page", "limit"];
	removeFields.forEach((param) => delete reqQuery[param]);

	// Stringify and inject MongoDB operators (e.g. gt -> $gt)
	let queryStr = JSON.stringify(reqQuery);
	queryStr = queryStr.replaceAll(
		/\b(gt|gte|lt|lte|in)\b/g,
		(match) => `$${match}`,
	);
	const parsedQuery = JSON.parse(queryStr);

	// Filter for company payments viewing
	if (req.user.role === "company") {
		const company = await Company.findOne({ managerAccount: req.user.id });

		if (!company) {
			return res
				.status(404)
				.json({ success: false, msg: "No company found for this user" });
		}

		parsedQuery.company = company.id;
	}

	// Base query with company details populated
	query = Payment.find(JSON.parse(parsedQuery)).populate("company");

	// Apply field selection if specified
	if (req.query.select) {
		const fields = req.query.select.split(",").join(" ");
		query = query.select(fields);
	}

	// Apply sorting or default to newest first
	if (req.query.sort) {
		const sortBy = req.query.sort.split(",").join(" ");
		query = query.sort(sortBy);
	} else {
		query = query.sort("-createdAt");
	}

	// Pagination setup
	const page = Number.parseInt(req.query.page, 10) || 1;
	const limit = Number.parseInt(req.query.limit, 10) || 25;
	const startIndex = (page - 1) * limit;
	const endIndex = page * limit;

	try {
		const total = await Payment.countDocuments(parsedQuery);
		query = query.skip(startIndex).limit(limit);

		const payments = await query;

		// Build pagination pointers if applicable
		const pagination = {};

		if (endIndex < total) {
			pagination.next = { page: page + 1, limit };
		}
		if (startIndex > 0) {
			pagination.prev = { page: page - 1, limit };
		}

		res.status(200).json({
			success: true,
			count: payments.length,
			pagination,
			data: payments,
		});
	} catch (err) {
		res.status(500).json({ success: false, msg: "Cannot fetch Payments" });
		console.log(err);
	}
};

//@desc		Get single payment
//@route	GET /api/v1/payments/:id
//@access	Private
exports.getPayment = async (req, res) => {
	try {
		const payment = await Payment.findById(req.params.id);

		if (!payment) {
			return res.status(404).json({
				success: false,
				msg: `Payment not found with id of ${req.params.id}`,
			});
		}

		const isAuthorized = await authorizePayment(req, payment);
		if (!isAuthorized) {
			return res.status(403).json({
				success: false,
				msg: "Not authorized to access this payment",
			});
		}

		res.status(200).json({ success: true, data: payment });
	} catch (err) {
		res.status(500).json({ success: false, msg: "Cannot fetch Payment" });
		console.log(err);
	}
};

//@desc     Add a payment item
//@route    POST /api/v1/companies/:companyId/payments
//@access   Private
exports.addPayment = async (req, res) => {
	try {
		const companyId = req.params.companyId;
		const company = await Company.findById(companyId);

		if (!company) {
			return res.status(404).json({
				success: false,
				msg: `No company with the id of ${req.params.companyId}`,
			});
		}

		if (
			req.user.role === "company" &&
			company.managerAccount.toString() !== req.user.id
		) {
			return res.status(403).json({
				success: false,
				msg: "Not authorized to add payment for this company",
			});
		}

		const { dateList } = req.body;

		if (!dateList || !Array.isArray(dateList) || dateList.length === 0) {
			return res
				.status(400)
				.json({ success: false, msg: "dateList must be a non-empty array" });
		}

		const normalizedDates = [];
		const uniqueDateKeys = new Set();

		for (const d of dateList) {
			const parsed = new Date(d);
			if (Number.isNaN(parsed.getTime())) {
				return res.status(400).json({
					success: false,
					msg: `Invalid date format: ${d}`,
				});
			}

			if (!isValidPaymentDate(parsed)) {
				return res.status(400).json({
					success: false,
					msg: `Date ${d} is out of allowed range (May 10-13, 2022)`,
				});
			}

			const dayKey = toDateKey(parsed);
			if (!uniqueDateKeys.has(dayKey)) {
				uniqueDateKeys.add(dayKey);
				normalizedDates.push(new Date(dayKey));
			}
		}

		const totalPrice = normalizedDates.length * DEFAULT_DAILY_RATE;
		const payment = await Payment.create({
			company: companyId,
			dateList: normalizedDates,
			totalPrice,
			status: "initiated",
			events: [
				{
					eventType: "PAYMENT_INITIATED",
					payload: { oldStatus: null, newStatus: "initiated" },
				},
			],
		});

		res.status(201).json({ success: true, data: payment });
	} catch (err) {
		if (err.name === "ValidationError") {
			const messages = Object.values(err.errors).map((e) => e.message);
			return res.status(400).json({ success: false, msg: messages });
		}
		res.status(500).json({ success: false, msg: "Cannot create Payment" });
		console.log(err); // for TESTER AND DEV to debug if needed
	}
};

//@desc     Update payment
//@route    PUT /api/v1/payments/:id
//@access   Private
exports.updatePayment = async (req, res) => {
	try {
		const payment = await Payment.findById(req.params.id);

		if (!payment) {
			return res.status(404).json({
				success: false,
				msg: `Payment not found with id of ${req.params.id}`,
			});
		}

		const isAuthorized = await authorizePayment(req, payment);
		if (!isAuthorized) {
			return res.status(403).json({
				success: false,
				msg: "Not authorized to update this payment",
			});
		}

		const { status, errorMessage, transactionId } = req.body;

		if (status && status !== payment.status) {
			const oldStatus = payment.status;
			const eventType = statusLog(oldStatus, status);

			if (!eventType) {
				return res.status(400).json({
					success: false,
					msg: `Invalid payment trasition from " + ${oldStatus} + " to ${status}?!?!? 😠 ⚠️⚠️⚠️ HACKER ALERT ⚠️⚠️⚠️!!!!`,
				});
			}

			// Change payment status & add event log
			payment.status = status;
			payment.events.push({
				eventType,
				payload: {
					oldStatus,
					newStatus: status,
					errorMessage: errorMessage || null,
					transactionId: transactionId || null,
				},
			});

			await payment.save();
		}

		res.status(200).json({ success: true, data: payment });
	} catch (err) {
		if (err.name === "ValidationError") {
			const messages = Object.values(err.errors).map((e) => e.message);
			return res.status(400).json({ success: false, msg: messages });
		}
		res.status(500).json({ success: false, msg: "Cannot update Payment" });
		console.log(err);
	}
};

//@desc     Delete payment
//@route    DELETE /api/v1/payments/:id
//@access   Private
exports.deletePayment = async (req, res) => {
	try {
		const payment = await Payment.findByIdAndDelete(req.params.id);

		if (!payment) {
			return res.status(404).json({
				success: false,
				msg: `Payment not found with id of ${req.params.id}`,
			});
		}

		const isAuthorized = await authorizePayment(req, payment);
		if (!isAuthorized) {
			return res.status(403).json({
				success: false,
				msg: "Not authorized to delete this payment",
			});
		}

		res.status(200).json({ success: true, data: {} });
	} catch (err) {
		res.status(500).json({ success: false, msg: "Cannot delete Payment" });
		console.log(err); // FOR PASIT
	}
};
