import fs from "fs";
import path from "path";
import { Request, Response, NextFunction } from "express";

// Níveis de log
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  FATAL = "FATAL"
}

// Configuração
const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");
const ERROR_LOG_FILE = path.join(LOG_DIR, "error.log");
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOG_FILES = 5;

// Garante que o diretório de logs existe
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Rotaciona logs se necessário
function rotateLogIfNeeded(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  
  const stats = fs.statSync(filePath);
  if (stats.size > MAX_LOG_SIZE) {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    
    // Remove arquivos antigos
    const files = fs.readdirSync(dir).filter(f => f.startsWith(base));
    if (files.length > MAX_LOG_FILES) {
      const sorted = files.sort();
      const toDelete = sorted.slice(0, sorted.length - MAX_LOG_FILES);
      for (const file of toDelete) {
        fs.unlinkSync(path.join(dir, file));
      }
    }
    
    // Rotaciona
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const newName = `${base}-${timestamp}${ext}`;
    fs.renameSync(filePath, path.join(dir, newName));
  }
}

// Escreve no arquivo
function writeLog(level: LogLevel, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data })
  };
  
  const logLine = JSON.stringify(logEntry) + "\n";
  
  try {
    // Log geral
    rotateLogIfNeeded(LOG_FILE);
    fs.appendFileSync(LOG_FILE, logLine);
    
    // Log de erros separado
    if (level === LogLevel.ERROR || level === LogLevel.FATAL) {
      rotateLogIfNeeded(ERROR_LOG_FILE);
      fs.appendFileSync(ERROR_LOG_FILE, logLine);
    }
  } catch (err) {
    console.error("Erro ao escrever log:", err);
  }
  
  // Console em desenvolvimento
  if (process.env.NODE_ENV !== "production") {
    const color = level === LogLevel.ERROR ? "\x1b[31m" :
                  level === LogLevel.WARN ? "\x1b[33m" :
                  level === LogLevel.INFO ? "\x1b[36m" :
                  level === LogLevel.DEBUG ? "\x1b[90m" : "\x1b[0m";
    console.log(`${color}[${level}] ${timestamp} - ${message}${data ? " " + JSON.stringify(data) : ""}\x1b[0m`);
  }
}

// Logger principal
export const logger = {
  debug: (message: string, data?: any) => writeLog(LogLevel.DEBUG, message, data),
  info: (message: string, data?: any) => writeLog(LogLevel.INFO, message, data),
  warn: (message: string, data?: any) => writeLog(LogLevel.WARN, message, data),
  error: (message: string, data?: any) => writeLog(LogLevel.ERROR, message, data),
  fatal: (message: string, data?: any) => writeLog(LogLevel.FATAL, message, data),
};

// Middleware para log de requisições
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? LogLevel.ERROR :
                  res.statusCode >= 400 ? LogLevel.WARN :
                  LogLevel.INFO;
    
    const levelKey = level.toLowerCase() as keyof typeof logger;
    logger[levelKey](`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      user: (req as any).user?.uid || "anonymous"
    });
  });
  
  next();
}