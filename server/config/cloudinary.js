import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';

const hasConfig = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (hasConfig) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} else if (process.env.NODE_ENV !== 'test') {
  console.warn('[Cloudinary] Credenciais não configuradas. Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET no .env. Uploads usarão pasta local /uploads.');
}

/**
 * Upload de arquivo para Cloudinary a partir de buffer
 * @param {Buffer} buffer - Buffer do arquivo
 * @param {string} folder - Pasta no Cloudinary (ex: 'fotos', 'exames', 'audio')
 * @param {string} resourceType - Tipo de recurso: 'image', 'video', 'raw', 'auto'
 * @param {Object} options - Opções adicionais do Cloudinary
 * @returns {Promise<Object>} Resultado do upload
 */
export function isCloudinaryConfigured() {
  return hasConfig;
}

/**
 * Salva buffer localmente quando Cloudinary não está configurado (fallback para desenvolvimento).
 * Retorna objeto no formato { secure_url, url, public_id } compatível com o esperado pelo middleware.
 */
export function uploadToLocalFallback(buffer, folder, originalName = 'file') {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', folder);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const ext = path.extname(originalName) || (folder === 'fotos' ? '.jpg' : '.bin');
  const filename = `${folder}_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, buffer);
  const publicId = `${folder}/${filename}`;
  const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || process.env.PORT_BACKEND || 65432}`;
  const url = `${baseUrl}/uploads/${folder}/${filename}`;
  return { secure_url: url, url, public_id: publicId };
}

export const uploadToCloudinary = (buffer, folder, resourceType = 'auto', options = {}) => {
  if (!hasConfig) {
    return Promise.reject(new Error('CLOUDINARY_NOT_CONFIGURED'));
  }
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: `pulseflow/${folder}`,
      resource_type: resourceType,
      ...options
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    // Converter buffer para stream
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);
    readableStream.pipe(uploadStream);
  });
};

/**
 * Upload de arquivo a partir de caminho local
 * @param {string} filePath - Caminho do arquivo local
 * @param {string} folder - Pasta no Cloudinary
 * @param {string} resourceType - Tipo de recurso
 * @param {Object} options - Opções adicionais
 * @returns {Promise<Object>} Resultado do upload
 */
export const uploadFileToCloudinary = (filePath, folder, resourceType = 'auto', options = {}) => {
  const uploadOptions = {
    folder: `pulseflow/${folder}`,
    resource_type: resourceType,
    ...options
  };

  return cloudinary.uploader.upload(filePath, uploadOptions);
};

/**
 * Deletar arquivo do Cloudinary
 * @param {string} publicId - Public ID do arquivo no Cloudinary
 * @param {string} resourceType - Tipo de recurso
 * @returns {Promise<Object>} Resultado da deleção
 */
export const deleteFromCloudinary = (publicId, resourceType = 'image') => {
  if (!hasConfig) return Promise.resolve({ result: 'ok' });
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType
  });
};

/**
 * Gerar URL otimizada do Cloudinary
 * @param {string} publicId - Public ID do arquivo
 * @param {Object} transformations - Transformações a aplicar
 * @returns {string} URL otimizada
 */
export const getCloudinaryUrl = (publicId, transformations = {}) => {
  return cloudinary.url(publicId, {
    secure: true,
    ...transformations
  });
};

export default cloudinary;
