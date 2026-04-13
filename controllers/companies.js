const mongoose = require("mongoose");
const Company = require("../models/Company");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const User = require("../models/User");

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
		const total = await Company.countDocuments(JSON.parse(queryStr));
		query = query.skip(startIndex).limit(limit);

		// Executing query
		const companies = await query;

		// Pagination result
		const pagination = {};

		if (endIndex < total) {
			pagination.next = { page: page + 1, limit };
		}
		if (startIndex > 0) {
			pagination.prev = { page: page - 1, limit };
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
		const company = await Company.findById(req.params.id).populate("bookings");

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

//@desc		Create a company and automatically register its manager
//@route	POST /api/v1/companies
//@access	Private (Admin only)
exports.createCompany = async (req, res) => {
	const session = await mongoose.startSession();

	try {
		session.startTransaction();

		const { managerTel, password, ...companyData } = req.body;

		// Validations
		if (!managerTel) {
			await session.abortTransaction();
			session.endSession();
			return res.status(400).json({
				success: false,
				msg: "Please provide manager's telephone number to generate the company manager account",
			});
		}

		if (!password) {
			await session.abortTransaction();
			session.endSession();

			return res.status(400).json({
				success: false,
				msg: "Please provide a password to generate the company manager account",
			});
		}

		if (!companyData.name) {
			await session.abortTransaction();
			session.endSession();
			return res
				.status(400)
				.json({ success: false, msg: "Please provide a company name" });
		}

		// Generate user details
		const cleanName = companyData.name
			.replaceAll(/[^a-zA-Z0-9]/g, "")
			.toLowerCase();
		const generatedEmail = `${cleanName}@่jobfair.company`;

		// Check if a user with this auto-generated email already exists
		const existingUser = await User.findOne({ email: generatedEmail }).session(
			session,
		);
		if (existingUser) {
			await session.abortTransaction();
			session.endSession();
			return res.status(400).json({
				success: false,
				msg: `A user with email ${generatedEmail} already exists. Please use a different company name.`,
			});
		}

		// Create the Company Manager User within the transaction
		const newManagerArr = await User.create(
			[
				{
					name: companyData.name,
					email: generatedEmail,
					tel: managerTel,
					password: password,
					role: "company",
				},
			],
			{ session },
		);

		const newManager = newManagerArr[0];
		companyData.managerAccount = newManager._id;

		// Remove the "user" field injected by middleware so it doesn't get saved accidentally
		if (companyData.user) delete companyData.user;

		// Create the new Company within the transaction
		const companyArr = await Company.create([companyData], { session });

		await session.commitTransaction();
		session.endSession();

		res.status(201).json({
			success: true,
			data: companyArr[0],
			managerEmail: newManager.email,
		});
	} catch (err) {
		await session.abortTransaction();
		session.endSession();

		if (err.name === "ValidationError")
			return res.status(400).json({ success: false, msg: err.message });
		res.status(500).json({ success: false, msg: "Cannot create Company" });
		console.log(err);
	}
};

//@desc		Update single company
//@route	PUT /api/v1/companies/:id
//@access	Private (Admin & Company only)
exports.updateCompany = async (req, res) => {
	try {
		// Prevent updating "managerAccount" and injected "user"
		if (req.body.managerAccount) delete req.body.managerAccount;
		if (req.body.user) delete req.body.user;

		// Ignore manager data if someone tries to send it here
		if (req.body.managerTel) delete req.body.managerTel;
		if (req.body.password) delete req.body.password;

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
//@access	Private (Admin & Company only)
exports.deleteCompany = async (req, res) => {
	const session = await mongoose.startSession();

	try {
		session.startTransaction();

		const companyId = req.params.id;
		const company = await Company.findById(companyId).session(session);

		if (!company) {
			await session.abortTransaction();
			session.endSession();

			return res.status(404).json({
				success: false,
				msg: `No company with the id of ${companyId}`,
			});
		}

		// Cascade delete bounded to transaction
		await Booking.deleteMany({ company: companyId }, { session });
		await Payment.deleteMany({ company: companyId }, { session });
		await Company.deleteOne({ _id: companyId }, { session });

		// Delete the manager account
		if (company.managerAccount) {
			await User.deleteOne({ _id: company.managerAccount }, { session });
		}

		await session.commitTransaction();
		session.endSession();

		res.status(200).json({ success: true, data: {} });
	} catch (err) {
		await session.abortTransaction();
		session.endSession();

		if (err.name === "CastError") {
			return res.status(400).json({ success: false, msg: "Invalid ID" });
		}

		res.status(500).json({ success: false, msg: "Cannot delete Company" });
		console.log(err);
	}
};
