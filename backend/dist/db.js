"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
};
// For Google Cloud SQL, the host is the path to the Unix socket
if (process.env.INSTANCE_CONNECTION_NAME) {
    dbConfig.host = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
}
else {
    // For local development, use TCP connection
    dbConfig.host = process.env.DB_HOST;
    dbConfig.port = Number(process.env.DB_PORT);
}
const pool = new pg_1.Pool(dbConfig);
exports.default = pool;
