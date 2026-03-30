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

// Simple test route
router.get('/test', (req, res) => {
    res.json({ message: 'Embedding route is working!', timestamp: new Date().toISOString() })
})

// Generate test token for debugging
router.get('/test-token', (req, res) => {
    const jwt = require('jsonwebtoken')
    const testToken = jwt.sign(
        { id: 'test-user', email: 'test@example.com', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    )
    res.json({ 
        message: 'Test token generated', 
        token: testToken,
        usage: `curl -H "Authorization: Bearer ${testToken}" ...`
    })
})

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

// Temporary debug route - remove after fixing auth issue
router.post('/debug', (req, res) => {
    const authHeader = req.headers.authorization
    const cookies = req.cookies
    console.log('🔍 Debug Info:')
    console.log('  Auth Header:', authHeader ? authHeader.substring(0, 20) + '...' : 'Missing')
    console.log('  Cookies:', Object.keys(cookies))
    console.log('  Body:', req.body)
    
    res.json({
        message: 'Debug info logged to console',
        hasAuthHeader: !!authHeader,
        cookieKeys: Object.keys(cookies),
        bodyKeys: Object.keys(req.body || {})
    })
})

export default router