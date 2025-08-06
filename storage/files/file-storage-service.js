// File Storage Service for Auto-Alert System
// Handles images, documents, exports, and user-generated content

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

class FileStorageService {
    constructor(config = {}) {
        this.config = {
            baseStoragePath: config.baseStoragePath || './storage/files',
            maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
            allowedMimeTypes: config.allowedMimeTypes || [
                'image/jpeg',
                'image/png',
                'image/webp',
                'application/pdf',
                'text/csv',
                'application/json'
            ],
            cdnBaseUrl: config.cdnBaseUrl || process.env.CDN_BASE_URL || '',
            enableImageOptimization: config.enableImageOptimization !== false,
            ...config
        };

        this.storageProviders = {
            local: new LocalStorageProvider(this.config),
            s3: config.s3Config ? new S3StorageProvider(config.s3Config) : null,
            cloudinary: config.cloudinaryConfig ? new CloudinaryStorageProvider(config.cloudinaryConfig) : null
        };

        this.activeProvider = this.config.provider || 'local';
    }

    async initialize() {
        // Ensure storage directories exist
        await this.ensureDirectories();
        
        // Initialize active storage provider
        if (this.storageProviders[this.activeProvider]) {
            await this.storageProviders[this.activeProvider].initialize();
        }
    }

