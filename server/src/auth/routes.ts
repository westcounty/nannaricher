// server/src/auth/routes.ts — REST API routes for auth and game history
import { Router, Request, Response } from 'express';
import { verifyToken } from './jwt.js';
import { getDatabase } from '../db/database.js';

const router = Router();

// Middleware to extract user from JWT
function authenticateToken(req: Request, res: Response, next: Function): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const result = verifyToken(token);
  if (!result) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  (req as any).userId = result.payload.sub;
  (req as any).phone = result.payload.phone;
  next();
}

// GET /api/me — verify token validity
router.get('/me', authenticateToken, (req: Request, res: Response) => {
  res.json({
    userId: (req as any).userId,
    phone: (req as any).phone,
  });
});

// GET /api/history — get current user's game history
router.get('/history', authenticateToken, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const db = getDatabase();

  const results = db.prepare(`
    SELECT * FROM game_results
    WHERE user_id = ?
    ORDER BY played_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, limit, offset);

  const total = db.prepare(
    'SELECT COUNT(*) as count FROM game_results WHERE user_id = ?'
  ).get(userId) as { count: number };

  // Parse JSON fields
  const parsed = results.map((r: any) => ({
    ...r,
    is_winner: Boolean(r.is_winner),
    training_plans: JSON.parse(r.training_plans || '[]'),
    lines_visited: JSON.parse(r.lines_visited || '[]'),
  }));

  res.json({ results: parsed, total: total.count });
});

// GET /api/history/stats — get user's aggregate stats
router.get('/history/stats', authenticateToken, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const db = getDatabase();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_games,
      SUM(is_winner) as total_wins,
      ROUND(AVG(final_gpa), 2) as avg_gpa,
      ROUND(AVG(final_money), 0) as avg_money,
      ROUND(AVG(final_exploration), 0) as avg_exploration,
      MAX(final_gpa) as best_gpa,
      MAX(final_money) as max_money,
      MAX(final_exploration) as max_exploration
    FROM game_results
    WHERE user_id = ?
  `).get(userId) as any;

  res.json(stats || {
    total_games: 0,
    total_wins: 0,
    avg_gpa: 0,
    avg_money: 0,
    avg_exploration: 0,
  });
});

export { router as authRoutes, authenticateToken };
