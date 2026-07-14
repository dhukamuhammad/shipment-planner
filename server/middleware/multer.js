const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDirectory = path.join(__dirname, "../../client/public/upload");

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
}

// MULTER CONFIGURATION
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },  
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const originalBaseName = path.parse(file.originalname).name;

        // Spaces ko '-' me replace kar rahe hain taaki URL/Path me problem na aaye
        const cleanBaseName = originalBaseName.replace(/\s+/g, '-');

        // Seedha clean name aur extension jod diya (bina kisi random number ke)
        cb(null, cleanBaseName + ext);
    }
});

const upload = multer({ storage: storage });

module.exports = upload;