    async ensureDirectories() {
        const directories = [
            'avatars',
            'vehicle-images',
            'documents',
            'exports',
            'temp',
            'thumbnails'
        ];

        for (const dir of directories) {
            const dirPath = path.join(this.config.baseStoragePath, dir);
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    // File Upload Handler
    getMulterConfig() {
        return multer({
            storage: multer.memoryStorage(),
            limits: {
                fileSize: this.config.maxFileSize,
                files: 10
            },
            fileFilter: (req, file, cb) => {
                if (this.config.allowedMimeTypes.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error(`File type ${file.mimetype} not allowed`));
                }
            }
        });
    }

    // Main upload method
    async uploadFile(fileData, options = {}) {
        const {
            userId,
            fileType = 'document',
            generateThumbnail = false,
            optimizeImage = this.config.enableImageOptimization,
            makePublic = false
        } = options;

        try {
            // Validate file
            this.validateFile(fileData);

            // Generate unique filename
            const fileExtension = path.extname(fileData.originalname).toLowerCase();
            const filename = `${uuidv4()}${fileExtension}`;
            const storagePath = this.getStoragePath(fileType, filename);

            // Process file if it's an image
            let processedBuffer = fileData.buffer;
            if (this.isImage(fileData.mimetype) && optimizeImage) {
                processedBuffer = await this.optimizeImage(fileData.buffer, fileData.mimetype);
            }

            // Calculate file checksum
            const checksum = crypto.createHash('sha256').update(processedBuffer).digest('hex');

            // Upload to storage provider
            const uploadResult = await this.storageProviders[this.activeProvider].upload({
                filename,
                buffer: processedBuffer,
                mimetype: fileData.mimetype,
                storagePath,
                makePublic
            });

            // Generate thumbnail if requested
            let thumbnailUrl = null;
            if (generateThumbnail && this.isImage(fileData.mimetype)) {
                thumbnailUrl = await this.generateThumbnail(processedBuffer, filename);
            }

            // Prepare file record
            const fileRecord = {
                id: uuidv4(),
                userId,
                filename,
                originalFilename: fileData.originalname,
                fileType,
                mimeType: fileData.mimetype,
                fileSizeBytes: processedBuffer.length,
                storagePath: uploadResult.storagePath,
                storageProvider: this.activeProvider,
                publicUrl: uploadResult.publicUrl,
                cdnUrl: uploadResult.cdnUrl,
                thumbnailUrl,
                checksum,
                accessLevel: makePublic ? 'public' : 'private',
                metadata: {
                    uploadedAt: new Date().toISOString(),
                    userAgent: options.userAgent,
                    ipAddress: options.ipAddress,
                    ...options.metadata
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            return fileRecord;

        } catch (error) {
            console.error('File upload error:', error);
            throw new Error(`File upload failed: ${error.message}`);
        }
    }

    // Vehicle image handling with metadata extraction
    async uploadVehicleImages(imageFiles, vehicleId, userId) {
        const uploadPromises = imageFiles.map(async (file, index) => {
            try {
                const metadata = await this.extractImageMetadata(file.buffer);
                
                return await this.uploadFile(file, {
                    userId,
                    fileType: 'vehicle-image',
                    generateThumbnail: true,
                    optimizeImage: true,
                    makePublic: true,
                    metadata: {
                        vehicleId,
                        imageIndex: index,
                        ...metadata
                    }
                });
            } catch (error) {
                console.error(`Failed to upload image ${index}:`, error);
                return null;
            }
        });

        const results = await Promise.all(uploadPromises);
        return results.filter(result => result !== null);
    }

    // Avatar handling
    async uploadUserAvatar(imageFile, userId) {
        // Delete existing avatar if exists
        await this.deleteUserFiles(userId, 'avatar');

        return await this.uploadFile(imageFile, {
            userId,
            fileType: 'avatar',
            generateThumbnail: true,
            optimizeImage: true,
            makePublic: true,
            metadata: {
                isAvatar: true
            }
        });
    }

    // Export file generation
    async createExportFile(data, format, userId, exportType = 'search-results') {
        let buffer;
        let filename;
        let mimeType;

        switch (format.toLowerCase()) {
            case 'csv':
                buffer = Buffer.from(this.generateCSV(data));
                filename = `${exportType}-${Date.now()}.csv`;
                mimeType = 'text/csv';
                break;
            
            case 'json':
                buffer = Buffer.from(JSON.stringify(data, null, 2));
                filename = `${exportType}-${Date.now()}.json`;
                mimeType = 'application/json';
                break;
            
            case 'pdf':
                buffer = await this.generatePDF(data);
                filename = `${exportType}-${Date.now()}.pdf`;
                mimeType = 'application/pdf';
                break;
            
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }

        const fileData = {
            originalname: filename,
            buffer,
            mimetype: mimeType
        };

        return await this.uploadFile(fileData, {
            userId,
            fileType: 'export',
            makePublic: false,
            metadata: {
                exportType,
                format,
                recordCount: Array.isArray(data) ? data.length : 1,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            }
        });
    }

    // File retrieval
    async getFile(fileId, userId = null) {
        try {
            const fileRecord = await this.getFileRecord(fileId);
            
            if (!fileRecord) {
                throw new Error('File not found');
            }

            // Check access permissions
            if (fileRecord.accessLevel === 'private' && fileRecord.userId !== userId) {
                throw new Error('Access denied');
            }

            const fileBuffer = await this.storageProviders[fileRecord.storageProvider]
                .download(fileRecord.storagePath);

            return {
                fileRecord,
                buffer: fileBuffer
            };
        } catch (error) {
            console.error('File retrieval error:', error);
            throw error;
        }
    }

    // File deletion
    async deleteFile(fileId, userId = null) {
        try {
            const fileRecord = await this.getFileRecord(fileId);
            
            if (!fileRecord) {
                throw new Error('File not found');
            }

            // Check permissions
            if (fileRecord.userId !== userId) {
                throw new Error('Access denied');
            }

            // Delete from storage provider
            await this.storageProviders[fileRecord.storageProvider]
                .delete(fileRecord.storagePath);

            // Delete thumbnail if exists
            if (fileRecord.thumbnailUrl) {
                const thumbnailPath = this.getThumbnailPath(fileRecord.filename);
                await this.storageProviders[this.activeProvider].delete(thumbnailPath);
            }

            // Mark as deleted in database
            await this.markFileDeleted(fileId);

            return true;
        } catch (error) {
            console.error('File deletion error:', error);
            throw error;
        }
    }

    // Bulk operations
    async deleteUserFiles(userId, fileType = null) {
        const files = await this.getUserFiles(userId, fileType);
        
        const deletePromises = files.map(file => 
            this.deleteFile(file.id, userId).catch(err => {
                console.error(`Failed to delete file ${file.id}:`, err);
                return null;
            })
        );

        const results = await Promise.all(deletePromises);
        return results.filter(result => result !== null).length;
    }

    // Storage optimization
    async cleanupExpiredFiles() {
        const expiredFiles = await this.getExpiredFiles();
        let deletedCount = 0;

        for (const file of expiredFiles) {
            try {
                await this.deleteFile(file.id);
                deletedCount++;
            } catch (error) {
                console.error(`Failed to cleanup file ${file.id}:`, error);
            }
        }

        return deletedCount;
    }

    async optimizeStorage() {
        // Find duplicate files by checksum
        const duplicates = await this.findDuplicateFiles();
        let optimizedCount = 0;

        for (const duplicateGroup of duplicates) {
            if (duplicateGroup.length > 1) {
                // Keep the first file, update references for others
                const [keepFile, ...duplicateFiles] = duplicateGroup;
                
                for (const dupFile of duplicateFiles) {
                    await this.updateFileReferences(dupFile.id, keepFile.id);
                    await this.deleteFile(dupFile.id);
                    optimizedCount++;
                }
            }
        }

        return optimizedCount;
    }

    // Helper methods
    validateFile(fileData) {
        if (!fileData.buffer || fileData.buffer.length === 0) {
            throw new Error('File buffer is empty');
        }

        if (fileData.buffer.length > this.config.maxFileSize) {
            throw new Error(`File size exceeds maximum limit of ${this.config.maxFileSize} bytes`);
        }

        if (!this.config.allowedMimeTypes.includes(fileData.mimetype)) {
            throw new Error(`File type ${fileData.mimetype} not allowed`);
        }
    }

    isImage(mimeType) {
        return mimeType.startsWith('image/');
    }

    getStoragePath(fileType, filename) {
        return path.join(fileType + 's', filename);
    }

    getThumbnailPath(filename) {
        const ext = path.extname(filename);
        const name = path.basename(filename, ext);
        return path.join('thumbnails', `${name}_thumb.webp`);
    }

    async optimizeImage(buffer, mimeType) {
        try {
            const sharpInstance = sharp(buffer);
            const metadata = await sharpInstance.metadata();

            // Resize if too large
            if (metadata.width > 1920 || metadata.height > 1080) {
                sharpInstance.resize(1920, 1080, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
            }

            // Convert to optimal format
            return await sharpInstance
                .jpeg({ quality: 80, progressive: true })
                .toBuffer();
        } catch (error) {
            console.error('Image optimization error:', error);
            return buffer; // Return original if optimization fails
        }
    }

    async generateThumbnail(buffer, filename) {
        try {
            const thumbnailBuffer = await sharp(buffer)
                .resize(300, 200, {
                    fit: 'cover',
                    position: 'center'
                })
                .webp({ quality: 70 })
                .toBuffer();

            const thumbnailPath = this.getThumbnailPath(filename);
            
            const uploadResult = await this.storageProviders[this.activeProvider].upload({
                filename: path.basename(thumbnailPath),
                buffer: thumbnailBuffer,
                mimetype: 'image/webp',
                storagePath: thumbnailPath,
                makePublic: true
            });

            return uploadResult.publicUrl;
        } catch (error) {
            console.error('Thumbnail generation error:', error);
            return null;
        }
    }

    async extractImageMetadata(buffer) {
        try {
            const metadata = await sharp(buffer).metadata();
            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                space: metadata.space,
                channels: metadata.channels,
                depth: metadata.depth,
                density: metadata.density,
                hasProfile: metadata.hasProfile,
                hasAlpha: metadata.hasAlpha
            };
        } catch (error) {
            console.error('Metadata extraction error:', error);
            return {};
        }
    }

    generateCSV(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return '';
        }

        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];

        for (const row of data) {
            const values = headers.map(header => {
                const value = row[header];
                if (value === null || value === undefined) return '';
                if (typeof value === 'string' && value.includes(',')) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return String(value);
            });
            csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
    }

    async generatePDF(data) {
        // This would integrate with a PDF library like puppeteer or jsPDF
        // For now, return a simple text-based PDF
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument();
        
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        
        return new Promise((resolve) => {
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });

            doc.fontSize(16).text('Auto-Alert Export Report', 50, 50);
            doc.fontSize(12).text(JSON.stringify(data, null, 2), 50, 100);
            doc.end();
        });
    }

