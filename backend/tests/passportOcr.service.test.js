const { parsePassportMrz, mrzDate } = require('../src/services/passportOcr.service');

test('TD3 pasport MRZ satridan asosiy maydonlar ajratiladi', () => {
  const result = parsePassportMrz([
    'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
    'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
  ].join('\n'), 92);
  expect(result).toMatchObject({
    countryCode: 'UTO', passportNumber: 'L898902C3', surname: 'ERIKSSON', givenNames: 'ANNA MARIA',
    nationality: 'UTO', birthDate: '1974-08-12', sex: 'F', expiryDate: '2012-04-15', engine: 'tesseract-local',
  });
  expect(result.confidence).toBe(0.92);
});

test('noto‘g‘ri sana va MRZ xavfsiz rad qilinadi', () => {
  expect(mrzDate('991399', 'expiry')).toBeNull();
  expect(parsePassportMrz('oddiy matn')).toBeNull();
});
