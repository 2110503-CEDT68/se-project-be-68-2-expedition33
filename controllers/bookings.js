const Booking = require("../models/Booking");
const Company = require("../models/Company");

// allowed date range
const START_DATE = new Date("2022-05-10");
const END_DATE = new Date("2022-05-13");

// add const for cleaner code
const isValidBookingDate = (date) => date >= START_DATE && date <= END_DATE;
const isOwnerOrAdmin = (booking, user) =>
	booking &&
	booking.user &&
	(booking.user.toString() === user.id || user.role === "admin");

//@desc     Get all bookings
//@route    GET /api/v1/bookings
//@access   Private
exports.getBookings = async (req, res, next) => {
	let query;
	const companyPopulate = {
		path: "company",
		select: "name address district province postalcode tel website description",
	};
	const userPopulate = { path: "user", select: "name email" };

	if (req.user.role !== "admin") {
		query = Booking.find({ user: req.user.id })
			.populate(companyPopulate)
			.populate(userPopulate);
	} else {
		if (req.params.companyId) {
			query = Booking.find({ company: req.params.companyId })
				.populate(companyPopulate)
				.populate(userPopulate);
		} else {
			query = Booking.find().populate(companyPopulate).populate(userPopulate);
		}
	}

	try {
		const bookings = await query;
		res.status(200).json({
			success: true,
			count: bookings.length,
			data: bookings,
		});
	} catch (err) {
		if (err.name === "CastError")
			return res
				.status(400)
				.json({ success: false, msg: "Invalid Company ID" });
		res.status(500).json({ success: false, msg: "Cannot find Booking" });
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
		if (!isOwnerOrAdmin(booking, req.user)) {
			return res.status(403).json({
				success: false,
				msg: `Not authorized to view this booking with id of ${req.params.id}`,
			});
		}

		res.status(200).json({ success: true, data: booking });
	} catch (err) {
		res.status(500).json({ success: false, msg: "Cannot find Booking" });
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

		if (!isOwnerOrAdmin(booking, req.user)) {
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

		if (!isOwnerOrAdmin(booking, req.user)) {
			return res.status(403).json({
				success: false,
				msg: `Not authorized to delete this booking with id of ${req.params.id}`,
			});
		}

		await booking.deleteOne();

		res.status(200).json({ success: true, data: {} });
	} catch (err) {
		res.status(500).json({ success: false, msg: "Cannot delete Booking" });
	}
};
