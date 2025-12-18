import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload de arquivo para Cloudinary a partir de buffer
 * @param {Buffer} buffer - Buffer do arquivo
 * @param {string} folder - Pasta no Cloudinary (ex: 'fotos', 'exames', 'audio')
 * @param {string} resourceType - Tipo de recurso: 'image', 'video', 'raw', 'auto'
 * @param {Object} options - Opções adicionais do Cloudinary
 * @returns {Promise<Object>} Resultado do upload
 */
export const uploadToCloudinary = (buffer, folder, resourceType = 'auto', options = {}) => {
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
