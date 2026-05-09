/**
 * Run once to end all abandoned/ghost streams in MongoDB.
 * Usage: cd backend && node scripts/cleanup-abandoned.js
 * 
 * This is safe to run at any time — active streams will be restarted by the host.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lyvstreem');
  console.log('✅ MongoDB connected');

  const Stream = mongoose.model('Stream', new mongoose.Schema({}, { strict: false }), 'streams');
  const User   = mongoose.model('User',   new mongoose.Schema({}, { strict: false }), 'users');

  // End ALL streams marked live
  const all = await Stream.find({ isLive: true }).lean();
  console.log(`Found ${all.length} streams marked as live`);

  let ended = 0;
  for (const s of all) {
    const durSec = s.startedAt
      ? Math.floor((Date.now() - new Date(s.startedAt)) / 1000)
      : 0;
    const durMin = Math.floor(durSec / 60);

    await Stream.updateOne(
      { _id: s._id },
      { $set: { isLive: false, endedAt: new Date(), duration: durSec, viewerCount: 0 } }
    );

    if (durMin > 0 && s.streamerId) {
      await User.updateOne(
        { _id: s.streamerId },
        { $inc: { totalStreamMinutes: durMin, monthlyStreamMinutes: durMin } }
      );
    }

    console.log(`  ✓ Ended: "${s.title || 'Untitled'}" (${durMin}m) — ${s._id}`);
    ended++;
  }

  console.log(`\n✅ Ended ${ended} streams. All ghost sessions cleared.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
