const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const xss = require('xss');
const { Post, User, Comment } = require('../config/database');
const { Op } = require('sequelize');

// XSS 방지 함수
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return xss(input.trim());
};

// 파일 업로드 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = process.env.UPLOAD_DIR || 'uploads/';
        // uploads 폴더가 없으면 생성
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        try {
            // UUID를 사용한 고유 파일명 생성 (한글 파일명 문제 완전 해결)
            const ext = path.extname(file.originalname);
            const uniqueFilename = `${uuidv4()}${ext}`;
            
            console.log('원본 파일명:', file.originalname);
            console.log('저장될 파일명:', uniqueFilename);
            
            cb(null, uniqueFilename);
        } catch (error) {
            console.error('파일명 처리 오류:', error);
            // 오류 시 타임스탬프 사용
            const ext = path.extname(file.originalname) || '.file';
            cb(null, `${Date.now()}${ext}`);
        }
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024 // 환경변수에서 파일 크기 제한
    },
    fileFilter: function (req, file, cb) {
        try {
            // 한글 파일명 디코딩 - 여러 방법 시도
            let originalName = file.originalname;
            
            // 방법 1: decodeURIComponent + escape
            try {
                originalName = decodeURIComponent(escape(file.originalname));
                console.log('방법1 디코딩 성공:', originalName);
            } catch (e) {
                // 방법 2: Buffer 변환
                try {
                    originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
                    console.log('방법2 Buffer 변환 성공:', originalName);
                } catch (e2) {
                    console.log('디코딩 실패, 원본 사용:', file.originalname);
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

// 로그인 체크 미들웨어
const isAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        req.flash('error', '로그인이 필요합니다.');
        return res.redirect('/auth/login');
    }
    next();
};

// 권한 체크 함수
const checkPermission = (user, post) => {
    return user.is_admin || user.id === post.user_id;
};

// 게시글 목록
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const searchType = req.query.searchType || 'title';
        
        // 검색 조건 설정 (발행된 게시글만 표시)
        let whereClause = {
            status: 'published' // 발행된 게시글만 표시
        };
        
        if (search) {
            if (searchType === 'title') {
                whereClause.title = { [Op.like]: `%${search}%` };
            } else if (searchType === 'content') {
                whereClause.content = { [Op.like]: `%${search}%` };
            } else if (searchType === 'author') {
                whereClause['$user.username$'] = { [Op.like]: `%${search}%` };
            }
        }
        
        // 게시글 조회
        const { count, rows: posts } = await Post.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['username']
                },
                {
                    model: Comment,
                    as: 'comments',
                    attributes: ['id'], // 댓글 개수만 세기 위해 id만 선택
                    required: false
                }
            ],
            order: [['created_at', 'DESC']],
            limit,
            offset
        });
        
        const totalPages = Math.ceil(count / limit);
        const hasMore = page < totalPages;
        
        res.render('board/list', {
            posts,
            currentPage: page,
            totalPages,
            hasMore,
            search,
            searchType
        });
        
    } catch (error) {
        console.error('게시글 목록 조회 오류:', error);
        req.flash('error', '게시글 목록을 불러오는데 실패했습니다.');
        res.redirect('/');
    }
});

// 게시글 목록 API (더보기용)
router.get('/api/posts', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const searchType = req.query.searchType || 'title';
        
        // 검색 조건 설정 (발행된 게시글만 표시)
        let whereClause = {
            status: 'published'
        };
        
        if (search) {
            if (searchType === 'title') {
                whereClause.title = { [Op.like]: `%${search}%` };
            } else if (searchType === 'content') {
                whereClause.content = { [Op.like]: `%${search}%` };
            } else if (searchType === 'author') {
                whereClause['$user.username$'] = { [Op.like]: `%${search}%` };
            }
        }
        
        // 게시글 조회
        const { count, rows: posts } = await Post.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['username']
                },
                {
                    model: Comment,
                    as: 'comments',
                    attributes: ['id'], // 댓글 개수만 세기 위해 id만 선택
                    required: false
                }
            ],
            order: [['created_at', 'DESC']],
            limit,
            offset
        });
        
        const totalPages = Math.ceil(count / limit);
        const hasMore = page < totalPages;
        
        res.json({
            success: true,
            posts: posts.map(post => ({
                id: post.id,
                title: post.title,
                username: post.custom_author || post.user.username,
                created_at: post.created_at,
                views: post.views,
                file_original_name: post.file_original_name,
                comment_count: post.comments.length
            })),
            hasMore,
            currentPage: page,
            totalPages
        });
        
    } catch (error) {
        console.error('게시글 목록 API 오류:', error);
        res.status(500).json({
            success: false,
            message: '게시글 목록을 불러오는데 실패했습니다.'
        });
    }
});

