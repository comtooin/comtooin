import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import pool from './db';
import requestRoutes from './routes/requestRoutes';
import adminRoutes from './routes/adminRoutes';
import { guideRouter } from './routes/guideRoutes';
import fs from 'fs'; // Import fs module

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/guide', guideRouter);

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));

// --- Dynamic Frontend Path ---
// Path for production (when server runs from 'dist' folder)
const prodFrontendPath = path.resolve(__dirname, '..', 'build');
// Path for development (when server runs from 'src' folder)
const devFrontendPath = path.resolve(__dirname, '..', '..', 'frontend', 'build');

let frontendPath;

if (fs.existsSync(prodFrontendPath)) {
  frontendPath = prodFrontendPath;
  console.log(`Serving frontend from production path: ${frontendPath}`);
} else if (fs.existsSync(devFrontendPath)) {
  frontendPath = devFrontendPath;
  console.log(`Serving frontend from development path: ${frontendPath}`);
} else {
  console.error('FATAL: Frontend build directory not found in expected locations.');
}

if (frontendPath) {
  // Serve static files from the determined frontend build path
  app.use(express.static(frontendPath));
  // For any other route, serve the index.html file
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
    // Optional: handle case where build is not found
    app.get('*', (req, res) => {
      res.status(500).send('Error: Frontend build directory not found. Please build the frontend project.');
    });
}
// --- End of Dynamic Path ---

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port: ${port}`);
});
