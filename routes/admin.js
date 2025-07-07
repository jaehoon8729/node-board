const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const xss = require('xss');
const { Post, User, Comment } = require('../config/database');
const { Op } = require('sequelize');
const postScheduler = require('../services/scheduler');

// XSS 방지 함수
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return xss(input.trim());
};

// 관리자 권한 체크 미들웨어
const isAdmin = (req, res, next) => {
    if (!req.session.user) {
        req.flash('error', '로그인이 필요합니다.');
        return res.redirect('/auth/login');
    }
    
    if (!req.session.user.is_admin) {
        req.flash('error', '관리자 권한이 필요합니다.');
        return res.redirect('/board');
    }
    
    next();
};

// 파일 업로드 설정 (board.js와 동일)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = process.env.UPLOAD_DIR || 'uploads/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        try {
            const ext = path.extname(file.originalname);
            const uniqueFilename = `${uuidv4()}${ext}`;
            cb(null, uniqueFilename);
        } catch (error) {
            console.error('파일명 처리 오류:', error);
            const ext = path.extname(file.originalname) || '.file';
            cb(null, `${Date.now()}${ext}`);
        }
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024
    },
    fileFilter: function (req, file, cb) {
        try {
            let originalName = file.originalname;
            try {
                originalName = decodeURIComponent(escape(file.originalname));
            } catch (e) {
                try {
                    originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
                } catch (e2) {
                    // 원본 사용
                }
            }
            file.originalname = originalName;
            cb(null, true);
        } catch (error) {
            console.error('fileFilter 오류:', error);
            cb(null, true);
        }
    }
});

// 관리자 대시보드
router.get('/', isAdmin, async (req, res) => {
    try {
        // 통계 데이터 수집
        const totalPosts = await Post.count();
        const totalUsers = await User.count();
        const totalComments = await Comment.count();
        const publishedPosts = await Post.count({ where: { status: 'published' } });
        const scheduledPosts = await Post.count({ where: { status: 'scheduled' } });
        const draftPosts = await Post.count({ where: { status: 'draft' } });

        // 예약된 게시글 목록
        const upcomingPosts = await postScheduler.getScheduledPosts();

        // 최근 게시글 (모든 상태 포함 - 관리자용)
        const recentPosts = await Post.findAll({
            limit: 5,
            order: [['created_at', 'DESC']],
            include: [{
                model: User,
                as: 'user',
                attributes: ['username']
            }]
        });

        res.render('admin/dashboard', {
            stats: {
                totalPosts,
                totalUsers,
                totalComments,
                publishedPosts,
                scheduledPosts,
                draftPosts
            },
            upcomingPosts,
            recentPosts
        });
    } catch (error) {
        console.error('관리자 대시보드 오류:', error);
        req.flash('error', '대시보드를 불러오는데 실패했습니다.');
        res.redirect('/board');
    }
});

// 예약 게시글 작성 페이지
router.get('/posts/schedule', isAdmin, (req, res) => {
    res.render('admin/schedule-post');
});