// 게시글 작성 페이지
router.get('/write', isAuthenticated, (req, res) => {
    res.render('board/write');
});

// 게시글 작성 처리
router.post('/write', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
        let { title, content, publishType, scheduleDate, scheduleTime, customAuthor } = req.body;
        
        // XSS 방지를 위한 입력값 sanitize
        title = sanitizeInput(title);
        content = sanitizeInput(content);
        
        if (!title || !content) {
            req.flash('error', '제목과 내용을 모두 입력해주세요.');
            return res.redirect('/board/write');
        }
        
        if (title.length > 200) {
            req.flash('error', '제목은 200자를 초과할 수 없습니다.');
            return res.redirect('/board/write');
        }
        
        // 게시글 데이터 준비
        const postData = {
            title,
            content,
            user_id: req.session.user.id,
            status: 'published' // 기본값은 즉시 발행
        };
        
        // 관리자인 경우 사용자 정의 작성자명 처리
        if (req.session.user.is_admin && customAuthor && customAuthor.trim()) {
            postData.custom_author = customAuthor.trim();
        }
        
        // 예약 발행은 관리자만 가능
        if (publishType === 'schedule' && req.session.user.is_admin) {
            if (!scheduleDate || !scheduleTime) {
                req.flash('error', '예약 발행을 위해서는 날짜와 시간을 모두 선택해야 합니다.');
                return res.redirect('/board/write');
            }
            
            const publishAt = new Date(`${scheduleDate}T${scheduleTime}:00`);
            const now = new Date();
            
            if (publishAt <= now) {
                req.flash('error', '예약 시간은 현재 시간보다 미래여야 합니다.');
                return res.redirect('/board/write');
            }
            
            postData.status = 'scheduled';
            postData.publish_at = publishAt;
        }
        
        // 파일이 업로드된 경우
        if (req.file) {
            postData.file_original_name = req.file.originalname;
            postData.file_name = req.file.filename;
            postData.file_size = req.file.size;
            postData.file_path = req.file.path;
        }
        
        const post = await Post.create(postData);
        
        // 성공 메시지 설정
        let successMessage = '게시글이 작성되었습니다.';
        if (postData.status === 'scheduled') {
            const scheduleDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
            successMessage = `게시글이 ${scheduleDateTime.toLocaleString()}에 발행 예약되었습니다.`;
        }
        
        req.flash('success', successMessage);
        
        // 예약인 경우 관리자 페이지로, 발행인 경우 게시글로 이동
        if (postData.status === 'scheduled') {
            res.redirect('/admin/posts?status=scheduled');
        } else {
            res.redirect(`/board/${post.id}`);
        }
        
    } catch (error) {
        console.error('게시글 작성 오류:', error);
        
        // 업로드된 파일이 있다면 삭제
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        if (error.code === 'LIMIT_FILE_SIZE') {
            req.flash('error', '파일 크기는 50MB를 초과할 수 없습니다.');
        } else {
            req.flash('error', '게시글 작성에 실패했습니다.');
        }
        res.redirect('/board/write');
    }
});

