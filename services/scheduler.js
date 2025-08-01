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
        // this.job = cron.schedule('*/5 * * * *', async () => {
        this.job = cron.schedule('*/10 * * * *', async () => {
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
            console.log(`🕐 현재 시간: ${now.toLocaleString()}`);
            
            // 현재 시간이 지난 예약 게시글들 찾기
            const scheduledPosts = await Post.findAll({
                where: {
                    status: 'scheduled',
                    publish_at: {
                        [Op.lte]: now
                    }
                }
            });

            console.log(`📊 예약 게시글 조회 결과: ${scheduledPosts.length}개`);

            if (scheduledPosts.length > 0) {
                console.log(`📤 ${scheduledPosts.length}개의 예약 게시글을 발행합니다.`);

                // 예약 게시글들을 published 상태로 변경하고 created_at을 예약 시간으로 설정
                for (const post of scheduledPosts) {
                    console.log(`📝 처리 중인 게시글: "${post.title}" (ID: ${post.id})`);
                    console.log(`📅 예약 시간: ${post.publish_at}`);
                    console.log(`🕐 현재 시간: ${now}`);
                    
                    await post.update({
                        status: 'published',
                        created_at: post.publish_at, // 등록 시간을 예약된 발행 시간으로 설정
                        publish_at: null
                    });
                    
                    console.log(`✅ 게시글 "${post.title}" 발행 완료 (ID: ${post.id})`);
                }
            } else {
                console.log('📭 발행할 예약 게시글이 없습니다.');
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
