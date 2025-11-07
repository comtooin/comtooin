import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import adminAuth from '../middleware/adminAuth';

const router = Router();
export const guideRouter = router;
const guideFilePath = path.join(__dirname, '../../db/guide.json');

// Helper function to read guides
const readGuides = async (): Promise<any[]> => {
  try {
    const data = await fs.readFile(guideFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []; // File not found, return empty array
    }
    throw error;
  }
};

// Helper function to write guides
const writeGuides = async (guides: any[]): Promise<void> => {
  await fs.writeFile(guideFilePath, JSON.stringify(guides, null, 2), 'utf8');
};

// GET all guides (public)
router.get('/', async (req: Request, res: Response) => {
  try {
    const guides = await readGuides();
    res.json(guides);
  } catch (error) {
    console.error('Error fetching guides:', error);
    res.status(500).json({ error: '가이드를 불러오는 중 오류가 발생했습니다.' });
  }
});

// GET single guide by ID (public)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const guides = await readGuides();
    const guide = guides.find(g => g.id === parseInt(req.params.id));
    if (guide) {
      res.json(guide);
    } else {
      res.status(404).json({ error: '가이드를 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('Error fetching guide:', error);
    res.status(500).json({ error: '가이드를 불러오는 중 오류가 발생했습니다.' });
  }
});

// POST create new guide (admin only)
router.post('/', adminAuth, async (req: Request, res: Response) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
    }
    const guides = await readGuides();
    const newId = guides.length > 0 ? Math.max(...guides.map(g => g.id)) + 1 : 1;
    const newGuide = { id: newId, title, content };
    guides.push(newGuide);
    await writeGuides(guides);
    res.status(201).json(newGuide);
  } catch (error) {
    console.error('Error creating guide:', error);
    res.status(500).json({ error: '가이드를 생성하는 중 오류가 발생했습니다.' });
  }
});

// PUT update guide (admin only)
router.put('/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
    }
    let guides = await readGuides();
    const index = guides.findIndex(g => g.id === parseInt(req.params.id));
    if (index !== -1) {
      guides[index] = { ...guides[index], title, content };
      await writeGuides(guides);
      res.json(guides[index]);
    } else {
      res.status(404).json({ error: '가이드를 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('Error updating guide:', error);
    res.status(500).json({ error: '가이드를 업데이트하는 중 오류가 발생했습니다.' });
  }
});

// DELETE guide (admin only)
router.delete('/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    let guides = await readGuides();
    const initialLength = guides.length;
    guides = guides.filter(g => g.id !== parseInt(req.params.id));
    if (guides.length < initialLength) {
      await writeGuides(guides);
      res.status(204).send(); // No Content
    } else {
      res.status(404).json({ error: '가이드를 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('Error deleting guide:', error);
    res.status(500).json({ error: '가이드를 삭제하는 중 오류가 발생했습니다.' });
  }
});