const mongoose = require("mongoose");
const driveRegex = /^https?:\/\/(?:drive|docs)\.google\.com\/.+/; // Regex for Google Drive / Docs

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
				/^(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)$/,
				"Please add a valid website URL",
			],
		},
		description: {
			type: String,
			required: [true, "Please add a description"],
		},
		managerAccount: {
			type: mongoose.Schema.ObjectId,
			ref: "User",
			required: [true, "Please assign a manager account to this company"],
		},
		logo: {
			type: String,
			default: null,
			match: [driveRegex, "Please add a valid Google Drive link for the logo"],
		},
		photoList: {
			type: [String],
			default: [],
			validate: {
				validator: function (list) {
					if (!list || list.length === 0) return true; // Allow empty list (photos are optional)

					return list.every((url) => driveRegex.test(url));
				},
				message: "All items in photoList must be valid Google Drive links",
			},
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
