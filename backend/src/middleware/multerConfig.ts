import multer from 'multer';
import { Request } from 'express';

// Use memory storage to process files with sharp before saving to disk
const storage = multer.memoryStorage();

// File filter to allow only images
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('이미지 파일만 업로드 가능합니다. (jpeg, png 등)'));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    files: 5, // Max 5 files
    fileSize: 10 * 1024 * 1024, // 10 MB file size limit
  },
});

export default upload;
