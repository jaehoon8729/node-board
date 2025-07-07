# Node.js CRUD 게시판

Node.js, Express, MySQL, Sequelize를 사용한 CRUD 게시판 프로젝트입니다.

## 기능

- 회원가입/로그인 (IP 주소 저장)
- 게시글 CRUD (작성, 읽기, 수정, 삭제)
- 댓글 기능
- 권한 관리 (본인 글만 수정/삭제, 관리자는 모든 글 관리)
- 검색 기능 (제목, 내용, 작성자)
- 페이지네이션

## 설치 방법

1. 프로젝트 클론 또는 다운로드

2. 패키지 설치
```bash
npm install
```

3. MySQL 데이터베이스 생성
```sql
CREATE DATABASE IF NOT EXISTS node_board CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

4. 환경 변수 설정 (.env 파일)
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=node_board
DB_PORT=3306
SESSION_SECRET=your_session_secret
PORT=3000
NODE_ENV=development
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=admin@example.com
```

5. 서버 실행
```bash
npm start
# 또는 개발 모드
npm run dev
```

## 기본 관리자 계정

- 아이디: admin
- 비밀번호: admin123

## 프로젝트 구조

```
node-board/
├── config/
│   └── database.js      # 데이터베이스 설정
├── models/
│   ├── User.js         # 사용자 모델
│   ├── Post.js         # 게시글 모델
│   └── Comment.js      # 댓글 모델
├── routes/
│   ├── auth.js         # 인증 라우터
│   ├── board.js        # 게시판 라우터
│   └── comment.js      # 댓글 라우터
├── views/
│   ├── auth/           # 인증 관련 뷰
│   ├── board/          # 게시판 관련 뷰
│   ├── layout.ejs      # 레이아웃
│   └── error.ejs       # 에러 페이지
├── public/             # 정적 파일
├── .env                # 환경 변수
├── app.js              # 메인 서버 파일
└── package.json        # 패키지 정보
```

## API 엔드포인트

### 인증
- GET `/auth/login` - 로그인 페이지
- POST `/auth/login` - 로그인 처리
- GET `/auth/register` - 회원가입 페이지
- POST `/auth/register` - 회원가입 처리
- GET `/auth/logout` - 로그아웃

### 게시판
- GET `/board` - 게시글 목록
- GET `/board/write` - 게시글 작성 페이지
- POST `/board/write` - 게시글 작성
- GET `/board/:id` - 게시글 상세보기
- GET `/board/:id/edit` - 게시글 수정 페이지
- POST `/board/:id/edit` - 게시글 수정
- POST `/board/:id/delete` - 게시글 삭제

### 댓글 (API)
- POST `/api/comments` - 댓글 작성
- PUT `/api/comments/:id` - 댓글 수정
- DELETE `/api/comments/:id` - 댓글 삭제

## 보안 기능

- 비밀번호 암호화 (bcrypt)
- 세션 기반 인증
- CSRF 보호
- SQL Injection 방지 (Sequelize ORM)
- XSS 방지
