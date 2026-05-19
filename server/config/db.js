import mongoose from 'mongoose';
import { CONFIG } from './ports.js';

const connectDB = async (opts = {}) => {
  try {
    if (!CONFIG.MONGO_URI) {
      throw new Error('MONGO_URI não está definida nas variáveis de ambiente. Verifique o arquivo .env na raiz do projeto.');
    }

    const bulk = opts.bulk === true;
    await mongoose.connect(CONFIG.MONGO_URI, {
      serverSelectionTimeoutMS: bulk ? 60_000 : 10_000,
      socketTimeoutMS: bulk ? 600_000 : 45_000,
      connectTimeoutMS: bulk ? 60_000 : 30_000,
      maxPoolSize: bulk ? 20 : 10,
      retryWrites: true
    });
    console.log('Conectado ao MongoDB com sucesso!');
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error.message);
    process.exit(1);
  }
};

export default connectDB;
