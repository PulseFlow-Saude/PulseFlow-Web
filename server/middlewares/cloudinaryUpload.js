import multer from 'multer';
import { uploadToCloudinary, uploadToLocalFallback, isCloudinaryConfigured } from '../config/cloudinary.js';

/**
 * Middleware para upload direto ao Cloudinary usando multer memory storage
 * @param {string} folder - Pasta no Cloudinary
 * @param {string} resourceType - Tipo de recurso: 'image', 'video', 'raw', 'auto'
 * @param {Object} multerOptions - Opções do multer (limits, fileFilter, etc)
 * @returns {Function} Middleware do multer
 */
export const cloudinaryUpload = (folder, resourceType = 'auto', multerOptions = {}) => {
  // Usar memory storage para enviar direto ao Cloudinary
  const storage = multer.memoryStorage();

  const upload = multer({
    storage,
    ...multerOptions
  });

  // Middleware customizado que faz upload ao Cloudinary após multer processar
  const singleUpload = upload.single(multerOptions.fieldName || 'file');
  
  return async (req, res, next) => {
    singleUpload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }

      if (!req.file) {
        return next();
      }

      try {
        let result;
        if (isCloudinaryConfigured()) {
          result = await uploadToCloudinary(
            req.file.buffer,
            folder,
            resourceType,
            {
              public_id: `${folder}_${Date.now()}_${Math.round(Math.random() * 1E9)}`,
              format: req.file.mimetype.split('/')[1] || 'auto'
            }
          );
        } else {
          result = uploadToLocalFallback(req.file.buffer, folder, req.file.originalname);
        }

        req.file.cloudinary = {
          public_id: result.public_id,
          secure_url: result.secure_url,
          url: result.url,
          format: result.format,
          bytes: result.bytes,
          width: result.width,
          height: result.height
        };

        req.file.filename = result.public_id;
        req.file.path = result.secure_url;
        req.file.url = result.secure_url;

        next();
      } catch (cloudinaryError) {
        const useFallback = !isCloudinaryConfigured() ||
          cloudinaryError.message === 'CLOUDINARY_NOT_CONFIGURED' ||
          (cloudinaryError.message && cloudinaryError.message.includes('api_key'));
        if (useFallback) {
          try {
            const result = uploadToLocalFallback(req.file.buffer, folder, req.file.originalname);
            req.file.cloudinary = { public_id: result.public_id, secure_url: result.secure_url, url: result.url };
            req.file.filename = result.public_id;
            req.file.path = result.secure_url;
            req.file.url = result.secure_url;
            return next();
          } catch (fallbackErr) {
            if (process.env.NODE_ENV === 'development') console.error('Fallback local falhou:', fallbackErr);
          }
        }
        if (process.env.NODE_ENV === 'development') {
          console.error('Erro ao fazer upload para Cloudinary:', cloudinaryError);
        }
        return res.status(500).json({
          message: 'Erro ao fazer upload do arquivo',
          error: process.env.NODE_ENV === 'development' ? cloudinaryError.message : 'Erro interno'
        });
      }
    });
  };
};

/**
 * Middleware para múltiplos arquivos
 */
export const cloudinaryUploadMultiple = (folder, resourceType = 'auto', multerOptions = {}) => {
  const storage = multer.memoryStorage();

  const upload = multer({
    storage,
    ...multerOptions
  });

  const multipleUpload = upload.array(multerOptions.fieldName || 'files', multerOptions.maxCount || 10);

  return async (req, res, next) => {
    multipleUpload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }

      if (!req.files || req.files.length === 0) {
        return next();
      }

      try {
        const isCloudinary = isCloudinaryConfigured();
        const results = await Promise.all(req.files.map(async (file, index) => {
          if (isCloudinary) {
            return uploadToCloudinary(
              file.buffer,
              folder,
              resourceType,
              {
                public_id: `${folder}_${Date.now()}_${index}_${Math.round(Math.random() * 1E9)}`,
                format: file.mimetype.split('/')[1] || 'auto'
              }
            );
          }
          return uploadToLocalFallback(file.buffer, folder, file.originalname);
        }));

        req.files = req.files.map((file, index) => {
          const result = results[index];
          return {
            ...file,
            cloudinary: {
              public_id: result.public_id,
              secure_url: result.secure_url,
              url: result.url,
              format: result.format,
              bytes: result.bytes
            },
            filename: result.public_id,
            path: result.secure_url,
            url: result.secure_url
          };
        });

        next();
      } catch (cloudinaryError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Erro ao fazer upload para Cloudinary:', cloudinaryError);
        }
        return res.status(500).json({
          message: 'Erro ao fazer upload dos arquivos',
          error: process.env.NODE_ENV === 'development' ? cloudinaryError.message : 'Erro interno'
        });
      }
    });
  };
};
