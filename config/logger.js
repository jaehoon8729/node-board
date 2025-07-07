const winston = require('winston');
const path = require('path');

// 로그 레벨 정의
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// 로그 포맷 정의
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console 출력 포맷 (개발환경용)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(info => {
    return `${info.timestamp} [${info.level}]: ${info.message}`;
  })
);

// Transport 설정
const transports = [];

// 개발환경에서는 콘솔 출력
if (process.env.NODE_ENV === 'development') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug'
    })
  );
} else {
  // 운영환경에서는 JSON 형태로 stdout 출력 (도커가 캡처)
  transports.push(
    new winston.transports.Console({
      format: logFormat,
      level: 'info'
    })
  );
}

// 파일 로그 (선택사항 - 도커 볼륨 마운트 시)
if (process.env.LOG_TO_FILE === 'true') {
  // 에러 로그
  transports.push(
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || 'logs', 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );

  // 모든 로그
  transports.push(
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || 'logs', 'combined.log'),
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

// Winston logger 생성
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  // 예외 처리
  exceptionHandlers: [
    new winston.transports.Console({
      format: consoleFormat
    })
  ],
  // Promise rejection 처리
  rejectionHandlers: [
    new winston.transports.Console({
      format: consoleFormat
    })
  ]
});

module.exports = logger;
