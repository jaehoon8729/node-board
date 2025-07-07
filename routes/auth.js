const express = require('express');
const router = express.Router();
const validator = require('validator');
const xss = require('xss');
const { User } = require('../config/database');

// XSS 방지 함수
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return xss(input.trim());
};

// 입력 검증 함수
const validateInput = {
    username: (username) => {
        if (!username || username.length < 3 || username.length > 50) {
            return '아이디는 3자 이상 50자 이하여야 합니다.';
        }
        if (!/^[a-zA-Z0-9가-힣_-]+$/.test(username)) {
            return '아이디는 영문, 숫자, 한글, 언더스코어, 하이픈만 사용 가능합니다.';
        }
        return null;
    },
    
    password: (password) => {
        if (!password || password.length < 1 || password.length > 10) {
            return '비밀번호는 1자 이상 10자 이하여야 합니다.';
        }
        return null;
    }
};

// 아이디 중복 확인 API
router.post('/check-username', async (req, res) => {
    try {
        let { username } = req.body;
        
        // 입력값 sanitize
        username = sanitizeInput(username);
        
        // 입력 검증
        const usernameError = validateInput.username(username);
        if (usernameError) {
            return res.json({ available: false, message: usernameError });
        }
        
        const existingUser = await User.findOne({ where: { username } });
        
        if (existingUser) {
            return res.json({ available: false, message: '이미 사용중인 아이디입니다.' });
        } else {
            return res.json({ available: true, message: '사용 가능한 아이디입니다.' });
        }
        
    } catch (error) {
        console.error('아이디 중복 확인 오류:', error);
        res.json({ available: false, message: '중복 확인 중 오류가 발생했습니다.' });
    }
});

// 로그인 페이지
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/board');
    }
    res.render('auth/login');
});

// 로그인 처리
router.post('/login', async (req, res) => {
    try {
        let { username, password } = req.body;
        
        // 입력값 sanitize
        username = sanitizeInput(username);
        password = sanitizeInput(password);
        
        // 입력 검증
        const usernameError = validateInput.username(username);
        if (usernameError) {
            req.flash('error', '올바른 아이디를 입력해주세요.');
            return res.redirect('/auth/login');
        }
        
        const passwordError = validateInput.password(password);
        if (passwordError) {
            req.flash('error', '올바른 비밀번호를 입력해주세요.');
            return res.redirect('/auth/login');
        }
        
        // 사용자 찾기
        const user = await User.findOne({ where: { username } });
        
        if (!user) {
            req.flash('error', '아이디 또는 비밀번호가 일치하지 않습니다.');
            return res.redirect('/auth/login');
        }
        
        // 비밀번호 확인 (디버깅용)
        console.log('입력된 비밀번호:', password);
        console.log('저장된 비밀번호:', user.password);
        
        if (password !== user.password) {
            req.flash('error', '아이디 또는 비밀번호가 일치하지 않습니다.');
            return res.redirect('/auth/login');
        }
        
        // 세션에 사용자 정보 저장
        req.session.user = {
            id: user.id,
            username: user.username,
            is_admin: user.is_admin
        };
        
        // 세션 재생성 (Session Fixation 방지)
        req.session.regenerate((err) => {
            if (err) {
                console.error('세션 재생성 오류:', err);
                req.flash('error', '로그인 중 오류가 발생했습니다.');
                return res.redirect('/auth/login');
            }
            
            req.session.user = {
                id: user.id,
                username: user.username,
                is_admin: user.is_admin
            };
            
            req.flash('success', '로그인되었습니다.');
            res.redirect('/board');
        });
        
    } catch (error) {
        console.error('로그인 오류:', error);
        req.flash('error', '로그인 중 오류가 발생했습니다.');
        res.redirect('/auth/login');
    }
});

// 회원가입 페이지
router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/board');
    }
    res.render('auth/register');
});

// 회원가입 처리
router.post('/register', async (req, res) => {
    try {
        let { username, password, password_confirm } = req.body;
        const ip_address = req.ip || req.connection.remoteAddress;
        
        // 입력값 sanitize
        username = sanitizeInput(username);
        password = sanitizeInput(password);
        password_confirm = sanitizeInput(password_confirm);
        
        // 디버깅 로그 추가
        console.log('회원가입 요청 데이터:', { username, ip_address });
        
        // 입력 검증
        const usernameError = validateInput.username(username);
        if (usernameError) {
            req.flash('error', usernameError);
            return res.redirect('/auth/register');
        }
        
        const passwordError = validateInput.password(password);
        if (passwordError) {
            req.flash('error', passwordError);
            return res.redirect('/auth/register');
        }
        
        if (password !== password_confirm) {
            console.log('유효성 검사 실패: 비밀번호 불일치');
            req.flash('error', '비밀번호가 일치하지 않습니다.');
            return res.redirect('/auth/register');
        }
        
        // 중복 확인
        console.log('중복 확인 시작...');
        const existingUser = await User.findOne({
            where: { username }
        });
        
        if (existingUser) {
            console.log('중복 사용자 발견:', existingUser.username);
            req.flash('error', '이미 사용중인 아이디입니다.');
            return res.redirect('/auth/register');
        }
        
        console.log('사용자 생성 시도...');
        // 사용자 생성
        const newUser = await User.create({
            username,
            password,
            ip_address,
            is_admin: false
        });
        
        console.log('사용자 생성 성공:', newUser.id);
        req.flash('success', '회원가입이 완료되었습니다. 로그인해주세요.');
        res.redirect('/auth/login');
        
    } catch (error) {
        console.error('회원가입 오류:', error);
        req.flash('error', '회원가입 중 오류가 발생했습니다.');
        res.redirect('/auth/register');
    }
});

// 로그아웃
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('로그아웃 오류:', err);
        }
        res.redirect('/auth/login');
    });
});

module.exports = router;
