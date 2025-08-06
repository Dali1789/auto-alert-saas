/**
 * FileStorageService Unit Tests - London School TDD
 * Focus on storage provider interactions and file operation contracts
 */

const { FileStorageService, LocalStorageProvider } = require('../../../storage/files/file-storage-service');
const { createFileSystemMock } = require('../../mocks/external-apis.mock');
const { TestDataBuilder } = require('../../fixtures/test-data');

// Mock dependencies
jest.mock('fs/promises');
jest.mock('sharp');
jest.mock('crypto');
jest.mock('multer');
jest.mock('uuid');

describe('FileStorageService', () => {
  let fileStorageService;
  let mockFileSystem;
  let mockSharp;
  let mockCrypto;

  beforeEach(() => {
    mockFileSystem = createFileSystemMock();
    
    // Mock sharp
    mockSharp = mockFileSystem.createSharpMock(Buffer.from('test-image'));
    require('sharp').mockReturnValue(mockSharp);

    // Mock crypto
    mockCrypto = {
      createHash: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          digest: jest.fn().mockReturnValue('test-checksum')
        })
      })
    };
    require('crypto').createHash = mockCrypto.createHash;

    // Mock UUID
    require('uuid').v4 = jest.fn().mockReturnValue('test-uuid-123');

    // Mock multer
    require('multer').memoryStorage = jest.fn();
    require('multer').mockImplementation((config) => ({
      storage: config.storage,
      limits: config.limits,
      fileFilter: config.fileFilter
    }));

    // Mock fs/promises
    require('fs/promises').mkdir = jest.fn().mockResolvedValue();
    require('fs/promises').writeFile = jest.fn().mockResolvedValue();
    require('fs/promises').readFile = jest.fn().mockResolvedValue(Buffer.from('test-data'));
    require('fs/promises').unlink = jest.fn().mockResolvedValue();

    // Initialize service with local provider
    fileStorageService = new FileStorageService({
      baseStoragePath: './test-storage',
      provider: 'local'
    });
  });

  afterEach(() => {
    mockFileSystem.reset();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    describe('initialize', () => {
      it('should ensure all required directories are created', async () => {
        // Act
        await fileStorageService.initialize();

        // Assert
        const expectedDirectories = [
          'avatars',
          'vehicle-images',
          'documents',
          'exports',
          'temp',
          'thumbnails'
        ];

        expectedDirectories.forEach(dir => {
          expect(require('fs/promises').mkdir).toHaveBeenCalledWith(
            expect.stringContaining(dir),
            { recursive: true }
          );
        });
      });

      it('should initialize active storage provider', async () => {
        // Arrange
        const mockProvider = {
          initialize: jest.fn().mockResolvedValue()
        };
        fileStorageService.storageProviders.local = mockProvider;

        // Act
        await fileStorageService.initialize();

        // Assert
        expect(mockProvider.initialize).toHaveBeenCalled();
      });
    });
  });

  describe('File Upload Operations', () => {
    describe('uploadFile', () => {
      it('should orchestrate complete file upload workflow', async () => {
        // Arrange
        const fileData = TestDataBuilder.fileData({
          originalname: 'test-document.pdf',
          buffer: Buffer.from('pdf-content'),
          mimetype: 'application/pdf'
        });

        const mockProvider = {
          upload: jest.fn().mockResolvedValue({
            storagePath: 'documents/test-uuid-123.pdf',
            publicUrl: 'https://cdn.example.com/documents/test-uuid-123.pdf',
            cdnUrl: 'https://cdn.example.com/documents/test-uuid-123.pdf'
          })
        };
        fileStorageService.storageProviders.local = mockProvider;

        // Act
        const result = await fileStorageService.uploadFile(fileData, {
          userId: 'user_123',
          fileType: 'document',
          makePublic: true
        });

        // Assert
        expect(result).toMatchObject({
          id: 'test-uuid-123',
          userId: 'user_123',
          filename: 'test-uuid-123.pdf',
          originalFilename: 'test-document.pdf',
          fileType: 'document',
          mimeType: 'application/pdf',
          accessLevel: 'public',
          checksum: 'test-checksum',
          storageProvider: 'local'
        });

        // Verify provider interaction
        expect(mockProvider.upload).toHaveBeenCalledWith({
          filename: 'test-uuid-123.pdf',
          buffer: expect.any(Buffer),
          mimetype: 'application/pdf',
          storagePath: 'documents/test-uuid-123.pdf',
          makePublic: true
        });

        // Verify checksum calculation
        expect(mockCrypto.createHash).toHaveBeenCalledWith('sha256');
      });

      it('should optimize images when enabled', async () => {
        // Arrange
        const imageFile = TestDataBuilder.fileData({
          originalname: 'photo.jpg',
          buffer: Buffer.from('large-image-data'),
          mimetype: 'image/jpeg'
        });

        const mockProvider = {
          upload: jest.fn().mockResolvedValue({
            storagePath: 'documents/test-uuid-123.jpg',
            publicUrl: 'https://cdn.example.com/documents/test-uuid-123.jpg'
          })
        };
        fileStorageService.storageProviders.local = mockProvider;

        const optimizedBuffer = Buffer.from('optimized-image-data');
        mockSharp.jpeg.mockReturnValue(mockSharp);
        mockSharp.toBuffer.mockResolvedValue(optimizedBuffer);

        // Act
        await fileStorageService.uploadFile(imageFile, {
          userId: 'user_123',
          optimizeImage: true
        });

        // Assert
        expect(require('sharp')).toHaveBeenCalledWith(imageFile.buffer);
        expect(mockSharp.resize).toHaveBeenCalled();
        expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 80, progressive: true });
        expect(mockProvider.upload).toHaveBeenCalledWith(
          expect.objectContaining({
            buffer: optimizedBuffer
          })
        );
      });

      it('should generate thumbnails when requested', async () => {
        // Arrange
        const imageFile = TestDataBuilder.fileData({
          mimetype: 'image/jpeg'
        });

        const mockProvider = {
          upload: jest.fn()
            .mockResolvedValueOnce({
              storagePath: 'documents/test-uuid-123.jpg',
              publicUrl: 'https://cdn.example.com/documents/test-uuid-123.jpg'
            })
            .mockResolvedValueOnce({
              storagePath: 'thumbnails/test-uuid-123_thumb.webp',
              publicUrl: 'https://cdn.example.com/thumbnails/test-uuid-123_thumb.webp'
            })
        };
        fileStorageService.storageProviders.local = mockProvider;

        const thumbnailBuffer = Buffer.from('thumbnail-data');
        const thumbnailSharp = {
          resize: jest.fn().mockReturnThis(),
          webp: jest.fn().mockReturnThis(),
          toBuffer: jest.fn().mockResolvedValue(thumbnailBuffer)
        };
        require('sharp').mockReturnValueOnce(mockSharp).mockReturnValueOnce(thumbnailSharp);

        // Act
        const result = await fileStorageService.uploadFile(imageFile, {
          userId: 'user_123',
          generateThumbnail: true
        });

        // Assert
        expect(result.thumbnailUrl).toBe('https://cdn.example.com/thumbnails/test-uuid-123_thumb.webp');
        expect(mockProvider.upload).toHaveBeenCalledTimes(2); // Original + thumbnail
        
        // Verify thumbnail creation
        expect(thumbnailSharp.resize).toHaveBeenCalledWith(300, 200, {
          fit: 'cover',
          position: 'center'
        });
        expect(thumbnailSharp.webp).toHaveBeenCalledWith({ quality: 70 });
      });

      it('should validate file size and type', async () => {
        // Arrange
        const testCases = [
          {
            fileData: TestDataBuilder.fileData({ buffer: Buffer.alloc(0) }),
            expectedError: 'File buffer is empty'
          },
          {
            fileData: TestDataBuilder.fileData({ 
              buffer: Buffer.alloc(15 * 1024 * 1024), // 15MB > 10MB limit
              mimetype: 'image/jpeg'
            }),
            expectedError: 'File size exceeds maximum limit'
          },
          {
            fileData: TestDataBuilder.fileData({ mimetype: 'application/x-malware' }),
            expectedError: 'File type application/x-malware not allowed'
          }
        ];

        for (const { fileData, expectedError } of testCases) {
          // Act & Assert
          await expect(
            fileStorageService.uploadFile(fileData, { userId: 'user_123' })
          ).rejects.toThrow(expectedError);
        }
      });
    });

    describe('uploadVehicleImages', () => {
      it('should handle batch image upload with metadata extraction', async () => {
        // Arrange
        const imageFiles = [
          TestDataBuilder.fileData({ originalname: 'front.jpg' }),
          TestDataBuilder.fileData({ originalname: 'interior.jpg' }),
          TestDataBuilder.fileData({ originalname: 'engine.jpg' })
        ];

        const mockProvider = {
          upload: jest.fn()
            .mockResolvedValueOnce({ publicUrl: 'https://cdn.com/image1.jpg' })
            .mockResolvedValueOnce({ publicUrl: 'https://cdn.com/image2.jpg' })
            .mockResolvedValueOnce({ publicUrl: 'https://cdn.com/image3.jpg' })
        };
        fileStorageService.storageProviders.local = mockProvider;

        // Mock metadata extraction
        mockSharp.metadata.mockResolvedValue({
          width: 1920,
          height: 1080,
          format: 'jpeg'
        });

        // Act
        const results = await fileStorageService.uploadVehicleImages(
          imageFiles, 
          'vehicle_123', 
          'user_123'
        );

        // Assert
        expect(results).toHaveLength(3);
        results.forEach((result, index) => {
          expect(result.fileType).toBe('vehicle-image');
          expect(result.metadata.vehicleId).toBe('vehicle_123');
          expect(result.metadata.imageIndex).toBe(index);
          expect(result.accessLevel).toBe('public');
        });

        // Verify all images were processed
        expect(mockProvider.upload).toHaveBeenCalledTimes(6); // 3 images + 3 thumbnails
      });

      it('should handle partial failures in batch upload', async () => {
        // Arrange
        const imageFiles = [
          TestDataBuilder.fileData({ originalname: 'valid.jpg' }),
          TestDataBuilder.fileData({ 
            originalname: 'corrupted.jpg',
            buffer: Buffer.alloc(0) // Invalid buffer
          })
        ];

        const mockProvider = {
          upload: jest.fn().mockResolvedValue({ publicUrl: 'https://cdn.com/image1.jpg' })
        };
        fileStorageService.storageProviders.local = mockProvider;

        // Act
        const results = await fileStorageService.uploadVehicleImages(
          imageFiles,
          'vehicle_123',
          'user_123'
        );

        // Assert
        expect(results).toHaveLength(1); // Only successful upload
        expect(results[0].originalFilename).toBe('valid.jpg');
      });
    });

    describe('uploadUserAvatar', () => {
      it('should replace existing avatar before uploading new one', async () => {
        // Arrange
        const avatarFile = TestDataBuilder.fileData({
          originalname: 'avatar.jpg',
          mimetype: 'image/jpeg'
        });

        const mockProvider = {
          upload: jest.fn().mockResolvedValue({
            storagePath: 'avatars/test-uuid-123.jpg',
            publicUrl: 'https://cdn.com/avatars/test-uuid-123.jpg'
          })
        };
        fileStorageService.storageProviders.local = mockProvider;

        // Mock deleteUserFiles method
        fileStorageService.deleteUserFiles = jest.fn().mockResolvedValue(1);

        // Act
        const result = await fileStorageService.uploadUserAvatar(avatarFile, 'user_123');

        // Assert
        expect(fileStorageService.deleteUserFiles).toHaveBeenCalledWith('user_123', 'avatar');
        expect(result.fileType).toBe('avatar');
        expect(result.accessLevel).toBe('public');
        expect(result.metadata.isAvatar).toBe(true);
      });
    });
  });

  describe('Export File Generation', () => {
    describe('createExportFile', () => {
      it('should generate CSV export with proper formatting', async () => {
        // Arrange
        const testData = [
          { id: 1, name: 'BMW 3er', price: 25000 },
          { id: 2, name: 'Audi A4', price: 30000 }
        ];

        const mockProvider = {
          upload: jest.fn().mockResolvedValue({
            storagePath: 'exports/search-results-123.csv',
            publicUrl: null // Private file
          })
        };
        fileStorageService.storageProviders.local = mockProvider;

        // Act
        const result = await fileStorageService.createExportFile(
          testData,
          'csv',
          'user_123',
          'search-results'
        );

        // Assert
        expect(result.fileType).toBe('export');
        expect(result.mimeType).toBe('text/csv');
        expect(result.accessLevel).toBe('private');
        expect(result.metadata.format).toBe('csv');
        expect(result.metadata.recordCount).toBe(2);
        expect(result.metadata.expiresAt).toBeDefined();

        // Verify CSV content structure
        const uploadCall = mockProvider.upload.mock.calls[0][0];
        const csvContent = uploadCall.buffer.toString();
        expect(csvContent).toContain('id,name,price');
        expect(csvContent).toContain('1,BMW 3er,25000');
        expect(csvContent).toContain('2,Audi A4,30000');
      });

      it('should generate JSON export', async () => {
        // Arrange
        const testData = { vehicles: [{ id: 1, name: 'BMW' }] };

        const mockProvider = {
          upload: jest.fn().mockResolvedValue({
            storagePath: 'exports/data-123.json'
          })
        };
        fileStorageService.storageProviders.local = mockProvider;

        // Act
        const result = await fileStorageService.createExportFile(
          testData,
          'json',
          'user_123'
        );

        // Assert
        expect(result.mimeType).toBe('application/json');
        
        const uploadCall = mockProvider.upload.mock.calls[0][0];
        const jsonContent = JSON.parse(uploadCall.buffer.toString());
        expect(jsonContent).toEqual(testData);
      });

      it('should handle unsupported export formats', async () => {
        // Arrange & Act & Assert
        await expect(
          fileStorageService.createExportFile([], 'xml', 'user_123')
        ).rejects.toThrow('Unsupported export format: xml');
      });
    });
  });

  describe('File Retrieval and Access Control', () => {
    describe('getFile', () => {
      it('should retrieve file with proper access control', async () => {
        // Arrange
        const fileRecord = {
          id: 'file_123',
          userId: 'user_123',
          accessLevel: 'private',
          storagePath: 'documents/file.pdf',
          storageProvider: 'local'
        };

        fileStorageService.getFileRecord = jest.fn().mockResolvedValue(fileRecord);
        
        const mockProvider = {
          download: jest.fn().mockResolvedValue(Buffer.from('file-content'))
        };
        fileStorageService.storageProviders.local = mockProvider;

        // Act
        const result = await fileStorageService.getFile('file_123', 'user_123');

        // Assert
        expect(result.fileRecord).toEqual(fileRecord);
        expect(result.buffer).toEqual(Buffer.from('file-content'));
        expect(mockProvider.download).toHaveBeenCalledWith('documents/file.pdf');
      });

      it('should deny access to private files from unauthorized users', async () => {
        // Arrange
        const fileRecord = {
          id: 'file_123',
          userId: 'owner_456',
          accessLevel: 'private'
        };

        fileStorageService.getFileRecord = jest.fn().mockResolvedValue(fileRecord);

        // Act & Assert
        await expect(
          fileStorageService.getFile('file_123', 'different_user_789')
        ).rejects.toThrow('Access denied');
      });

      it('should allow access to public files without user check', async () => {
        // Arrange
        const fileRecord = {
          id: 'file_123',
          userId: 'owner_456',
          accessLevel: 'public',
          storagePath: 'images/public.jpg',
          storageProvider: 'local'
        };

        fileStorageService.getFileRecord = jest.fn().mockResolvedValue(fileRecord);
        
        const mockProvider = {
          download: jest.fn().mockResolvedValue(Buffer.from('public-content'))
        };
        fileStorageService.storageProviders.local = mockProvider;

        // Act
        const result = await fileStorageService.getFile('file_123', null);

        // Assert
        expect(result.fileRecord).toEqual(fileRecord);
        expect(result.buffer).toEqual(Buffer.from('public-content'));
      });

      it('should handle file not found', async () => {
        // Arrange
        fileStorageService.getFileRecord = jest.fn().mockResolvedValue(null);

        // Act & Assert
        await expect(
          fileStorageService.getFile('nonexistent_file')
        ).rejects.toThrow('File not found');
      });
    });
  });

  describe('File Deletion', () => {
    describe('deleteFile', () => {
      it('should orchestrate complete file deletion workflow', async () => {
        // Arrange
        const fileRecord = {
          id: 'file_123',
          userId: 'user_123',
          storagePath: 'documents/file.pdf',
          storageProvider: 'local',
          thumbnailUrl: 'https://cdn.com/thumbnails/thumb.webp',
          filename: 'test-file.pdf'
        };

        fileStorageService.getFileRecord = jest.fn().mockResolvedValue(fileRecord);
        fileStorageService.markFileDeleted = jest.fn().mockResolvedValue();

        const mockProvider = {
          delete: jest.fn().mockResolvedValue(true)
        };
        fileStorageService.storageProviders.local = mockProvider;

        // Act
        const result = await fileStorageService.deleteFile('file_123', 'user_123');

        // Assert
        expect(result).toBe(true);
        expect(mockProvider.delete).toHaveBeenCalledWith('documents/file.pdf');
        expect(mockProvider.delete).toHaveBeenCalledWith('thumbnails/test-file_thumb.webp');
        expect(fileStorageService.markFileDeleted).toHaveBeenCalledWith('file_123');
      });

      it('should enforce ownership for deletion', async () => {
        // Arrange
        const fileRecord = {
          id: 'file_123',
          userId: 'owner_456'
        };

        fileStorageService.getFileRecord = jest.fn().mockResolvedValue(fileRecord);

        // Act & Assert
        await expect(
          fileStorageService.deleteFile('file_123', 'different_user_789')
        ).rejects.toThrow('Access denied');
      });
    });

    describe('deleteUserFiles', () => {
      it('should delete all files for user with specific type', async () => {
        // Arrange
        const userFiles = [
          { id: 'file_1', filename: 'avatar1.jpg' },
          { id: 'file_2', filename: 'avatar2.jpg' }
        ];

        fileStorageService.getUserFiles = jest.fn().mockResolvedValue(userFiles);
        fileStorageService.deleteFile = jest.fn()
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(true);

        // Act
        const deletedCount = await fileStorageService.deleteUserFiles('user_123', 'avatar');

        // Assert
        expect(deletedCount).toBe(2);
        expect(fileStorageService.getUserFiles).toHaveBeenCalledWith('user_123', 'avatar');
        expect(fileStorageService.deleteFile).toHaveBeenCalledTimes(2);
      });

      it('should handle partial deletion failures', async () => {
        // Arrange
        const userFiles = [
          { id: 'file_1' },
          { id: 'file_2' },
          { id: 'file_3' }
        ];

        fileStorageService.getUserFiles = jest.fn().mockResolvedValue(userFiles);
        fileStorageService.deleteFile = jest.fn()
          .mockResolvedValueOnce(true)
          .mockRejectedValueOnce(new Error('Delete failed'))
          .mockResolvedValueOnce(true);

        // Act
        const deletedCount = await fileStorageService.deleteUserFiles('user_123');

        // Assert
        expect(deletedCount).toBe(2); // Only successful deletions
      });
    });
  });

  describe('Storage Optimization', () => {
    describe('cleanupExpiredFiles', () => {
      it('should remove files past expiration date', async () => {
        // Arrange
        const expiredFiles = [
          { id: 'expired_1' },
          { id: 'expired_2' },
          { id: 'expired_3' }
        ];

        fileStorageService.getExpiredFiles = jest.fn().mockResolvedValue(expiredFiles);
        fileStorageService.deleteFile = jest.fn()
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(true)
          .mockRejectedValueOnce(new Error('Cleanup failed'));

        // Act
        const cleanedCount = await fileStorageService.cleanupExpiredFiles();

        // Assert
        expect(cleanedCount).toBe(2);
        expect(fileStorageService.deleteFile).toHaveBeenCalledTimes(3);
      });
    });

    describe('optimizeStorage', () => {
      it('should deduplicate files by checksum', async () => {
        // Arrange
        const duplicateGroups = [
          [
            { id: 'file_1', checksum: 'abc123' },
            { id: 'file_2', checksum: 'abc123' },
            { id: 'file_3', checksum: 'abc123' }
          ]
        ];

        fileStorageService.findDuplicateFiles = jest.fn().mockResolvedValue(duplicateGroups);
        fileStorageService.updateFileReferences = jest.fn().mockResolvedValue();
        fileStorageService.deleteFile = jest.fn().mockResolvedValue(true);

        // Act
        const optimizedCount = await fileStorageService.optimizeStorage();

        // Assert
        expect(optimizedCount).toBe(2); // Keep first, delete 2 duplicates
        expect(fileStorageService.updateFileReferences).toHaveBeenCalledTimes(2);
        expect(fileStorageService.deleteFile).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Configuration and Contract Verification', () => {
    it('should support multiple storage providers', () => {
      // Arrange & Act
      const serviceWithS3 = new FileStorageService({
        provider: 's3',
        s3Config: { bucket: 'test-bucket' }
      });

      // Assert
      expect(serviceWithS3.activeProvider).toBe('s3');
      expect(serviceWithS3.storageProviders.s3).toBeDefined();
    });

    it('should maintain expected public interface', () => {
      // Arrange
      const expectedMethods = [
        'initialize',
        'uploadFile',
        'uploadVehicleImages',
        'uploadUserAvatar',
        'createExportFile',
        'getFile',
        'deleteFile',
        'deleteUserFiles',
        'cleanupExpiredFiles',
        'optimizeStorage'
      ];

      // Assert
      expectedMethods.forEach(method => {
        expect(typeof fileStorageService[method]).toBe('function');
      });
    });

    it('should properly configure multer middleware', () => {
      // Act
      const multerConfig = fileStorageService.getMulterConfig();

      // Assert
      expect(multerConfig).toBeDefined();
      expect(multerConfig.limits.fileSize).toBe(10 * 1024 * 1024);
      expect(multerConfig.limits.files).toBe(10);
      expect(typeof multerConfig.fileFilter).toBe('function');
    });

    it('should validate supported file types correctly', () => {
      // Arrange
      const multerConfig = fileStorageService.getMulterConfig();
      const mockCallback = jest.fn();

      // Act - Test allowed type
      const allowedFile = { mimetype: 'image/jpeg' };
      multerConfig.fileFilter(null, allowedFile, mockCallback);
      expect(mockCallback).toHaveBeenCalledWith(null, true);

      // Reset mock
      mockCallback.mockClear();

      // Act - Test disallowed type
      const disallowedFile = { mimetype: 'application/x-malware' };
      multerConfig.fileFilter(null, disallowedFile, mockCallback);
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'File type application/x-malware not allowed'
        })
      );
    });
  });
});