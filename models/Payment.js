const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
    {
        company: {
            type: String,
            required: [true, "Please add a company name"],
        },
        totalPrice: {
            type: Number,
            required: [true, "Please add a total price"],
        },
        status: {
            type: String,
            enum: ["pending", "paid", "cancelled"],
            default: "pending",
        },
        dateList: {
            type: [Date],
            required: [true, "Please add a list of dates"],
        },
        updateAt: {
            type: Date,
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

module.exports = mongoose.model("Payment", PaymentSchema);const mongoose = require("mongoose");