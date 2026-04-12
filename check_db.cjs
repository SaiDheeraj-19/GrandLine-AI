const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function check() {
  const issues = await db.collection("issues").get();
  console.log(`CRITICAL CHECK: Found ${issues.size} issues in database.`);
  issues.forEach(doc => console.log(` - Issue ID: ${doc.id}`));
  process.exit(0);
}

check();
