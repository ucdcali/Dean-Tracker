import express from 'express';
import bcrypt from 'bcrypt';
import csv from 'csv-parser';
import fs from 'fs';
import fetch from 'node-fetch';  // Add this if using fetch in Node.js
import User from '../models/user.js';

const router = express.Router();

// Home Page
router.get('/', (req, res) => {
  if (req.session.loggedIn) res.redirect('/dashboard'); 
  else res.redirect('/login');
});

// Login Page
router.get('/login', (req, res) => {
  res.render('login', {message: ""});
});

// Login Handler
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.user = user;
    req.session.loggedIn = true;    
    res.redirect('/dashboard'); // redirect to the dashboard after login
  } else {
    res.render('login', {message: "Login Failed"}); // redirect back to login if failed
  }
});

// Dashboard Page with server-side aggregation and filtering
router.get('/dashboard', async (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect('/login');  // Ensure the user is logged in
  }

//  console.log(req.session.user)
  let { filter, count } = req.query;  // Capture filter parameters from query string
  if (!filter) filter = "All";
  if (!count) count = "All";
  
  try {
    const apiUrl = `http://localhost:3000/api/attendance?grade=${encodeURIComponent(req.session.user.grade)}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
        throw new Error('Failed to fetch data from API');
    }
    const students = await response.json();

    // Aggregate data by person and class
    const aggregatedData = students.reduce((acc, item) => {
      const key = `${item.Person} - ${item.Class}`;
      if (!acc[key]) {
        acc[key] = {};
      }
      if (!acc[key][item['Attendance Category']]) {
        acc[key][item['Attendance Category']] = 0;
      }
      acc[key][item['Attendance Category']]++;
      return acc;
    }, {});

    // Apply filters if specified
    // Apply filters if specified
    let filteredData = aggregatedData;
    if (filter !== 'All' && count !== 'All') {
      // Apply both type and count filters
      filteredData = Object.entries(aggregatedData).reduce((filtered, [key, categories]) => {
        if (categories[filter] >= parseInt(count)) {
          filtered[key] = categories;
        }
        return filtered;
      }, {});
    } else if (filter !== 'All') {
      // Apply only type filter and ignore count
      filteredData = Object.entries(aggregatedData).reduce((filtered, [key, categories]) => {
        if (categories[filter] > 0) {
          filtered[key] = categories;
        }
        return filtered;
      }, {});
    } else if (count !== 'All') {
      // Apply only count filter across all possible types
      filteredData = Object.entries(aggregatedData).reduce((filtered, [key, categories]) => {
        let categoryMeetsThreshold = Object.entries(categories).some(([category, num]) => num >= parseInt(count));
        if (categoryMeetsThreshold) {
          filtered[key] = categories;
        }
        return filtered;
      }, {});
    } 
    console.log(req.session);
    res.render('dashboard', {
      user: req.session.user,
      attendance: filteredData,
      currentFilter: { type: filter, threshold: count }
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).send('Error loading the dashboard');
  }
});

router.post('/update-notification', async (req, res) => {
  const { studentClass, field, value } = req.body;
  console.log(studentClass);
  console.log(field);
  console.log(value);
  
  if (!req.session || !req.session.user._id) {
    return res.status(401).send({ status: 'error', message: 'User not logged in' });
  }

  try {
    // Check if the user has the studentClass in their notifications
    const user = await User.findOne({
      _id: req.session.user._id,
      "notifications.studentClass": studentClass
    });
    console.log("User: " + user);
    
    if (!user) {
      // If the studentClass is not found, add it
      await User.updateOne(
        { _id: req.session.user._id },
        {
          $push: {
            notifications: {
              studentClass: studentClass,
              advisorNotified: false,
              emailSent: false,
              letterSent: false,
              [field]: value  // Initialize the specific field with the given value
            }
          }
        }
      );
    } else {
      // If the studentClass is found, update the specific field
      await User.updateOne(
        { _id: req.session.user._id, "notifications.studentClass": studentClass },
        { $set: { [`notifications.$.${field}`]: value } }
      );
    }

    res.send({ status: 'success', message: 'Notification updated successfully' });
  } catch (error) {
    console.error('Failed to update notification:', error);
    res.status(500).send({ status: 'error', message: 'Failed to update notification' });
  }
});

router.get('/student/:name', async (req, res) => {
  const studentName = decodeURIComponent(req.params.name); // Decode the URL-encoded name
  try {
    // Assuming cachedData or a function to fetch and parse the CSV is available
    const data = cachedData || await parseCSV('data/attendance-upload.csv');
    cachedData = cachedData || data; // Update cache if needed

    // Filter and aggregate data for the specified student
    const filteredData = data.filter(item => item['Person'] === studentName);
    const advisor = filteredData[0]['PERSON: Advisor'];
    const aggregatedData = filteredData.reduce((acc, item) => {
      const className = item['Class'];
      if (!acc[className]) {
          acc[className] = { Absences: 0, Tardies: 0 };
      }
      if (item['Attendance Category'] === 'Absence') {
          acc[className].Absences++;
      }
      if (item['Attendance Category'] === 'Tardy') {
          acc[className].Tardies++;
      }
      return acc;
    }, {});

    // Render the student EJS page with the aggregated data
    res.render('student', {
      studentName: studentName,
      classes: aggregatedData,
      advisor
    });
  } catch (error) {
    console.error('Error retrieving student data:', error);
    res.status(500).send('Error loading student information');
  }
});

// Global cache for CSV data
let cachedData = null;

// Array of fake female names
const fakeNames = [
  "Smith, Jane", "Johnson, Mary", "Williams, Patricia", "Brown, Linda", "Jones, Barbara", "Garcia, Elizabeth",
  "Miller, Jennifer", "Davis, Maria", "Rodriguez, Susan", "Martinez, Margaret", "Hernandez, Dorothy",
  "Lopez, Lisa", "Wilson, Nancy", "Anderson, Karen", "Thomas, Betty", "Taylor, Helen", "Moore, Sandra",
  "Jackson, Donna", "Martin, Carol", "Lee, Ruth", "Perez, Sharon", "Thompson, Michelle", "White, Laura",
  "Harris, Sarah", "Sanchez, Kimberly", "Clark, Deborah", "Ramirez, Jessica", "Lewis, Shirley",
  "Robinson, Cynthia", "Walker, Angela", "Young, Melissa", "Allen, Brenda", "King, Amy", "Wright, Anna",
  "Scott, Rebecca", "Torres, Virginia", "Nguyen, Kathleen", "Hill, Pamela", "Flores, Martha", "Green, Debra"
];

// Function to parse CSV and convert to JSON
async function parseCSV(filePath) {
  if (cachedData) {
    return cachedData;  // Use cached data if available
  }

  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        // Update the global cache and map data to replace each person's name with a random name
//        cachedData = results;
        cachedData = results.map(item => ({
          ...item,
          Person: fakeNames[Math.floor(Math.random() * fakeNames.length)] // Randomly select a name
        }));
        resolve(cachedData);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

// API Route to provide JSON data
router.get('/api/attendance', async (req, res) => {
  try {
    const { grade, student, attendanceType } = req.query;  // Destructure query parameters

    const data = cachedData || await parseCSV('data/attendance-upload.csv');
    cachedData = cachedData || data;
    
    let filteredData = data;
    if (grade) {
      filteredData = filteredData.filter(item => item['PERSON: Grade'] === grade);
    }
    if (student) {
      filteredData = filteredData.filter(item => item['Person'] === student);
    }
    if (attendanceType) {
      filteredData = filteredData.filter(item => item['Attendance Category'] === attendanceType);
    }

    res.json(filteredData.length > 0 ? filteredData : []);
  } catch (error) {
    console.error('Failed to parse CSV file:', error);
    res.status(500).json({ error: 'Failed to parse CSV file' });
  }
});

export default router;
