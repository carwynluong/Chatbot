// Thêm vào embedding.route.ts
import chatController  from '../controllers/chat.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { Router } from 'express'

const router = Router()

/**
 * @swagger
 * /api/v1/chat:
 *   post:
 *     summary: Chat with documents using AI
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *             properties:
 *               question:
 *                 type: string
 *                 example: "Cẩm nang về bảo vệ dữ liệu?"
 *     responses:
 *       200:
 *         description: AI response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answer:
 *                   type: string
 */

router.post('/', requireAuth, chatController.chatWithDocuments.bind(chatController))
/**
 * @swagger
 * /api/v1/chat/save:
 *   post:
 *     summary: SaveChat
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - messages
 *             properties:
 *               userId:
 *                 type: string
 *               messages:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answer:
 *                   type: string
 */

router.post('/save', requireAuth, chatController.saveChat.bind(chatController))
/**
 * @swagger
 * /api/v1/chat/history:
 *   get:
 *     summary: Get chat history for current user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chat history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   userId:
 *                     type: string
 *                   messages:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */


// Get current user's chat history (userId from auth token)
router.get('/history', requireAuth, chatController.getChatHistory.bind(chatController))

/**
 * @swagger
 * /api/v1/chat/delete/{sessionId}:
 *   delete:
 *     summary: Delete chat session
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat deleted successfully
 */
router.delete('/delete/:sessionId', requireAuth, chatController.deleteChatSession.bind(chatController))


export default router