const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: [true , "Please add a company"]
        },
        totalPrice: {
            type: Number,
            required: [true, "Please add a total price"],
        },
        status: {
            type: String,
            enum: ["initiated","authorized" ,"captured", "cancelled","failed"],
            default: "initiated",
        },
        dateList: {
            type: [Date],
            required: [true, "Please add a list of dates"],
        },
        events: [
            {
                type: { type: String },
                payload: { type: Object },
                createdAt: { type: Date, default: Date.now }
            }
        ],
    },
    {
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
        timestamp: true,
	},
);

module.exports = mongoose.model("Payment", PaymentSchema);