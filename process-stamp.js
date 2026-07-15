const { Jimp } = require('jimp');

async function processStamp() {
  try {
    const image = await Jimp.read('public/stamp.jpg');
    
    // We want to make the white background transparent.
    // The red stamp is red. White is (255,255,255).
    // We iterate over all pixels.
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      const red = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];
      
      // If the pixel is bright/white, make it transparent
      if (red > 200 && green > 200 && blue > 200) {
        this.bitmap.data[idx + 3] = 0; // Alpha to 0
      } else {
        // Keep the original color, or enhance the red
        // Make it perfectly red if you want:
        // this.bitmap.data[idx + 0] = 200;
        // this.bitmap.data[idx + 1] = 0;
        // this.bitmap.data[idx + 2] = 0;
        this.bitmap.data[idx + 3] = 255;
      }
    });

    await image.write('public/stamp.png');
    console.log('Processed stamp successfully!');
  } catch (err) {
    console.error(err);
  }
}

processStamp();
