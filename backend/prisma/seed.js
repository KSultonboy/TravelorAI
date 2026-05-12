async function main() {
  console.log('Prisma seed skipped: TravelorAI does not ship static content.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