// 게시글 상세보기
router.get('/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        
        // 게시글 조회
        const post = await Post.findByPk(postId, {
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['username']
                },
                {
                    model: Comment,
                    as: 'comments',
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['username']
                    }],
                    order: [['created_at', 'ASC']]
                }
            ]
        });
        
        if (!post) {
            req.flash('error', '게시글을 찾을 수 없습니다.');
            return res.redirect('/board');
        }
        
        // 발행되지 않은 게시글은 관리자만 볼 수 있음
        if (post.status !== 'published') {
            if (!req.session.user || !req.session.user.is_admin) {
                req.flash('error', '해당 게시글에 접근할 권한이 없습니다.');
                return res.redirect('/board');
            }
        }
        
        // 발행된 게시글만 조회수 증가
        if (post.status === 'published') {
            await Post.increment('views', { where: { id: postId } });
        }
        
        // 권한 체크
        const canEdit = req.session.user && checkPermission(req.session.user, post);
        
        res.render('board/view', {
            post,
            canEdit
        });
        
    } catch (error) {
        console.error('게시글 조회 오류:', error);
        req.flash('error', '게시글 조회에 실패했습니다.');
        res.redirect('/board');
    }
});

// 게시글 수정 페이지
router.get('/:id/edit', isAuthenticated, async (req, res) => {
    try {
        const post = await Post.findByPk(req.params.id);
        
        if (!post) {
            req.flash('error', '게시글을 찾을 수 없습니다.');
            return res.redirect('/board');
        }
        
        // 예약 게시글은 관리자만 수정 가능
        if (post.status === 'scheduled' && !req.session.user.is_admin) {
            req.flash('error', '예약 게시글은 관리자만 수정할 수 있습니다.');
            return res.redirect('/board');
        }
        
        // 권한 체크
        if (!checkPermission(req.session.user, post)) {
            req.flash('error', '수정 권한이 없습니다.');
            return res.redirect(`/board/${post.id}`);
        }
        
        res.render('board/edit', { post });
        
    } catch (error) {
        console.error('게시글 수정 페이지 오류:', error);
        req.flash('error', '오류가 발생했습니다.');
        res.redirect('/board');
    }
});

// 게시글 수정 처리
router.post('/:id/edit', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
        let { title, content, removeFile, customAuthor } = req.body;
        const post = await Post.findByPk(req.params.id);
        
        if (!post) {
            req.flash('error', '게시글을 찾을 수 없습니다.');
            return res.redirect('/board');
        }
        
        // 예약 게시글은 관리자만 수정 가능
        if (post.status === 'scheduled' && !req.session.user.is_admin) {
            req.flash('error', '예약 게시글은 관리자만 수정할 수 있습니다.');
            return res.redirect('/board');
        }
        
        // 권한 체크
        if (!checkPermission(req.session.user, post)) {
            req.flash('error', '수정 권한이 없습니다.');
            return res.redirect(`/board/${post.id}`);
        }
        
        // XSS 방지
        title = sanitizeInput(title);
        content = sanitizeInput(content);
        
        if (title.length > 200) {
            req.flash('error', '제목은 200자를 초과할 수 없습니다.');
            return res.redirect(`/board/${req.params.id}/edit`);
        }
        
        // 업데이트할 데이터 준비
        const updateData = { title, content };
        
        // 관리자인 경우 사용자 정의 작성자명 처리
        if (req.session.user.is_admin) {
            if (customAuthor && customAuthor.trim()) {
                updateData.custom_author = customAuthor.trim();
            } else {
                updateData.custom_author = null; // 빈 값인 경우 null로 설정
            }
        }
        
        // 기존 파일 삭제 요청이 있는 경우
        if (removeFile === 'true' && post.file_path) {
            if (fs.existsSync(post.file_path)) {
                fs.unlinkSync(post.file_path);
            }
            updateData.file_original_name = null;
            updateData.file_name = null;
            updateData.file_size = null;
            updateData.file_path = null;
        }
        
        // 새 파일이 업로드된 경우
        if (req.file) {
            // 기존 파일이 있다면 삭제
            if (post.file_path && fs.existsSync(post.file_path)) {
                fs.unlinkSync(post.file_path);
            }
            
            updateData.file_original_name = req.file.originalname;
            updateData.file_name = req.file.filename;
            updateData.file_size = req.file.size;
            updateData.file_path = req.file.path;
        }
        
        await post.update(updateData);
        
        req.flash('success', '게시글이 수정되었습니다.');
        
        // 예약 게시글인 경우 관리자 페이지로, 아니면 게시글로 이동
        if (post.status === 'scheduled') {
            res.redirect('/admin/posts?status=scheduled');
        } else {
            res.redirect(`/board/${post.id}`);
        }
        
    } catch (error) {
        console.error('게시글 수정 오류:', error);
        
        // 업로드된 파일이 있다면 삭제
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        if (error.code === 'LIMIT_FILE_SIZE') {
            req.flash('error', '파일 크기는 50MB를 초과할 수 없습니다.');
        } else {
            req.flash('error', '게시글 수정에 실패했습니다.');
        }
        res.redirect(`/board/${req.params.id}/edit`);
    }
});

