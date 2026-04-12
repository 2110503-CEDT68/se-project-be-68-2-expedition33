const Company = require("../models/Company");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");

//@desc		Get all companies
//@route	GET /api/v1/companies
//@access	Public
exports.getCompanies = async (req, res, next) => {
	let query;

	// Copy req.query
	const reqQuery = { ...req.query };

	// Fields to exclude
	const removeFields = ["select", "sort", "page", "limit"];

	// Loop over remove fields and delete them from reqQuery
	removeFields.forEach((param) => delete reqQuery[param]);

	// Create query string
	let queryStr = JSON.stringify(reqQuery);

	// Create operators ($gt, $gte, $lt, $lte, $in)
	queryStr = queryStr.replaceAll(
		/\b(gt|gte|lt|lte|in)\b/g,
		(match) => `$${match}`,
	);

	// Finding resource
	query = Company.find(JSON.parse(queryStr)).populate("bookings");

	// Select fields
	if (req.query.select) {
		const fields = req.query.select.split(",").join(" ");
		query = query.select(fields);
	}

	// Sort
	if (req.query.sort) {
		const sortBy = req.query.sort.split(",").join(" ");
		query = query.sort(sortBy);
	} else {
		query = query.sort("-createdAt");
	}

	// Pagination
	const page = Number.parseInt(req.query.page, 10) || 1;
	const limit = Number.parseInt(req.query.limit, 10) || 25;
	const startIndex = (page - 1) * limit;
	const endIndex = page * limit;

	try {
		const total = await Company.countDocuments();

		query = query.skip(startIndex).limit(limit);

		// Executing query
		const companies = await query;

		// Pagination result
		const pagination = {};

		if (endIndex < total) {
			pagination.next = {
				page: page + 1,
				limit,
			};
		}

		if (startIndex > 0) {
			pagination.prev = {
				page: page - 1,
				limit,
			};
		}

		res.status(200).json({
			success: true,
			count: companies.length,
			pagination,
			data: companies,
		});
	} catch (err) {
		res.status(500).json({ success: false, msg: "Cannot fetch Companies" });
		console.log(err);
	}
};

//@desc		Get single company
//@route	GET /api/v1/companies/:id
//@access	Public
exports.getCompany = async (req, res) => {
	try {
		const company = await Company.findById(req.params.id);

		if (!company) {
			return res.status(404).json({
				success: false,
				msg: `No company with the id of ${req.params.id}`,
			});
		}

		res.status(200).json({ success: true, data: company });
	} catch (err) {
		if (err.name === "CastError")
			return res.status(400).json({ success: false, msg: "Invalid ID" });
		res.status(500).json({ success: false, msg: "Cannot fetch Company" });
		console.log(err);
	}
};

//@desc		Create a company
//@route	POST /api/v1/companies
//@access	Private
exports.createCompany = async (req, res) => {
	try {
		const company = await Company.create(req.body);
		res.status(201).json({ success: true, data: company });
	} catch (err) {
		if (err.name === "ValidationError")
			return res.status(400).json({ success: false, msg: err.message });
		res.status(500).json({ success: false, msg: "Cannot create Company" });
		console.log(err);
	}
};

//@desc		Update single company
//@route	PUT /api/v1/companies/:id
//@access	Private
exports.updateCompany = async (req, res) => {
	try {
		const company = await Company.findByIdAndUpdate(req.params.id, req.body, {
			new: true,
			runValidators: true,
		});

		if (!company) {
			return res.status(404).json({
				success: false,
				msg: `No company with the id of ${req.params.id}`,
			});
		}

		return res.status(200).json({ success: true, data: company });
	} catch (err) {
		if (err.name === "ValidationError")
			return res.status(400).json({ success: false, msg: err.message });
		if (err.name === "CastError")
			return res.status(400).json({ success: false, msg: "Invalid ID" });
		res.status(500).json({ success: false, msg: "Cannot update Company" });
		console.log(err);
	}
};

//@desc		Delete single company
//@route	DELETE /api/v1/companies/:id
//@access	Private
exports.deleteCompany = async (req, res) => {
	try {
		session.startTransaction();

		const companyId = req.params.id;
		const company = await Company.findById(companyId);

		if (!company) {
			return res.status(404).json({
				success: false,
				msg: `No company with the id of ${companyId}`,
			});
		}

		// Cascade delete to bookings, payments and then delete company
		await Booking.deleteMany({ company: companyId });
		await Payment.deleteMany({ company: companyId });
		await Company.deleteOne({ _id: companyId });

		await session.commitTransaction();
		res.status(200).json({ success: true, data: {} });
	} catch (err) {
		if (session.inTransaction()) {
			await session.abortTransaction();
		}

		if (err.name === "CastError") {
			return res.status(400).json({ success: false, msg: "Invalid ID" });
		}

		if (err.statusCode) {
			return res.status(err.statusCode).json({
				success: false,
				msg: err.message,
			});
		}

		res.status(500).json({
			success: false,
			msg: "Cannot delete Company",
		});
		console.log(err);
	} finally {
		await session.endSession();
	}
};
