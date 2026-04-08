const Company = require("../models/Company");
const Payment = require("../models/Payment");

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

	// Base query with company details populated
	query = Payment.find(JSON.parse(queryStr)).populate("company");

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
		const total = await Payment.countDocuments(JSON.parse(queryStr));
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

		res.status(200).json({ success: true, data: payment });
	} catch (err) {
		res.status(500).json({ success: false, msg: "Cannot fetch Payment" });
		console.log(err);
	}
};

//@desc     Create payment
//@route    POST /api/v1/payments
//@access   Private
exports.createPayment = async (req, res) => {
	try {
		const payment = await Payment.create(req.body);

		res.status(201).json({ success: true, data: payment });
	} catch (err) {
		if (err.name === "ValidationError") {
			const messages = Object.values(err.errors).map((e) => e.message);
			return res.status(400).json({ success: false, msg: messages });
		}
		res.status(500).json({ success: false, msg: "Cannot create Payment" });
	}
};

//@desc     Update payment
//@route    PUT /api/v1/payments/:id
//@access   Private
exports.updatePayment = async (req, res) => {
	try {
		const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, {
			new: true,
			runValidators: true,
		});

		if (!payment) {
			return res.status(404).json({
				success: false,
				msg: `Payment not found with id of ${req.params.id}`,
			});
		}

		res.status(200).json({ success: true, data: payment });
	} catch (err) {
		if (err.name === "ValidationError") {
			const messages = Object.values(err.errors).map((e) => e.message);
			return res.status(400).json({ success: false, msg: messages });
		}
		res.status(500).json({ success: false, msg: "Cannot update Payment" });
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

		res.status(200).json({ success: true, data: {} });
	} catch (err) {
		res.status(500).json({ success: false, msg: "Cannot delete Payment" });
		console.log(err);
	}
};
