"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.guideRouter = void 0;
const express_1 = require("express");
const db_1 = __importDefault(require("../db")); // Import the database connection pool
const adminAuth_1 = __importDefault(require("../middleware/adminAuth"));
const router = (0, express_1.Router)();
exports.guideRouter = router;
// GET all guides (public)
router.get('/', async (req, res) => {
    try {
        const result = await db_1.default.query('SELECT * FROM guides ORDER BY id DESC');
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching guides:', error);
        res.status(500).json({ error: '가이드를 불러오는 중 오류가 발생했습니다.' });
    }
});
// GET single guide by ID (public)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db_1.default.query('SELECT * FROM guides WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        }
        else {
            res.status(404).json({ error: '가이드를 찾을 수 없습니다.' });
        }
    }
    catch (error) {
        console.error('Error fetching guide:', error);
        res.status(500).json({ error: '가이드를 불러오는 중 오류가 발생했습니다.' });
    }
});
// POST create new guide (admin only)
router.post('/', adminAuth_1.default, async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
        }
        const result = await db_1.default.query('INSERT INTO guides (title, content) VALUES ($1, $2) RETURNING *', [title, content]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Error creating guide:', error);
        res.status(500).json({ error: '가이드를 생성하는 중 오류가 발생했습니다.' });
    }
});
// PUT update guide (admin only)
router.put('/:id', adminAuth_1.default, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
        }
        const result = await db_1.default.query('UPDATE guides SET title = $1, content = $2, updated_at = NOW() WHERE id = $3 RETURNING *', [title, content, id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        }
        else {
            res.status(404).json({ error: '가이드를 찾을 수 없습니다.' });
        }
    }
    catch (error) {
        console.error('Error updating guide:', error);
        res.status(500).json({ error: '가이드를 업데이트하는 중 오류가 발생했습니다.' });
    }
});
// DELETE guide (admin only)
router.delete('/:id', adminAuth_1.default, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db_1.default.query('DELETE FROM guides WHERE id = $1', [id]);
        if (result.rowCount && result.rowCount > 0) { // Added null check for result.rowCount
            res.status(204).send(); // No Content
        }
        else {
            res.status(404).json({ error: '가이드를 찾을 수 없습니다.' });
        }
    }
    catch (error) {
        console.error('Error deleting guide:', error);
        res.status(500).json({ error: '가이드를 삭제하는 중 오류가 발생했습니다.' });
    }
});
