/**
 * GRANDLINE AI — DEMO USER CREATOR
 * Uses the Firebase Admin SDK to create demo accounts for the hackathon.
 */

const admin = require("firebase-admin");

try {
  const serviceAccount = require("./serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (err) {
  console.error("ERROR: serviceAccountKey.json not found.");
  process.exit(1);
}

const auth = admin.auth();

const DEMO_USERS = [
  {
    email: "admin@grandline.ai",
    password: "Password@123",
    displayName: "Field Commander",
  },
  {
    email: "volunteer@grandline.ai",
    password: "Password@123",
    displayName: "Tactical Responder",
  }
];

async function createUsers() {
  console.log("Creating demo accounts...");
  
  for (const user of DEMO_USERS) {
    try {
      const userRecord = await auth.createUser({
        email: user.email,
        password: user.password,
        displayName: user.displayName,
      });
      console.log(`Successfully created user: ${userRecord.email}`);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log(`User already exists: ${user.email}`);
      } else {
        console.error(`Error creating user ${user.email}:`, error.message);
      }
    }
  }
  
  console.log("\n--- DEMO LOGINS ---");
  DEMO_USERS.forEach(u => {
    console.log(`Email: ${u.email} | Password: ${u.password}`);
  });
  
  process.exit(0);
}

createUsers();
