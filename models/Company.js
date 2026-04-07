const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "Please add a name"],
			trim: true,
			maxlength: [50, "Name can not be more than 50 characters"],
		},
		address: {
			type: String,
			required: [true, "Please add an address"],
		},
		district: {
			type: String,
			required: [true, "Please add a district"],
		},
		province: {
			type: String,
			required: [true, "Please add a province"],
		},
		postalcode: {
			type: String,
			required: [true, "Please add a postal code"],
			maxlength: [5, "Postal code must be 5 digits"],
			minlength: [5, "Postal code must be 5 digits"],
		},
		tel: {
			type: String,
			required: [true, "Please add a telephone number"],
		},
		website: {
			type: String,
			required: [true, "Please add a website"],
			match: [
				/^(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/,
				"Please add a valid website URL",
			],
		},
		description: {
			type: String,
			required: [true, "Please add a description"],
		},
	},
	{
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	},
);

// Reverse populate with virtuals
CompanySchema.virtual("bookings", {
	ref: "Booking",
	localField: "_id",
	foreignField: "company",
	justOne: false,
});

module.exports = mongoose.model("Company", CompanySchema);
