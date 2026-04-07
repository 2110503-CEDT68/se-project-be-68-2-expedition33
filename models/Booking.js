const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
	{
		bookingDate: {
			type: Date,
			required: true,
		},
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		company: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Company",
			required: true,
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	},
);

module.exports = mongoose.model("Booking", BookingSchema);