    // Database integration methods (to be implemented with your ORM)
    async getFileRecord(fileId) {
        // Implementation depends on your database setup
        // This should query the file_storage.user_files table
        throw new Error('Database integration not implemented');
    }

    async getUserFiles(userId, fileType = null) {
        // Implementation depends on your database setup
        throw new Error('Database integration not implemented');
    }

    async getExpiredFiles() {
        // Implementation depends on your database setup
        throw new Error('Database integration not implemented');
    }

    async markFileDeleted(fileId) {
        // Implementation depends on your database setup
        throw new Error('Database integration not implemented');
    }

    async findDuplicateFiles() {
        // Implementation depends on your database setup
        throw new Error('Database integration not implemented');
    }

    async updateFileReferences(oldFileId, newFileId) {
        // Implementation depends on your database setup
        throw new Error('Database integration not implemented');
    }
}

// Local Storage Provider
class LocalStorageProvider {
    constructor(config) {
        this.config = config;
    }

    async initialize() {
        // Ensure base directory exists
        await fs.mkdir(this.config.baseStoragePath, { recursive: true });
    }

    async upload({ filename, buffer, mimetype, storagePath, makePublic }) {
        const fullPath = path.join(this.config.baseStoragePath, storagePath);
        const directory = path.dirname(fullPath);
        
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(fullPath, buffer);

        const publicUrl = makePublic ? 
            `${this.config.cdnBaseUrl}/files/${storagePath}` : null;

        return {
            storagePath,
            publicUrl,
            cdnUrl: publicUrl
        };
    }

