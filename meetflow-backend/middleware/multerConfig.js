import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '../Uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// L'extension est déduite du type MIME validé, jamais du nom fourni par le client
// (sinon un fichier "photo.html" déclaré image/png serait servi comme HTML).
const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.user.id}-${Date.now()}${EXTENSIONS[file.mimetype]}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (EXTENSIONS[file.mimetype]) {
      cb(null, true);
    } else {
      const err = new Error('Only JPEG, PNG or GIF images are allowed.');
      err.status = 400;
      cb(err);
    }
  },
});

export default upload;
