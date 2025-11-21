"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
// Use memory storage to process files with sharp before saving to disk
const storage = multer_1.default.memoryStorage();
// File filter to allow only images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    }
    else {
        cb(new Error('이미지 파일만 업로드 가능합니다. (jpeg, png 등)'));
    }
};
// Configure multer
const upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        files: 5, // Max 5 files
        fileSize: 10 * 1024 * 1024, // 10 MB file size limit
    },
});
exports.default = upload;
