const Jimp = require('jimp');
const path = require('path');

// We need to use the original user image because we might have already destroyed the previous public one
// The user's original image is at C:\Users\Aditya\OneDrive\Desktop\Rekura finalized.png
const originalLogoPath = 'C:\\Users\\Aditya\\OneDrive\\Desktop\\Rekura finalized.png';
const outLogoPath = path.join(__dirname, 'public', 'rekura-logo.png');

async function makeTransparent() {
  try {
    const image = await Jimp.read(originalLogoPath);
    
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const red   = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue  = this.bitmap.data[idx + 2];
      
      const brightness = (red + green + blue) / 3;
      
      // If the pixel is white, it becomes fully transparent.
      // If it's black, it becomes fully opaque.
      const alpha = 255 - brightness;
      
      this.bitmap.data[idx + 0] = 0;
      this.bitmap.data[idx + 1] = 0;
      this.bitmap.data[idx + 2] = 0;
      this.bitmap.data[idx + 3] = alpha;
    });

    // Resize to a reasonable height if it's too huge
    if (image.bitmap.height > 200) {
      image.resize(Jimp.AUTO, 200);
    }

    await image.writeAsync(outLogoPath);
    console.log('Successfully extracted logo alpha mask.');
  } catch (err) {
    console.error('Error processing logo:', err);
  }
}

makeTransparent();
