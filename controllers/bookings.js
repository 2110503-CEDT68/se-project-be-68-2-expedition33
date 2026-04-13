const Booking = require("../models/Booking");
const Company = require("../models/Company");

// allowed date range
const START_DATE = new Date("2022-05-10");
const END_DATE = new Date("2022-05-13");

// add const for cleaner code
const isValidBookingDate = (date) => date >= START_DATE && date <= END_DATE;
const isOwnerOrAdmin = async (booking, user) => {
	if (!booking?.user) return false;

	if (user.role === "admin") return true;

	if (user.role === "company") {
		const company = await Company.findOne({ managerAccount: user.id });

		if (!company) {
			return false;
		}

		return booking.company.toString() === company.id;
	}

	return booking.user.toString() === user.id;
};
const getBookingQueryOptions = async (req, parsedQuery, companyId) => {
	if (req.user.role === "admin") {
		if (companyId) parsedQuery.company = companyId;
	} else if (req.user.role === "company") {
		const company = await Company.findOne({ managerAccount: req.user.id });
		if (!company) return null;
		parsedQuery.company = company.id;
	} else {
		parsedQuery.user = req.user.id;
	}

	const companyPopulate = {
		path: "company",
		select:
			"name address district province postalcode tel website description logo photoList",
	};
	const userPopulate = { path: "user", select: "name email" };

	return { parsedQuery, companyPopulate, userPopulate };
};

//@desc     Get all bookings
//@route    GET /api/v1/bookings
//@access   Private
exports.getBookings = async (req, res, next) => {
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

	try {
		const options = await getBookingQueryOptions(
			req,
			parsedQuery,
			req.params.companyId,
		);

		if (!options) {
			return res.status(404).json({
				success: false,
				msg: "No company associated with this account",
			});
		}

		let query = Booking.find(options.parsedQuery)
			.populate(options.companyPopulate)
			.populate(options.userPopulate);

		// Apply sorting/selecting
		if (req.query.select) {
			const fields = req.query.select.split(",").join(" ");
			query = query.select(fields);
		}

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
		const total = await Booking.countDocuments(parsedQuery);

		query = query.skip(startIndex).limit(limit);
		const bookings = await query;

		// Build pagination pointers if applicable
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
			count: bookings.length,
			pagination,
			data: bookings,
		});
	} catch (err) {
		if (err.name === "CastError")
			return res
				.status(400)
				.json({ success: false, msg: "Invalid Company ID" });
		res.status(500).json({ success: false, msg: "Cannot find Booking" });
		console.log(err);
	}
};

//@desc     Get single booking
//@route    GET /api/v1/bookings/:id
//@access   Private
exports.getBooking = async (req, res, next) => {
	try {
		const booking = await Booking.findById(req.params.id).populate({
			path: "company",
			select:
				"name address district province postalcode tel website description",
		});

		if (!booking) {
			return res.status(404).json({
				success: false,
				msg: `No booking with the id of ${req.params.id}`,
			});
		}

		// ownership check
		const isAuthorized = await isOwnerOrAdmin(booking, req.user);
		if (!isAuthorized) {
			return res.status(403).json({
				success: false,
				msg: `Not authorized to view this booking with id of ${req.params.id}`,
			});
		}

		res.status(200).json({ success: true, data: booking });
	} catch (err) {
		res.status(500).json({ success: false, msg: "Cannot find Booking" });
		console.log(err);
	}
};

//@desc     Add booking
//@route    POST /api/v1/companies/:companyId/bookings
//@access   Private
exports.addBooking = async (req, res, next) => {
	try {
		const company = await Company.findById(req.params.companyId);

		if (!company) {
			return res.status(404).json({
				success: false,
				msg: `No company with the id of ${req.params.companyId}`,
			});
		}

		if (!isValidBookingDate(new Date(req.body.bookingDate))) {
			return res.status(400).json({
				success: false,
				msg: "Booking date must be between May 10-13, 2022",
			});
		}

		if (req.user.role !== "admin") {
			const count = await Booking.countDocuments({ user: req.user.id });

			if (count >= 3) {
				return res.status(400).json({
					success: false,
					msg: "User has already made 3 bookings",
				});
			}
		}

		const booking = await Booking.create({
			...req.body,
			company: req.params.companyId,
			user: req.user.id,
		});

		res.status(201).json({ success: true, data: booking });
	} catch (err) {
		if (err.name === "ValidationError")
			return res.status(400).json({ success: false, msg: err.message });
		res.status(500).json({ success: false, msg: "Cannot create Booking" });
		console.log(err);
	}
};

//@desc     Update booking
//@route    PUT /api/v1/bookings/:id
//@access   Private
exports.updateBooking = async (req, res, next) => {
	try {
		let booking = await Booking.findById(req.params.id);

		if (!booking) {
			return res.status(404).json({
				success: false,
				msg: `No booking with the id of ${req.params.id}`,
			});
		}

		const isAuthorized = await isOwnerOrAdmin(booking, req.user);
		if (!isAuthorized) {
			return res.status(403).json({
				success: false,
				msg: `Not authorized to update this booking with id of ${req.params.id}`,
			});
		}

		// validate date if being updated
		if (req.body.bookingDate) {
			const newDate = new Date(req.body.bookingDate);
			if (!isValidBookingDate(newDate)) {
				return res.status(400).json({
					success: false,
					msg: "Booking date must be between May 10-13, 2022",
				});
			}
		}

		booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
			new: true,
			runValidators: true,
		});

		res.status(200).json({ success: true, data: booking });
	} catch (err) {
		if (err.name === "ValidationError")
			return res.status(400).json({ success: false, msg: err.message });
		if (err.name === "CastError")
			return res
				.status(400)
				.json({ success: false, msg: "Invalid Company ID" });
		res.status(500).json({ success: false, msg: "Cannot update Booking" });
		console.log(err);
	}
};

//@desc     Delete booking
//@route    DELETE /api/v1/bookings/:id
//@access   Private
exports.deleteBooking = async (req, res, next) => {
	try {
		const booking = await Booking.findById(req.params.id);

		if (!booking) {
			return res.status(404).json({
				success: false,
				msg: `No booking with the id of ${req.params.id}`,
			});
		}

		const isAuthorized = await isOwnerOrAdmin(booking, req.user);
		if (!isAuthorized) {
			return res.status(403).json({
				success: false,
				msg: `Not authorized to delete this booking with id of ${req.params.id}`,
			});
		}

		await booking.deleteOne();

		res.status(200).json({ success: true, data: {} });
	} catch (err) {
		res.status(500).json({ success: false, msg: "Cannot delete Booking" });
		console.log(err);
	}
};
