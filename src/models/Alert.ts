import mongoose, { Schema, Document } from "mongoose";
import { Symbols } from "../types/symbols";

export interface IAlert extends Document {
  _id: mongoose.Types.ObjectId;
  symbol: Symbols;
  condition: ">" | "<";
  price: number;
  status: "active" | "triggered";
}

const AlertSchema: Schema = new Schema({
  symbol: {
    type: String,
    enum: Object.values(Symbols),
    required: true,
  },
  condition: { type: String, enum: [">", "<"], required: true },
  price: { type: Number, required: true },
  status: { type: String, enum: ["active", "triggered"], default: "active" },
});

export default mongoose.model<IAlert>("Alert", AlertSchema);
