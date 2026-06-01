// frontend/src/utils/canvasUtils.js

export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

export function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180;
}

/**
 * Returns the cropped/filtered image as a Blob
 */
export default async function getCroppedImg(imageSrc, pixelCrop, rotation = 0, filter = '') {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  // Size the canvas to fit the rotated image
  canvas.width = safeArea;
  canvas.height = safeArea;

  // Apply filters (e.g. "grayscale(100%)")
  if (filter) {
    ctx.filter = filter;
  }

  // Translate to center for rotation
  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate(getRadianAngle(rotation));
  ctx.translate(-safeArea / 2, -safeArea / 2);

  // Draw the centered image
  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  );

  // Extract the cropped area
  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  // Resize the canvas to the final crop size
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Reset the context to draw the final result
  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
  );

  // Return a Blob (file)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', 0.9); // 90% quality
  });
}
