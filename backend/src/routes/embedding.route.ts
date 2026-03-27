import { processFileEmbedding, initializePinecone } from '../controllers/embedding.controller'
import { requireAuth } from '../middleware/auth.middleware'
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
 * /api/v1/embedding/health:
 *   get:
 *     summary: Check Pinecone connection health
 *     tags: [Embedding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pinecone connection healthy
 *       500:
 *         description: Pinecone connection failed
 */
router.get('/health', requireAuth, initializePinecone)
export default router