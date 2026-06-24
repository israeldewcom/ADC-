const sharp = require('sharp');
const fs = require('fs');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputFile = 'logo.png'; // your logo
const outputDir = 'icons';

// Create the output directory if it doesn't exist
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

console.log('🎨 Generating icons...');

sizes.forEach((size) => {
  sharp(inputFile)
    .resize(size, size, { fit: 'contain', background: { r: 15, g: 23, b: 42 } }) // ChangeX dark background
    .png()
    .toFile(`${outputDir}/icon-${size}x${size}.png`)
    .then(() => console.log(`✅ ${size}x${size}`))
    .catch((err) => console.error(`❌ ${size}:`, err));
});
