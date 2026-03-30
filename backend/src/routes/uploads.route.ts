import { Router } from "express"
import multer from 'multer'   
import S3Controller from '../controllers/uploads.controllers'
import { requireAuth } from '../middleware/auth.middleware'
const router = Router()
const upload = multer({ storage: multer.memoryStorage() })
/**
 * @swagger
 * /api/v1/s3/uploads:
 *   post:
 *     summary: Upload multiple files to S3
 *     tags: [S3]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Files uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 files:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                       url:
 *                         type: string
 */
router.post('/uploads', requireAuth, upload.array('file'), S3Controller.uploadMultipleFiles )
// /**
//  * @swagger
//  * /api/v1/s3/upload-url:
//  *   post:
//  *     summary: Get presigned upload URL
//  *     tags: [S3]
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               fileName:
//  *                 type: string
//  *     responses:
//  *       200:
//  *         description: Presigned URL generated
//  */
// router.post('/upload-url', requireAuth, S3Controller.getUploadUrl)
/**
 * @swagger
 * /api/v1/s3/list-object:
 *   get:
 *     summary: List all files in S3
 *     tags: [S3]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of files
 */
router.get('/list-object', requireAuth, S3Controller.listFiles)
/**
 * @swagger
 * /api/v1/s3/uploads/{key}:
 *   get:
 *     summary: Get file URL by key
 *     tags: [S3]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File URL retrieved
 *   delete:
 *     summary: Delete file by key
 *     tags: [S3]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File deleted successfully
 */
router.get('/uploads/:key', requireAuth, S3Controller.getFileUrl)
router.delete('/uploads/:key', requireAuth, S3Controller.deleteFile)


export default router