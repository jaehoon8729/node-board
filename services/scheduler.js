const cron = require('node-cron');
const { Post } = require('../config/database');
const { Op } = require('sequelize');

class PostScheduler {
    constructor() {
        this.job = null;
        this.init();
    }

    init() {
        // 매분마다 예약된 게시글 확인 (실제 운영에서는 5분 또는 10분 간격 권장)
        this.job = cron.schedule('* * * * *', async () => {
            await this.publishScheduledPosts();
        }, {
            scheduled: false // 처음에는 비활성화
        });

        console.log('📅 게시글 스케줄러 초기화 완료');
    }

    // 스케줄러 시작
    start() {
        if (this.job) {
            this.job.start();
            console.log('✅ 게시글 스케줄러 시작됨');
        }
    }

    // 스케줄러 중지
    stop() {
        if (this.job) {
            this.job.stop();
            console.log('⏹️ 게시글 스케줄러 중지됨');
        }
    }

    // 예약된 게시글 발행 처리
    async publishScheduledPosts() {
        try {
            const now = new Date();
            
            // 현재 시간이 지난 예약 게시글들 찾기
            const scheduledPosts = await Post.findAll({
                where: {
                    status: 'scheduled',
                    publish_at: {
                        [Op.lte]: now
                    }
                }
            });

            if (scheduledPosts.length > 0) {
                console.log(`📤 ${scheduledPosts.length}개의 예약 게시글을 발행합니다.`);

                // 예약 게시글들을 published 상태로 변경
                for (const post of scheduledPosts) {
                    await post.update({
                        status: 'published',
                        publish_at: null
                    });
                    
                    console.log(`✅ 게시글 "${post.title}" 발행 완료 (ID: ${post.id})`);
                }
            }
        } catch (error) {
            console.error('❌ 예약 게시글 발행 중 오류:', error);
        }
    }

    // 특정 게시글의 예약 취소
    async cancelSchedule(postId) {
        try {
            const post = await Post.findByPk(postId);
            if (post && post.status === 'scheduled') {
                await post.update({
                    status: 'draft',
                    publish_at: null
                });
                console.log(`🚫 게시글 "${post.title}" 예약 취소됨`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ 예약 취소 중 오류:', error);
            return false;
        }
    }

    // 예약된 게시글 목록 조회
    async getScheduledPosts() {
        try {
            return await Post.findAll({
                where: {
                    status: 'scheduled'
                },
                order: [['publish_at', 'ASC']],
                include: [{
                    model: require('../config/database').User,
                    as: 'user',
                    attributes: ['username']
                }]
            });
        } catch (error) {
            console.error('❌ 예약 게시글 조회 중 오류:', error);
            return [];
        }
    }
}

// 싱글톤 패턴으로 스케줄러 인스턴스 생성
const postScheduler = new PostScheduler();

module.exports = postScheduler;
