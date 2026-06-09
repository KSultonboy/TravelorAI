const { deleteMaterializedImage, hasValidSignature, materializeDataImage } = require('../src/utils/dataImage');

describe('data image validation', () => {
  test('recognizes supported image signatures', () => {
    expect(hasValidSignature(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg')).toBe(true);
    expect(
      hasValidSignature(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        'image/png'
      )
    ).toBe(true);
    expect(hasValidSignature(Buffer.from('GIF89a', 'ascii'), 'image/gif')).toBe(true);
    expect(hasValidSignature(Buffer.from('RIFFxxxxWEBP', 'ascii'), 'image/webp')).toBe(true);
  });

  test('rejects content that is only labeled as an image', async () => {
    const fakeImage = Buffer.from('<script>alert(1)</script>').toString('base64');
    await expect(
      materializeDataImage(`data:image/png;base64,${fakeImage}`, 'test')
    ).rejects.toThrow('Rasm tarkibi tanlangan formatga mos emas');
  });
});

test('deleteMaterializedImage only deletes managed agency uploads', async () => {
  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const image = `data:image/png;base64,${pngBuffer.toString('base64')}`;
  const storedPath = await materializeDataImage(image, 'agency');

  await expect(deleteMaterializedImage(storedPath, 'agency')).resolves.toBe(true);
  await expect(deleteMaterializedImage(storedPath, 'agency')).resolves.toBe(false);
  await expect(deleteMaterializedImage('https://example.com/image.png', 'agency')).resolves.toBe(false);
  await expect(deleteMaterializedImage('/uploads/agency/../secret.txt', 'agency')).resolves.toBe(false);
});
