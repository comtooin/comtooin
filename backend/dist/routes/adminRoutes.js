"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const adminAuth_1 = __importDefault(require("../middleware/adminAuth"));
const db_1 = __importDefault(require("../db"));
const exceljs_1 = __importDefault(require("exceljs"));
const emailService_1 = require("../emailService");
dotenv_1.default.config();
const router = (0, express_1.Router)();
const ADMIN_ID = 'comtooin';
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '12293927'; // Fallback to default password
const stripHtmlTags = (html) => {
    if (!html)
        return '';
    return html.replace(/<[^>]*>?/gm, '');
};
router.post('/login', (req, res) => {
    console.log('Admin login route handler reached.');
    const { id, password } = req.body;
    if (id === ADMIN_ID && password === ADMIN_PASSWORD) {
        const token = jsonwebtoken_1.default.sign({ id: ADMIN_ID, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ token });
    }
    else {
        res.status(401).json({ error: '아이디 또는 비밀번호가 잘못되었습니다.' });
    }
});
router.get('/requests', adminAuth_1.default, async (req, res) => {
    try {
        const { _sort, _order, customerName, month } = req.query;
        const allowedSortColumns = ['id', 'created_at', 'customer_name', 'user_name', 'status'];
        const sortBy = (typeof _sort === 'string' && allowedSortColumns.includes(_sort)) ? _sort : 'created_at';
        const orderBy = (typeof _order === 'string' && ['asc', 'desc'].includes(_order.toLowerCase())) ? _order.toUpperCase() : 'DESC';
        let query = 'SELECT * FROM requests';
        const params = [];
        const conditions = [];
        if (customerName && typeof customerName === 'string' && customerName !== '') {
            params.push(customerName);
            conditions.push(`customer_name = $${params.length}`);
        }
        if (month && typeof month === 'string' && month !== '') {
            params.push(month);
            conditions.push(`TO_CHAR(created_at, 'YYYY-MM') = $${params.length}`);
        }
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ` ORDER BY ${sortBy} ${orderBy}`;
        console.log('Executing query on /admin/requests:', query, params);
        const allRequests = await db_1.default.query(query, params);
        const requestsWithComments = [];
        for (const request of allRequests.rows) {
            const comments = await db_1.default.query('SELECT * FROM comments WHERE request_id = $1 ORDER BY created_at ASC', [request.id]);
            const { password: _, ...requestData } = request;
            requestsWithComments.push({
                ...requestData,
                comments: comments.rows,
                images: Array.isArray(request.images) ? request.images : (request.images && typeof request.images === 'string' && request.images.trim() !== '') ? JSON.parse(request.images) : [],
            });
        }
        res.json(requestsWithComments);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
router.get('/customers', adminAuth_1.default, async (req, res) => {
    try {
        const result = await db_1.default.query('SELECT DISTINCT customer_name FROM requests ORDER BY customer_name ASC');
        res.json(result.rows.map(row => row.customer_name));
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
router.put('/requests/:id', adminAuth_1.default, async (req, res) => {
    const { id } = req.params;
    const { status, comment } = req.body;
    try {
        const originalRequestResult = await db_1.default.query('SELECT * FROM requests WHERE id = $1', [id]);
        if (originalRequestResult.rows.length === 0) {
            return res.status(404).json({ error: '해당 접수 건을 찾을 수 없습니다.' });
        }
        const originalRequest = originalRequestResult.rows[0];
        const originalStatus = originalRequest.status;
        if (status) {
            await db_1.default.query('UPDATE requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, id]);
        }
        if (comment && comment.trim() !== '') {
            await db_1.default.query('INSERT INTO comments (request_id, comment) VALUES ($1, $2)', [id, comment]);
        }
        if (status && status !== originalStatus && originalRequest.email) {
            (0, emailService_1.sendStatusUpdate)(originalRequest.email, originalRequest, status);
        }
        const requestResult = await db_1.default.query('SELECT * FROM requests WHERE id = $1', [id]);
        const updatedRequest = requestResult.rows[0];
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
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
router.delete('/requests/:id', adminAuth_1.default, async (req, res) => {
    const { id } = req.params;
    try {
        const deleteResult = await db_1.default.query('DELETE FROM requests WHERE id = $1 RETURNING *', [id]);
        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ error: '삭제할 접수 건을 찾을 수 없습니다.' });
        }
        res.status(204).send(); // No Content
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
router.get('/reports/summary', adminAuth_1.default, async (req, res) => {
    try {
        const { customerName, month } = req.query;
        let baseQuery = 'SELECT * FROM requests';
        const params = [];
        const conditions = [];
        if (customerName && typeof customerName === 'string' && customerName !== '') {
            params.push(customerName);
            conditions.push(`customer_name = $${params.length}`);
        }
        if (month && typeof month === 'string' && month !== '') {
            params.push(month);
            conditions.push(`TO_CHAR(created_at, 'YYYY-MM') = $${params.length}`);
        }
        if (conditions.length > 0) {
            baseQuery += ' WHERE ' + conditions.join(' AND ');
        }
        // Fetch status summary
        const statusSummaryQuery = `SELECT status, COUNT(*) FROM (${baseQuery}) AS filtered_requests GROUP BY status`;
        const statusSummaryResult = await db_1.default.query(statusSummaryQuery, params);
        // Fetch monthly summary (only if no specific month filter is applied)
        let monthlySummaryResult = { rows: [] };
        if (!month) {
            const monthlySummaryQuery = `SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*)::int AS count FROM (${baseQuery}) AS filtered_requests GROUP BY month ORDER BY month`;
            monthlySummaryResult = await db_1.default.query(monthlySummaryQuery, params);
        }
        res.json({
            status: statusSummaryResult.rows,
            monthly: monthlySummaryResult.rows,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
router.get('/reports/excel', adminAuth_1.default, async (req, res) => {
    try {
        const { customerName, month, status } = req.query;
        // 1. Fetch data
        let query = 'SELECT * FROM requests';
        const params = [];
        const conditions = [];
        if (customerName && typeof customerName === 'string' && customerName !== '') {
            params.push(customerName);
            conditions.push(`customer_name = $${params.length}`);
        }
        if (month && typeof month === 'string' && month !== '') {
            params.push(month);
            conditions.push(`TO_CHAR(created_at, 'YYYY-MM') = $${params.length}`);
        }
        if (status && typeof status === 'string' && status !== '') {
            params.push(status);
            conditions.push(`status = $${params.length}`);
        }
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY created_at DESC';
        const allRequests = await db_1.default.query(query, params);
        // 2. Create Excel Workbook with dynamic names
        const customerPart = customerName || '전체';
        const monthPart = month || '전체';
        const sheetTitle = `${customerPart}-${monthPart} 기술지원 상세내역`;
        const fileName = `${customerPart}-${monthPart}-report.xlsx`;
        const workbook = new exceljs_1.default.Workbook();
        const worksheet = workbook.addWorksheet(sheetTitle);
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: '접수일시', key: 'created_at', width: 20 },
            { header: '고객사명', key: 'customer_name', width: 20 },
            { header: '사용자명', key: 'user_name', width: 15 },
            { header: '상태', key: 'status', width: 12 },
            { header: '접수내용', key: 'content', width: 40 },
            { header: '처리내용', key: 'comments', width: 50 },
        ];
        worksheet.getRow(1).font = { bold: true };
        // 3. Add data rows
        for (const request of allRequests.rows) {
            const commentsResult = await db_1.default.query('SELECT * FROM comments WHERE request_id = $1 ORDER BY created_at ASC', [request.id]);
            const commentsText = commentsResult.rows.map(c => stripHtmlTags(c.comment)).join('\n');
            worksheet.addRow({
                ...request,
                created_at: new Date(request.created_at).toLocaleString(), // Format date
                content: stripHtmlTags(request.content),
                comments: commentsText,
            });
        }
        // 4. Send the file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        await workbook.xlsx.write(res);
        res.end();
    }
    catch (err) {
        console.error("Failed to generate Excel report", err);
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
