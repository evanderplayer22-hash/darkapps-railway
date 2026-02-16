const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const app = express();

app.use(express.static('public'));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', 'views');

// Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Create directories
['uploads', 'data'].forEach(dir => fs.ensureDirSync(dir));

// Routes
app.get('/', (req, res) => {
  const success = req.query.success;
  const link = req.query.link;
  res.render('index', { success, link });
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  
  const id = Math.random().toString(36).substr(2, 8);
  const fileData = {
    name: req.file.originalname,
    path: req.file.path,
    size: req.file.size,
    views: 0,
    downloads: 0,
    earnings: 0,
    created: new Date().toISOString()
  };
  
  fs.writeJSONSync(`data/${id}.json`, fileData);
  res.json({ success: true, link: `${req.protocol}://${req.get('host')}/dl/${id}` });
});

app.get('/dl/:id', (req, res) => {
  const id = req.params.id;
  const fileData = fs.readJSONSync(`data/${id}.json`);
  fileData.views++;
  fileData.earnings += 0.05;
  fs.writeJSONSync(`data/${id}.json`, fileData);
  
  res.render('dl', { file: fileData, host: req.get('host') });
});

app.get('/dl/:id/download', (req, res) => {
  const id = req.params.id;
  const fileData = fs.readJSONSync(`data/${id}.json`);
  fileData.downloads++;
  fileData.earnings += 0.20;
  fs.writeJSONSync(`data/${id}.json`, fileData);
  
  res.download(fileData.path, fileData.name, (err) => {
    if (err) res.status(404).send('File not found');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 DarkApps on port ${PORT}`));
