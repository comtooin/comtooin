"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const requestRoutes_1 = __importDefault(require("./routes/requestRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const guideRoutes_1 = require("./routes/guideRoutes");
const fs_1 = __importDefault(require("fs")); // Import fs module
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = Number(process.env.PORT) || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api/requests', requestRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/guide', guideRoutes_1.guideRouter);
// Serve uploaded files
app.use('/uploads', express_1.default.static(path_1.default.resolve(__dirname, '..', 'uploads')));
// --- Dynamic Frontend Path ---
// Path for production (when server runs from 'dist' folder)
const prodFrontendPath = path_1.default.resolve(__dirname, '..', 'build');
// Path for development (when server runs from 'src' folder)
const devFrontendPath = path_1.default.resolve(__dirname, '..', '..', 'frontend', 'build');
let frontendPath;
if (fs_1.default.existsSync(prodFrontendPath)) {
    frontendPath = prodFrontendPath;
    console.log(`Serving frontend from production path: ${frontendPath}`);
}
else if (fs_1.default.existsSync(devFrontendPath)) {
    frontendPath = devFrontendPath;
    console.log(`Serving frontend from development path: ${frontendPath}`);
}
else {
    console.error('FATAL: Frontend build directory not found in expected locations.');
}
if (frontendPath) {
    // Serve static files from the determined frontend build path
    app.use(express_1.default.static(frontendPath));
    // For any other route, serve the index.html file
    app.get('*', (req, res) => {
        res.sendFile(path_1.default.join(frontendPath, 'index.html'));
    });
}
else {
    // Optional: handle case where build is not found
    app.get('*', (req, res) => {
        res.status(500).send('Error: Frontend build directory not found. Please build the frontend project.');
    });
}
// --- End of Dynamic Path ---
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port: ${port}`);
});
