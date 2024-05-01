import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  studentClass: { type: String, required: true },
  advisorNotified: { type: Boolean, default: false },
  emailSent: { type: Boolean, default: false },
  letterSent: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  grade: Number,
  notifications: [notificationSchema]
});

const User = mongoose.model('User', userSchema);

export default User;
