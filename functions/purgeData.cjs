const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteCollection(collectionPath, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  let snapshot = await collectionRef.orderBy('__name__').limit(batchSize).get();

  while (snapshot.size > 0) {
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`   - Deleted ${snapshot.size} docs from ${collectionPath}`);
    snapshot = await collectionRef.orderBy('__name__').limit(batchSize).get();
  }
}

async function purgeAll() {
  const collections = [
    'volunteers',
    'issues',
    'assistance_requests',
    'notifications',
    'events',
    'reports'
  ];

  console.log('🚀 INITIALIZING DATA PURGE...');

  for (const coll of collections) {
    console.log(`🗑️  Targeting collection: ${coll}...`);
    const snap = await db.collection(coll).limit(1).get();
    if (snap.empty) {
      console.log(`⏩ ${coll} is already empty. Skipping.`);
      continue;
    }
    await deleteCollection(coll);
    console.log(`✅ Purged ${coll}.`);
  }

  // Also purge dynamic comms collections
  console.log('📡 Scanning for communication channels...');
  const collectionsList = await db.listCollections();
  for (const coll of collectionsList) {
    if (coll.id.startsWith('comms_state_')) {
      console.log(`🗑️  Purging channel: ${coll.id}...`);
      await deleteCollection(coll.id);
    }
  }

  console.log('🏁 PURGE COMPLETED. Environment is clean.');
  process.exit(0);
}

purgeAll().catch(err => {
  console.error('❌ PURGE FAILED:', err);
  process.exit(1);
});
