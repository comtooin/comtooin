import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret';

interface AuthRequest extends Request {
  adminId?: string;
}

const adminAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string, role: string };
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }
    req.adminId = decoded.id; // Attach admin ID to request
    next();
  } catch (err) {
    res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
};

export default adminAuth;
