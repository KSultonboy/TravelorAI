async function seedDatabase() {
  console.log('Seed skipped: static destinations, POIs, agencies, tours and routes are not bundled.');
  return { skipped: true };
}

if (require.main === module) {
  seedDatabase().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

module.exports = { seedDatabase };
