const url = 'https://places.googleapis.com/v1/places:searchText';

const key = process.env.GOOGLE_PLACES_API_KEY || '';

async function main() {
  try {
    const body = {
      textQuery: 'Khiva tourist attractions',
      maxResultCount: 1,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location',
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log('status', res.status);
    console.log(text.slice(0, 500));
  } catch (err) {
    console.error('fetch-error', err?.message || String(err));
    if (err?.cause) {
      console.error('fetch-cause', err.cause?.message || String(err.cause));
    }
    process.exit(1);
  }
}

main();
