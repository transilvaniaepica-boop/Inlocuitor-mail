const crypto = require('crypto');
const QRCode = require('qrcode');

// Helper pentru codificare / decodificare Base32 (RFC 4648)
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(base32Str) {
  const cleanStr = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleanStr.length; i++) {
    const idx = BASE32_CHARS.indexOf(cleanStr[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

// Generare cod TOTP (RFC 6238) pentru un secret si timestamp
function generateTOTP(secretBase32, timeStep = 30, forTime = Date.now()) {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(forTime / 1000 / timeStep);

  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0xf;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

// Verificare cod cu toleranta +/- 1 fereastra (60s total pentru decalaj ceas)
function verifyTOTP(token, secretBase32, window = 1, timeStep = 30) {
  if (!token || !secretBase32) return false;
  const cleanToken = token.toString().trim();
  const now = Date.now();

  for (let i = -window; i <= window; i++) {
    const checkTime = now + (i * timeStep * 1000);
    const expected = generateTOTP(secretBase32, timeStep, checkTime);
    if (expected === cleanToken) {
      return true;
    }
  }
  return false;
}

// Generare secret nou (20 octeti random = 32 caractere Base32)
function generateSecret() {
  const randomBytes = crypto.randomBytes(20);
  return base32Encode(randomBytes);
}

// Generare URL otpauth compatibil cu Google Authenticator
function getOtpAuthUrl(username, secret, issuer = 'Înlocuitor Mail') {
  const cleanUser = encodeURIComponent(username);
  const cleanIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${cleanIssuer}:${cleanUser}?secret=${secret}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

// Generare cod QR ca Data URL (imagine PNG)
async function generateQRCodeDataUrl(otpAuthUrl) {
  try {
    return await QRCode.toDataURL(otpAuthUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 250,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return null;
  }
}

module.exports = {
  generateSecret,
  getOtpAuthUrl,
  generateQRCodeDataUrl,
  verifyTOTP,
  generateTOTP
};
