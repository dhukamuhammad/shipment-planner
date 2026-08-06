const db = require('./config/db');
const bcrypt = require('bcrypt');

const setupAuth = async () => {
    try {
        console.log("Creating users table...");
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('super_admin', 'employee') NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await db.query(createTableQuery);
        console.log("Users table created successfully.");

        console.log("Checking for super_admin...");
        const [rows] = await db.query("SELECT * FROM users WHERE email = 'admin@crasome.com'");
        if (rows.length === 0) {
            console.log("Super admin not found. Creating default super admin...");
            const hashedPassword = await bcrypt.hash('Admin@123', 10);
            const insertQuery = `
                INSERT INTO users (name, email, password, role)
                VALUES ('Super Admin', 'admin@crasome.com', ?, 'super_admin')
            `;
            await db.query(insertQuery, [hashedPassword]);
            console.log("Super admin created: admin@crasome.com / Admin@123");
        } else {
            console.log("Super admin already exists.");
        }
    } catch (error) {
        console.error("Error setting up auth:", error);
    } finally {
        process.exit(0);
    }
};

setupAuth();
