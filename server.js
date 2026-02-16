const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const app = express();
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', './views');

// FIX: Railway persistent storage path
const UPLOAD_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(os.tmpdir(), 'darkapps');
const DATA_DIR = path.join(UPLOAD_DIR, 'data');
const UPLOADS_DIR = path.join(UPLOAD_DIR, 'uploads');

// Create directories (FIX CRÍTICO)
[UPLOAD_DIR, DATA_DIR, UPLOADS_DIR].forEach(async (dir) => {
  await fs.ensureDir(dir);
  console.log(`✅ Created: ${dir}`);
});

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.ensureDir(UPLOADS_DIR);
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 512 * 1024 * 1024 } // 512MB
});

// PING para Railway (mantém vivo)
app.get('/ping', (req, res) => res.send('OK'));

// HOME
app.get('/', (req, res) => {
  res.render('index');
});

// UPLOAD
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const id = 'file_' + Date.now().toString(36);
    const fileData = {
      id,
      name: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      views: 0,
      downloads: 0,
      earnings: 0.0,
      created: new Date().toISOString()
    };
    
    await fs.writeJson(`${DATA_DIR}/${id}.json`, fileData);
    res.json({ 
      success: true, 
      link: `${req.protocol}://${req.get('host')}/dl/${id}`,
      message: 'Upload OK! Ganhe R$0,20/dl'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// DOWNLOAD PAGE
app.get('/dl/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const fileData = await fs.readJson(`${DATA_DIR}/${id}.json`);
    
    fileData.views++;
    fileData.earnings += 0.05;
    await fs.writeJson(`${DATA_DIR}/${id}.json`, fileData);
    
    res.render('dl', { 
      file: fileData, 
      host: req.get('host'),
      baseUrl: `${req.protocol}://${req.get('host')}`
    });
  } catch (error) {
    res.status(404).send('<h1 style="color:red;padding:100px;">❌ Arquivo não encontrado</h1>');
  }
});

// DOWNLOAD
app.get('/dl/:id/download', async (req, res) => {
  try {
    const id = req.params.id;
    const fileData = await fs.readJson(`${DATA_DIR}/${id}.json`);
    
    fileData.downloads++;
    fileData.earnings += 0.20;
    await fs.writeJson(`${DATA_DIR}/${id}.json`, fileData);
    
    res.download(fileData.path, fileData.name);
  } catch (error) {
    res.status(404).send('File not found');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 DarkApps rodando na porta ${PORT}`);
  console.log(`📁 Uploads: ${UPLOADS_DIR}`);
});
