import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

const PORT = process.env.PORT_FRONTEND || 3000;
const BACKEND_PORT = process.env.PORT_BACKEND || 65432;

const app = express();

// Em dev, front (ex.: :3000) não serve /uploads — redireciona para o backend onde os arquivos existem
app.use('/uploads', (req, res, next) => {
  const local =
    req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  if (process.env.NODE_ENV !== 'production' && local) {
    return res.redirect(302, `http://127.0.0.1:${BACKEND_PORT}${req.originalUrl}`);
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));

app.use('/client/public', express.static(path.join(__dirname, 'public')));
app.use('/client/views', express.static(path.join(__dirname, 'views')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'homePage.html'));
});

app.get('/client/views/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/client/views/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/client/views/homePage.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'homePage.html'));
});

app.get('/client/views/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/client/views/:filename', (req, res) => {
  const filename = req.params.filename;
  res.sendFile(path.join(__dirname, 'views', filename));
});

app.listen(PORT, () => {
  console.log(`Frontend servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
