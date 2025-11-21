"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const multerConfig_1 = __importDefault(require("../middleware/multerConfig"));
const sharp_1 = __importDefault(require("sharp"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const emailService_1 = require("../emailService");
const storage_1 = require("@google-cloud/storage");
const router = (0, express_1.Router)();
// Initialize Google Cloud Storage
// This will automatically use the service account key file if GOOGLE_APPLICATION_CREDENTIALS is set
const storage = new storage_1.Storage();
const bucketName = process.env.GCS_BUCKET_NAME;
// Helper function to upload a buffer to GCS
const uploadToGCS = (buffer, destination) => {
    if (!bucketName) {
        return Promise.reject('GCS_BUCKET_NAME is not set.');
    }
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(destination);
    return new Promise((resolve, reject) => {
        const stream = file.createWriteStream({
            resumable: false,
            contentType: 'image/jpeg', // Or detect based on file type
        });
        stream.on('error', (err) => reject(err));
        stream.on('finish', () => resolve());
        stream.end(buffer);
    });
};
// POST a new request
router.post('/', multerConfig_1.default.array('images', 5), async (req, res) => {
    const { customer_name, user_name, password, email, content } = req.body;
    if (!customer_name || !user_name || !password || !content) {
        return res.status(400).json({ error: '고객사명, 사용자명, 비밀번호, 접수 내용은 필수입니다.' });
    }
    try {
        let imageFileNames = [];
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            for (const file of req.files) {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const fileName = `${uniqueSuffix}${path_1.default.extname(file.originalname)}`;
                const resizedBuffer = await (0, sharp_1.default)(file.buffer)
                    .resize({ width: 1024, withoutEnlargement: true })
                    .jpeg({ quality: 90 })
                    .toBuffer();
                if (bucketName) {
                    // Cloud Run/GCS environment
                    await uploadToGCS(resizedBuffer, fileName);
                }
                else {
                    // Local environment
                    const filePath = path_1.default.join(__dirname, '..', '..', 'uploads', fileName);
                    await promises_1.default.writeFile(filePath, resizedBuffer);
                }
                imageFileNames.push(fileName);
            }
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        const newRequest = await db_1.default.query(`INSERT INTO requests (customer_name, user_name, password, email, content, images)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`, [customer_name, user_name, hashedPassword, email, content, JSON.stringify(imageFileNames)]);
        if (email) {
            (0, emailService_1.sendSubmissionConfirmation)(email, newRequest.rows[0]);
        }
        // Send notification to admin
        (0, emailService_1.sendSubmissionNotificationToAdmin)(newRequest.rows[0]);
        res.status(201).json(newRequest.rows[0]);
    }
    catch (err) {
        console.error('Error in POST /requests:', err);
        if (err instanceof multer_1.default.MulterError) {
            return res.status(400).json({ error: `파일 업로드 오류: ${err.message}` });
        }
        res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
    }
});
// GET a specific request by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const requestResult = await db_1.default.query('SELECT * FROM requests WHERE id = $1', [id]);
        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: '접수 내역을 찾을 수 없습니다.' });
        }
        const request = requestResult.rows[0];
        const commentsResult = await db_1.default.query('SELECT * FROM comments WHERE request_id = $1 ORDER BY created_at ASC', [id]);
        const { password: _, ...requestData } = request; // Exclude password
        const parsedImages = (() => {
            if (Array.isArray(request.images)) {
                return request.images;
            }
            if (typeof request.images === 'string' && request.images.trim() !== '') {
                try {
                    const parsed = JSON.parse(request.images);
                    return Array.isArray(parsed) ? parsed : [];
                }
                catch (e) {
                    console.error("Error parsing images JSON:", request.images, e);
                    return [];
                }
            }
            return [];
        })();
        res.json({
            ...requestData,
            comments: commentsResult.rows,
            images: parsedImages,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
// PUT (update) a request
router.put('/:id', multerConfig_1.default.array('images', 5), async (req, res) => {
    const { id } = req.params;
    const { customer_name, user_name, email, content, existingImages } = req.body;
    try {
        let imageFileNames = [];
        if (existingImages) {
            imageFileNames = Array.isArray(existingImages) ? existingImages : existingImages.split(',').filter(Boolean);
        }
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            for (const file of req.files) {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const fileName = `${uniqueSuffix}${path_1.default.extname(file.originalname)}`;
                const resizedBuffer = await (0, sharp_1.default)(file.buffer)
                    .resize({ width: 1024, withoutEnlargement: true })
                    .jpeg({ quality: 90 })
                    .toBuffer();
                if (bucketName) {
                    // Cloud Run/GCS environment
                    await uploadToGCS(resizedBuffer, fileName);
                }
                else {
                    // Local environment
                    const filePath = path_1.default.join(__dirname, '..', '..', 'uploads', fileName);
                    await promises_1.default.writeFile(filePath, resizedBuffer);
                }
                imageFileNames.push(fileName);
            }
        }
        const updateResult = await db_1.default.query(`UPDATE requests SET customer_name = $1, user_name = $2, email = $3, content = $4, images = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`, [customer_name, user_name, email, content, JSON.stringify(imageFileNames), id]);
        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: '수정할 접수 건을 찾을 수 없습니다.' });
        }
        const updatedRequest = updateResult.rows[0];
        const commentsResult = await db_1.default.query('SELECT * FROM comments WHERE request_id = $1 ORDER BY created_at ASC', [id]);
        const { password: _, ...requestData } = updatedRequest;
        const responseData = {
            ...requestData,
            comments: commentsResult.rows,
            images: Array.isArray(updatedRequest.images) ? updatedRequest.images : (updatedRequest.images && typeof updatedRequest.images === 'string' && updatedRequest.images.trim() !== '') ? JSON.parse(updatedRequest.images) : [],
        };
        res.json(responseData);
    }
    catch (err) {
        console.error('Error in PUT /requests/:id', err);
        res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
    }
});
// All other routes (DELETE, /auth) remain the same as before...
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { password } = req.body; // Password for verification
    try {
        const requestResult = await db_1.default.query('SELECT id, password, images FROM requests WHERE id = $1', [id]);
        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: '삭제할 접수 건을 찾을 수 없습니다.' });
        }
        const request = requestResult.rows[0];
        const isPasswordMatch = await bcryptjs_1.default.compare(password, request.password);
        if (!isPasswordMatch) {
            return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
        }
        // Delete images from GCS or local filesystem
        const imagesToDelete = JSON.parse(request.images || '[]');
        if (imagesToDelete.length > 0) {
            for (const imageName of imagesToDelete) {
                try {
                    if (bucketName) {
                        await storage.bucket(bucketName).file(imageName).delete();
                    }
                    else {
                        await promises_1.default.unlink(path_1.default.join(__dirname, '..', '..', 'uploads', imageName));
                    }
                }
                catch (imgErr) {
                    // Log error but continue deletion process
                    console.error(`Failed to delete image ${imageName}:`, imgErr);
                }
            }
        }
        await db_1.default.query('DELETE FROM comments WHERE request_id = $1', [id]);
        await db_1.default.query('DELETE FROM requests WHERE id = $1', [id]);
        res.status(204).send(); // No Content
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
router.post('/auth', async (req, res) => {
    const { user_name, password } = req.body;
    if (!user_name || !password) {
        return res.status(400).json({ error: '사용자명과 비밀번호를 모두 입력해주세요.' });
    }
    try {
        const userRequests = await db_1.default.query('SELECT * FROM requests WHERE user_name = $1', [user_name]);
        if (userRequests.rows.length === 0) {
            return res.status(404).json({ error: '해당 사용자명으로 접수된 내역이 없습니다.' });
        }
        let isPasswordMatch = false;
        for (const request of userRequests.rows) {
            const match = await bcryptjs_1.default.compare(password, request.password);
            if (match) {
                isPasswordMatch = true;
                break;
            }
        }
        if (!isPasswordMatch) {
            return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
        }
        const requestsWithComments = [];
        for (const request of userRequests.rows) {
            const comments = await db_1.default.query('SELECT * FROM comments WHERE request_id = $1 ORDER BY created_at ASC', [request.id]);
            const { password: _, ...requestData } = request;
            requestsWithComments.push({
                ...requestData,
                comments: comments.rows,
                images: (() => { if (Array.isArray(request.images)) {
                    return request.images;
                } if (typeof request.images === 'string' && request.images.trim() !== '') {
                    try {
                        const parsed = JSON.parse(request.images);
                        return Array.isArray(parsed) ? parsed : [];
                    }
                    catch (e) {
                        console.error("Error parsing images JSON:", request.images, e);
                        return [];
                    }
                } return []; })(),
            });
        }
        requestsWithComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        res.json(requestsWithComments);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