// 게시글 삭제
router.post('/:id/delete', isAuthenticated, async (req, res) => {
    try {
        const post = await Post.findByPk(req.params.id);
        
        if (!post) {
            req.flash('error', '게시글을 찾을 수 없습니다.');
            return res.redirect('/board');
        }
        
        // 예약 게시글은 관리자만 삭제 가능
        if (post.status === 'scheduled' && !req.session.user.is_admin) {
            req.flash('error', '예약 게시글은 관리자만 삭제할 수 있습니다.');
            return res.redirect('/board');
        }
        
        // 권한 체크
        if (!checkPermission(req.session.user, post)) {
            req.flash('error', '삭제 권한이 없습니다.');
            return res.redirect(`/board/${post.id}`);
        }
        
        // 첨부파일이 있다면 삭제
        if (post.file_path && fs.existsSync(post.file_path)) {
            fs.unlinkSync(post.file_path);
        }
        
        // 댓글 먼저 삭제
        await Comment.destroy({ where: { post_id: post.id } });
        
        // 게시글 삭제
        await post.destroy();
        
        req.flash('success', '게시글이 삭제되었습니다.');
        
        // 예약 게시글이었다면 관리자 페이지로, 아니면 게시판으로 이동
        if (post.status === 'scheduled') {
            res.redirect('/admin/posts?status=scheduled');
        } else {
            res.redirect('/board');
        }
        
    } catch (error) {
        console.error('게시글 삭제 오류:', error);
        req.flash('error', '게시글 삭제에 실패했습니다.');
        res.redirect(`/board/${req.params.id}`);
    }
});

// 파일 다운로드
router.get('/download/:id', async (req, res) => {
    try {
        const post = await Post.findByPk(req.params.id);
        
        if (!post || !post.file_path) {
            req.flash('error', '파일을 찾을 수 없습니다.');
            return res.redirect('/board');
        }
        
        // 예약 게시글의 파일은 관리자만 다운로드 가능
        if (post.status === 'scheduled') {
            if (!req.session.user || !req.session.user.is_admin) {
                req.flash('error', '예약 게시글의 파일은 관리자만 다운로드할 수 있습니다.');
                return res.redirect('/board');
            }
        }
        
        const filePath = path.resolve(post.file_path);
        
        if (!fs.existsSync(filePath)) {
            req.flash('error', '파일이 존재하지 않습니다.');
            return res.redirect(`/board/${post.id}`);
        }
        
        // 파일 다운로드
        res.download(filePath, post.file_original_name, (err) => {
            if (err) {
                console.error('파일 다운로드 오류:', err);
                req.flash('error', '파일 다운로드에 실패했습니다.');
                res.redirect(`/board/${post.id}`);
            }
        });
        
    } catch (error) {
        console.error('파일 다운로드 오류:', error);
        req.flash('error', '파일 다운로드에 실패했습니다.');
        res.redirect('/board');
    }
});

module.exports = router;
