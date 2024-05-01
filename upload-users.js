import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from './models/user.js';  // Adjust the path according to your project structure
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const usersData = JSON.parse(fs.readFileSync('data/users.json', 'utf8'));

const uploadUsers = async () => {
  try {
    await mongoose.connect(process.env.DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // Optional: Clear the existing users if needed
    await User.deleteMany({});

    for (const userData of usersData) {
      const hashedPassword = bcrypt.hashSync(userData.password, 10);
      const user = new User({ email: userData.email, username: userData.username, password: hashedPassword, role: userData.role, grade: userData.grade });
      await user.save();
    }

    console.log('Users uploaded successfully!');
    mongoose.disconnect();
  } catch (err) {
    console.error('Failed to upload users', err);
    process.exit(1);
  }
};

uploadUsers();
