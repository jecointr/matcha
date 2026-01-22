import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Upload directory
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PHOTOS = 5;

// Allowed MIME types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Ensure upload directory exists
const ensureUploadDir = async () => {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
};

// Multer configuration
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG and WebP are allowed.'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_PHOTOS
  }
});

/**
 * Process and save uploaded image
 * - Validates image content (not just extension)
 * - Resizes to max dimensions
 * - Converts to JPEG
 * - Strips metadata (EXIF)
 */
export const processImage = async (buffer, userId) => {
  await ensureUploadDir();
  
  // Validate it's actually an image by trying to read metadata
  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (error) {
    throw new Error('Invalid image file');
  }
  
  // Check dimensions
  if (metadata.width < 100 || metadata.height < 100) {
    throw new Error('Image too small. Minimum size is 100x100 pixels.');
  }
  
  // Generate unique filename
  const filename = `${userId}_${uuidv4()}.jpg`;
  const filepath = path.join(UPLOAD_DIR, filename);
  
  // Process image: resize, convert to JPEG, strip metadata
  await sharp(buffer)
    .resize(800, 800, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({
      quality: 85,
      progressive: true
    })
    .toFile(filepath);
  
  // Also create thumbnail
  const thumbFilename = `thumb_${filename}`;
  const thumbPath = path.join(UPLOAD_DIR, thumbFilename);
  
  await sharp(buffer)
    .resize(200, 200, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({
      quality: 80
    })
    .toFile(thumbPath);
  
  return {
    filename,
    thumbFilename,
    width: metadata.width,
    height: metadata.height
  };
};

/**
 * Delete image files
 */
export const deleteImage = async (filename) => {
  try {
    const filepath = path.join(UPLOAD_DIR, filename);
    const thumbPath = path.join(UPLOAD_DIR, `thumb_${filename}`);
    
    await fs.unlink(filepath).catch(() => {});
    await fs.unlink(thumbPath).catch(() => {});
  } catch (error) {
    console.error('Error deleting image:', error);
  }
};

/**
 * Multer error handler middleware
 */
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: `Maximum ${MAX_PHOTOS} photos allowed.` });
    }
    return res.status(400).json({ error: err.message });
  }
  
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  
  next();
};
