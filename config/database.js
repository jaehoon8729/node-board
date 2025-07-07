const { Sequelize } = require('sequelize');

// 환경변수 로드 확인
if (!process.env.DB_NAME) {
    console.error('⚠️  .env 파일에서 데이터베이스 설정을 찾을 수 없습니다.');
    console.error('DB_NAME, DB_USER, DB_PASSWORD, DB_HOST 환경변수를 설정해주세요.');
    process.exit(1);
}

// 데이터베이스 연결 설정
const dbConfig = {
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    timezone: '+09:00',
    dialectOptions: {
        charset: 'utf8mb4',
        dateStrings: true,
        typeCast: true
    },
    define: {
        timestamps: true,
        underscored: true,
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci'
    },
    pool: {
        max: parseInt(process.env.DB_POOL_MAX) || 10,
        min: parseInt(process.env.DB_POOL_MIN) || 0,
        acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
        idle: parseInt(process.env.DB_POOL_IDLE) || 10000
    }
};

console.log('📊 데이터베이스 연결 설정:');
console.log(`   호스트: ${dbConfig.host}:${dbConfig.port}`);
console.log(`   데이터베이스: ${dbConfig.database}`);
console.log(`   사용자: ${dbConfig.username}`);
console.log(`   환경: ${process.env.NODE_ENV || 'development'}`);

// Sequelize 인스턴스 생성
const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    dbConfig
);

// 모델 정의
const User = require('../models/User')(sequelize);
const Post = require('../models/Post')(sequelize);
const Comment = require('../models/Comment')(sequelize);

// 관계 설정
// User - Post (1:N)
User.hasMany(Post, { foreignKey: 'user_id', as: 'posts' });
Post.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User - Comment (1:N)
User.hasMany(Comment, { foreignKey: 'user_id', as: 'comments' });
Comment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Post - Comment (1:N)
Post.hasMany(Comment, { foreignKey: 'post_id', as: 'comments' });
Comment.belongsTo(Post, { foreignKey: 'post_id', as: 'post' });

module.exports = {
    sequelize,
    User,
    Post,
    Comment
};