// 예약 게시글 작성 처리
router.post('/posts/schedule', isAdmin, upload.single('file'), async (req, res) => {
    try {
        let { title, content, publish_date, publish_time, action } = req.body;
        
        // XSS 방지
        title = sanitizeInput(title);
        content = sanitizeInput(content);
        
        if (!title || !content) {
            req.flash('error', '제목과 내용을 모두 입력해주세요.');
            return res.redirect('/admin/posts/schedule');
        }

        if (title.length > 200) {
            req.flash('error', '제목은 200자를 초과할 수 없습니다.');
            return res.redirect('/admin/posts/schedule');
        }

        // 게시글 데이터 준비
        const postData = {
            title,
            content,
            user_id: req.session.user.id
        };

        // 파일이 업로드된 경우
        if (req.file) {
            postData.file_original_name = req.file.originalname;
            postData.file_name = req.file.filename;
            postData.file_size = req.file.size;
            postData.file_path = req.file.path;
        }

        // 액션에 따른 상태 설정
        if (action === 'publish_now') {
            postData.status = 'published';
        } else if (action === 'save_draft') {
            postData.status = 'draft';
        } else if (action === 'schedule' && publish_date && publish_time) {
            // 예약 발행
            const publishDateTime = new Date(`${publish_date}T${publish_time}`);
            const now = new Date();
            
            if (publishDateTime <= now) {
                req.flash('error', '발행 예정 시간은 현재 시간보다 이후여야 합니다.');
                return res.redirect('/admin/posts/schedule');
            }
            
            postData.status = 'scheduled';
            postData.publish_at = publishDateTime;
        } else {
            req.flash('error', '올바른 발행 옵션을 선택해주세요.');
            return res.redirect('/admin/posts/schedule');
        }

        const post = await Post.create(postData);

        if (action === 'schedule') {
            req.flash('success', `게시글이 ${postData.publish_at.toLocaleString()}에 발행되도록 예약되었습니다.`);
        } else if (action === 'save_draft') {
            req.flash('success', '게시글이 임시저장되었습니다.');
        } else {
            req.flash('success', '게시글이 발행되었습니다.');
        }

        res.redirect('/admin');

    } catch (error) {
        console.error('예약 게시글 작성 오류:', error);
        
        // 업로드된 파일이 있다면 삭제
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        req.flash('error', '게시글 작성에 실패했습니다.');
        res.redirect('/admin/posts/schedule');
    }
});

// 게시글 관리 페이지 (모든 게시글)
router.get('/posts', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 15;
        const offset = (page - 1) * limit;
        const status = req.query.status || 'all';

        // 상태별 필터링
        let whereClause = {};
        if (status !== 'all') {
            whereClause.status = status;
        }

        const { count, rows: posts } = await Post.findAndCountAll({
            where: whereClause,
            include: [{
                model: User,
                as: 'user',
                attributes: ['username']
            }],
            order: [
                ['status', 'ASC'], // 예약 게시글을 먼저 표시
                ['publish_at', 'ASC'], // 예약 시간 순
                ['created_at', 'DESC'] // 작성 시간 순
            ],
            limit,
            offset
        });

        const totalPages = Math.ceil(count / limit);

        // 상태별 개수 조회
        const statusCounts = {
            all: await Post.count(),
            published: await Post.count({ where: { status: 'published' } }),
            scheduled: await Post.count({ where: { status: 'scheduled' } }),
            draft: await Post.count({ where: { status: 'draft' } })
        };

        res.render('admin/posts', {
            posts,
            currentPage: page,
            totalPages,
            currentStatus: status,
            statusCounts
        });
    } catch (error) {
        console.error('게시글 관리 페이지 오류:', error);
        req.flash('error', '게시글 목록을 불러오는데 실패했습니다.');
        res.redirect('/admin');
    }
});

// 예약 취소/즉시 발행
router.post('/posts/:id/action', isAdmin, async (req, res) => {
    try {
        const { action } = req.body;
        const post = await Post.findByPk(req.params.id);

        if (!post) {
            req.flash('error', '게시글을 찾을 수 없습니다.');
            return res.redirect('/admin/posts/scheduled');
        }

        if (action === 'cancel_schedule') {
            await post.update({
                status: 'draft',
                publish_at: null
            });
            req.flash('success', '예약이 취소되었습니다.');
        } else if (action === 'publish_now') {
            await post.update({
                status: 'published',
                publish_at: null
            });
            req.flash('success', '게시글이 즉시 발행되었습니다.');
        }

        res.redirect('/admin/posts/scheduled');
    } catch (error) {
        console.error('게시글 액션 처리 오류:', error);
        req.flash('error', '처리 중 오류가 발생했습니다.');
        res.redirect('/admin/posts/scheduled');
    }
});

module.exports = router;