    async download(storagePath) {
        const fullPath = path.join(this.config.baseStoragePath, storagePath);
        return await fs.readFile(fullPath);
    }

    async delete(storagePath) {
        const fullPath = path.join(this.config.baseStoragePath, storagePath);
        try {
            await fs.unlink(fullPath);
            return true;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            return false;
        }
    }
}

// S3 Storage Provider (placeholder - would need AWS SDK)
class S3StorageProvider {
    constructor(config) {
        this.config = config;
        // Initialize AWS S3 client
    }

    async initialize() {
        // Initialize S3 connection
    }

    async upload({ filename, buffer, mimetype, storagePath, makePublic }) {
        // Implement S3 upload
    }

    async download(storagePath) {
        // Implement S3 download
    }

    async delete(storagePath) {
        // Implement S3 delete
    }
}

// Cloudinary Storage Provider (placeholder)
class CloudinaryStorageProvider {
    constructor(config) {
        this.config = config;
        // Initialize Cloudinary
    }

    async initialize() {
        // Initialize Cloudinary connection
    }

    async upload({ filename, buffer, mimetype, storagePath, makePublic }) {
        // Implement Cloudinary upload
    }

    async download(storagePath) {
        // Implement Cloudinary download
    }

    async delete(storagePath) {
        // Implement Cloudinary delete
    }
}

module.exports = {
    FileStorageService,
    LocalStorageProvider,
    S3StorageProvider,
    CloudinaryStorageProvider
};