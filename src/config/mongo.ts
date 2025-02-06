import mongoose from "mongoose";

// MongoDB Connection Function
const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI as string,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      } as mongoose.ConnectOptions
    );
    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1); // Exit the process if DB connection fails
  }
};

export default connectDB;
