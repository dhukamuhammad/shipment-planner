const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ✅ FIX: server/uploads/ me save karo — client/public/ Vite watch karta tha
// jab bhi file save/delete hoti thi wahan, Vite full page reload trigger karta tha
// Ab server/uploads/ Vite ke scope se bahar hai → koi page refresh nahi hoga
const uploadDirectory = path.join(__dirname, "../uploads");

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