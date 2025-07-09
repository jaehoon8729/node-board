const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Post = sequelize.define('Post', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        title: {
            type: DataTypes.STRING(200),
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [1, 200]
            }
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        custom_author: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: '관리자가 지정한 사용자 정의 작성자명'
        },
        file_original_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: '원본 파일명'
        },
        file_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: '저장된 파일명'
        },
        file_size: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: '파일 크기 (bytes)'
        },
        file_path: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: '파일 저장 경로'
        },
        status: {
            type: DataTypes.ENUM('draft', 'published', 'scheduled'),
            defaultValue: 'published',
            comment: '게시글 상태: draft(임시저장), published(발행), scheduled(예약)'
        },
        publish_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: '발행 예정 일시 (예약 발행용)'
        },
        views: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'posts',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    return Post;
};
