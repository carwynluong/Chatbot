import { processFileEmbedding } from '../controllers/embedding.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { initializeDatabase } from '../controllers/embedding.controller'
import { Router } from 'express'

const router = Router()

/**
 * @swagger
 * /api/v1/embedding/process:
 *   post:
 *     summary: Process files for embedding
 *     tags: [Embedding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileKeys:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Files processed successfully
 */
router.post('/process', requireAuth, processFileEmbedding)

/**
 * @swagger
 * /api/v1/embedding/init-db:
 *   post:
 *     summary: Initialize embedding database
 *     tags: [Embedding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database initialized successfully
 */
router.post('/init-db', requireAuth, initializeDatabase)
export default router