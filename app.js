require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('express-flash');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// 보안 미들웨어
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://cdn.jsdelivr.net", "https://code.jquery.com"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
        },
    },
}));

// Rate Limiting (DOS 공격 방지)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 100, // 15분당 최대 100개 요청
    message: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 5, // 15분당 최대 5번 로그인 시도
    message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.',
    skipSuccessfulRequests: true,
});

app.use(limiter);
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);

// 데이터베이스 연결
const db = require('./config/database');

// 미들웨어 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(`/${process.env.UPLOAD_DIR || 'uploads'}`, express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads'))); // 파일 업로드 정적 서빙
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 세션 설정
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'sessionId', // 기본 세션 이름 변경
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 24시간
        sameSite: 'strict' // CSRF 방지
    }
}));

app.use(flash());

// 전역 변수 설정 (모든 뷰에서 사용 가능)
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    next();
});

// 라우터 설정
const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/board');
const commentRoutes = require('./routes/comment');
const adminRoutes = require('./routes/admin');

app.use('/auth', authRoutes);
app.use('/board', boardRoutes);
app.use('/api/comments', commentRoutes);
app.use('/admin', adminRoutes);

// 홈페이지 라우트
app.get('/', (req, res) => {
    res.redirect('/board');
});

// 404 에러 처리
app.use((req, res) => {
    res.status(404).render('error', { 
        message: '페이지를 찾을 수 없습니다.',
        status: 404 
    });
});

// 에러 처리 미들웨어
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        message: '서버 오류가 발생했습니다.',
        status: 500 
    });
});

// 서버 시작
db.sequelize.sync({ force: false }).then(() => {
    console.log('데이터베이스 연결 성공');
    
    // 스케줄러 시작
    const postScheduler = require('./services/scheduler');
    postScheduler.start();
    
    // 관리자 계정 생성 (최초 실행시)
    const User = db.User;
    User.findOne({ where: { username: process.env.ADMIN_USERNAME || 'admin' } })
        .then(admin => {
            if (!admin) {
                const adminUsername = process.env.ADMIN_USERNAME || 'admin';
                User.create({
                    username: adminUsername,
                    password: process.env.ADMIN_PASSWORD || 'admin123',
                    ip_address: '127.0.0.1',
                    is_admin: true
                }).then(() => {
                    console.log('관리자 계정이 생성되었습니다.');
                });
            }
        });
    
    app.listen(PORT, () => {
        console.log(`서버가 http://localhost:${PORT} 에서 실행중입니다.`);
    });
}).catch(err => {
    console.error('데이터베이스 연결 실패:', err);
});
