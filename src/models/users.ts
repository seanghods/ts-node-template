import mongoose, { Schema, Document, model } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Schema.Types.ObjectId;
  password: string;
  email: string;
  googleId?: string;
  credits?: number;
  responses?: mongoose.Schema.Types.ObjectId[];
  createdAt: string;
  updatedAt: string;
  verified: boolean;
  emailVerificationToken?: string;
  resetToken?: string;
  resetTokenExpires?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    password: { type: String, minlength: 6 },
    email: { type: String },
    googleId: { type: String, required: false },
    credits: { type: Number, required: false },
    verified: { type: Boolean },
    emailVerificationToken: { type: String },
    resetToken: { type: String },
    resetTokenExpires: { type: Date },
    responses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Response",
        required: false,
      },
    ],
  },
  { timestamps: true }
);

const UserModel = model<IUser>("User", UserSchema);

export default UserModel;
