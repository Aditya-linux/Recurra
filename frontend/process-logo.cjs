const Jimp = require('jimp');
const path = require('path');

const logoPath = path.join(__dirname, 'public', 'rekura-logo.png');

async function removeWhiteBackground() {
  try {
    const image = await Jimp.read(logoPath);
    
    // Distance threshold for "white"
    const threshold = 240; 

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const red   = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue  = this.bitmap.data[idx + 2];
      
      // If the pixel is close to white, make it transparent
      if (red >= threshold && green >= threshold && blue >= threshold) {
        this.bitmap.data[idx + 3] = 0; // Alpha channel
      }
    });

    await image.writeAsync(logoPath);
    console.log('Successfully removed white background from logo.');
  } catch (err) {
    console.error('Error processing logo:', err);
  }
}

removeWhiteBackground();
