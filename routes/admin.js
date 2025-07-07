const express = require('express');
const router = express.Router();
const { Post, User, Comment } = require('../config/database');
const { Op } = require('sequelize');
const postScheduler = require('../services/scheduler');

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

// 관리자 대시보드
router.get('/', isAdmin, async (req, res) => {
    try {
        // 통계 데이터 수집
        const totalPosts = await Post.count();
        const totalUsers = await User.count();
        const totalComments = await Comment.count();
        const publishedPosts = await Post.count({ where: { status: 'published' } });
        const scheduledPosts = await Post.count({ where: { status: 'scheduled' } });

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
                scheduledPosts
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
            scheduled: await Post.count({ where: { status: 'scheduled' } })
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

// 즉시 발행
router.post('/posts/:id/action', isAdmin, async (req, res) => {
    try {
        const { action } = req.body;
        const post = await Post.findByPk(req.params.id);

        if (!post) {
            req.flash('error', '게시글을 찾을 수 없습니다.');
            return res.redirect('/admin/posts?status=scheduled');
        }

        if (action === 'publish_now') {
            await post.update({
                status: 'published',
                publish_at: null
            });
            req.flash('success', '게시글이 즉시 발행되었습니다.');
        } else if (action === 'delete') {
            // 첨부파일이 있다면 삭제
            const fs = require('fs');
            if (post.file_path && fs.existsSync(post.file_path)) {
                fs.unlinkSync(post.file_path);
            }
            
            // 댓글 먼저 삭제
            await Comment.destroy({ where: { post_id: post.id } });
            
            // 게시글 삭제
            await post.destroy();
            
            req.flash('success', '게시글이 삭제되었습니다.');
        }

        res.redirect('/admin/posts?status=scheduled');
    } catch (error) {
        console.error('게시글 액션 처리 오류:', error);
        req.flash('error', '처리 중 오류가 발생했습니다.');
        res.redirect('/admin/posts?status=scheduled');
    }
});

module.exports = router;
