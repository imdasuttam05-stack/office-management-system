import mongoose from "mongoose";

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not configured");
    }

    const connection = await mongoose.connect(process.env.MONGODB_URI);

    console.log(
      `MongoDB Atlas Connected: ${connection.connection.host}`
    );
  } catch (error) {
    console.error("MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};

export default connectDB;
