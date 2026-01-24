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
 * Retourne la nouvelle image croppée/filtrée sous forme de Blob
 */
export default async function getCroppedImg(imageSrc, pixelCrop, rotation = 0, filter = '') {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  // Définir la taille du canvas pour inclure l'image tournée
  canvas.width = safeArea;
  canvas.height = safeArea;

  // Appliquer les filtres (ex: "grayscale(100%)")
  if (filter) {
    ctx.filter = filter;
  }

  // Translation au centre pour la rotation
  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate(getRadianAngle(rotation));
  ctx.translate(-safeArea / 2, -safeArea / 2);

  // Dessiner l'image centrée
  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  );

  // Extraire la zone croppée
  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  // Redimensionner le canvas à la taille finale du crop
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Remettre le contexte propre pour dessiner le résultat final
  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
  );

  // Retourner un Blob (fichier)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', 0.9); // Qualité 90%
  });
}
