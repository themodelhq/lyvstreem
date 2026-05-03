/**
 * Run once to end all abandoned streams.
 * Usage: cd backend && node scripts/cleanup-abandoned.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Stream   = require('../models/Stream');
const User     = require('../models/User');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lyvstreem');
  console.log('✅ MongoDB connected');

  const all = await Stream.find({ isLive: true });
  console.log(`Found ${all.length} streams marked live`);

  let ended = 0;
  for (const s of all) {
    const durSec = s.startedAt ? Math.floor((Date.now() - new Date(s.startedAt)) / 1000) : 0;
    const durMin = Math.floor(durSec / 60);
    await Stream.findByIdAndUpdate(s._id, { isLive: false, endedAt: new Date(), duration: durSec, viewerCount: 0 });
    if (durMin > 0) await User.findByIdAndUpdate(s.streamerId, { $inc: { totalStreamMinutes: durMin, monthlyStreamMinutes: durMin } });
    console.log(`  ✓ Ended: "${s.title || 'Untitled'}" — ${durMin}m`);
    ended++;
  }
  console.log(`\n🧹 Ended ${ended} abandoned streams`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
