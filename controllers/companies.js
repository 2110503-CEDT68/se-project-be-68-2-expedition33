const mongoose = require("mongoose");
const Company = require("../models/Company");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const { Readable } = require("node:stream");

// Helper to handle Cloudinary's Upload
const uploadToCloudinary = (fileBuffer, folder) => {
	return new Promise((resolve, reject) => {
		const cld_upload_stream = cloudinary.uploader.upload_stream(
			{ folder: `jobfair/${folder}` },
			(error, result) => {
				if (result) {
					resolve({
						url: result.secure_url,
						public_id: result.public_id,
					});
				} else {
					reject(new Error(error?.message || "Upload failed"));
				}
			},
		);
		Readable.from(fileBuffer).pipe(cld_upload_stream);
	});
};

// Helper to handle file uploads
const processFileUploads = async (files) => {
	const results = {};
	const newPublicIds = [];

	if (!files) return { results, newPublicIds };

	// Process Logo
	if (files.logo?.[0]) {
		const res = await uploadToCloudinary(files.logo[0].buffer, "logos");
		results.logo = { url: res.url, public_id: res.public_id };
		newPublicIds.push(res.public_id);
	}

	// Process Photo List
	if (files.photoList?.length > 0) {
		results.photoList = [];
		for (const file of files.photoList) {
			const res = await uploadToCloudinary(file.buffer, "galleries");
			results.photoList.push({ url: res.url, public_id: res.public_id });
			newPublicIds.push(res.public_id);
		}
	}

	return { results, newPublicIds };
};

// Helper to create manager user
const createManagerUser = async (
	companyData,
	managerTel,
	password,
	session,
) => {
	const cleanName = companyData.name
		.replaceAll(/[^a-zA-Z0-9]/g, "")
		.toLowerCase();
	const generatedEmail = `${cleanName}@jobfair.company`;

	// Check if a user with this auto-generated email already exists
	const existingUser = await User.findOne({ email: generatedEmail }).session(
		session,
	);
	if (existingUser) {
		const error = new Error(
			`User with email ${generatedEmail} already exists.`,
		);
		error.name = "ValidationError";
		throw error;
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

	return newManagerArr[0];
};

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
	let uploadedPublicIds = [];

	try {
		session.startTransaction();

		const { managerTel, password, ...companyData } = req.body;

		// Validations (for critical fields)
		if (!managerTel || !password || !companyData.name) {
			const error = new Error(
				"Missing required fields: name, managerTel, or password",
			);
			error.name = "ValidationError";
			throw error;
		}

		// Handle File Uploads to Cloudinary
		const { results, newPublicIds } = await processFileUploads(req.files);
		Object.assign(companyData, results);
		uploadedPublicIds = newPublicIds;

		// Create the Company Manager User within the transaction
		const newManager = await createManagerUser(
			companyData,
			managerTel,
			password,
			session,
		);

		companyData.managerAccount = newManager._id;

		// Remove the "user" field injected by middleware so it doesn't get saved accidentally
		delete companyData.user;

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

		if (uploadedPublicIds.length > 0) {
			const deletePromises = uploadedPublicIds.map((publicId) =>
				cloudinary.uploader.destroy(publicId),
			);
			await Promise.all(deletePromises);
		}

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
		// Prevent updating sensitive fields
		delete req.body.managerAccount;
		delete req.body.user;
		delete req.body.managerTel;
		delete req.body.password;

		// Handle new file uploads if provided
		const { results } = await processFileUploads(req.files);
		Object.assign(req.body, results);

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

		// Delete logo and photos from Cloudinary
		const idsToDelete = [];
		if (company.logo?.public_id) idsToDelete.push(company.logo.public_id);
		if (company.photoList?.length > 0) {
			company.photoList.forEach((photo) => idsToDelete.push(photo.public_id));
		}

		if (idsToDelete.length > 0) {
			await Promise.all(
				idsToDelete.map((id) => cloudinary.uploader.destroy(id)),
			);
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
