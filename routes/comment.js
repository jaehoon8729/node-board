const express = require('express');
const router = express.Router();
const { Comment, User } = require('../config/database');

// 로그인 체크 미들웨어
const isAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }
    next();
};

// 댓글 작성
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { post_id, content } = req.body;
        
        if (!content || !content.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: '댓글 내용을 입력해주세요.' 
            });
        }
        
        const comment = await Comment.create({
            content: content.trim(),
            post_id,
            user_id: req.session.user.id
        });
        
        // 작성한 댓글 정보를 다시 조회 (사용자 정보 포함)
        const newComment = await Comment.findByPk(comment.id, {
            include: [{
                model: User,
                as: 'user',
                attributes: ['username']
            }]
        });
        
        res.json({ 
            success: true, 
            comment: newComment,
            message: '댓글이 작성되었습니다.' 
        });
        
    } catch (error) {
        console.error('댓글 작성 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '댓글 작성에 실패했습니다.' 
        });
    }
});

// 댓글 수정
router.put('/:id', isAuthenticated, async (req, res) => {
    try {
        const commentId = req.params.id;
        const { content } = req.body;
        
        if (!content || !content.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: '댓글 내용을 입력해주세요.' 
            });
        }
        
        const comment = await Comment.findByPk(commentId);
        
        if (!comment) {
            return res.status(404).json({ 
                success: false, 
                message: '댓글을 찾을 수 없습니다.' 
            });
        }
        
        // 권한 체크 (본인 또는 관리자)
        if (comment.user_id !== req.session.user.id && !req.session.user.is_admin) {
            return res.status(403).json({ 
                success: false, 
                message: '수정 권한이 없습니다.' 
            });
        }
        
        await comment.update({ content: content.trim() });
        
        res.json({ 
            success: true, 
            comment,
            message: '댓글이 수정되었습니다.' 
        });
        
    } catch (error) {
        console.error('댓글 수정 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '댓글 수정에 실패했습니다.' 
        });
    }
});

// 댓글 삭제
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const commentId = req.params.id;
        const comment = await Comment.findByPk(commentId);
        
        if (!comment) {
            return res.status(404).json({ 
                success: false, 
                message: '댓글을 찾을 수 없습니다.' 
            });
        }
        
        // 권한 체크 (본인 또는 관리자)
        if (comment.user_id !== req.session.user.id && !req.session.user.is_admin) {
            return res.status(403).json({ 
                success: false, 
                message: '삭제 권한이 없습니다.' 
            });
        }
        
        await comment.destroy();
        
        res.json({ 
            success: true, 
            message: '댓글이 삭제되었습니다.' 
        });
        
    } catch (error) {
        console.error('댓글 삭제 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '댓글 삭제에 실패했습니다.' 
        });
    }
});

module.exports = router;
