# RRList

*[English](README.md) | 한국어*

인증 기능과 실시간 모니터링이 포함된 클라우드 스토리지 파일 브라우저

## 프로젝트 개요

**RRList**는 rclone 기반으로 구축된 웹 파일 브라우저로, 사용자 인증과 실시간 스토리지 모니터링을 통한 안전한 클라우드 스토리지 관리를 제공합니다.

### 주요 기능
- **멀티 클라우드 지원**: rclone을 통한 70개 이상 클라우드 스토리지 제공업체 파일 탐색
- **사용자 인증**: NextAuth.js를 활용한 안전한 로그인 시스템
- **실시간 모니터링**: Server-Sent Events를 통한 실시간 스토리지 사용량 업데이트
- **권한 관리**: 사용자 역할 및 접근 제어 시스템
- **Docker 지원**: 자동 설정이 포함된 컨테이너화된 배포

### 기술 스택
- **Next.js 15** with App Router - 풀스택 React 프레임워크
- **TypeScript** - 타입 안전성을 위한 정적 타입 검사
- **Tailwind CSS** - 유틸리티 우선 CSS 프레임워크
- **Prisma** with SQLite - 타입 안전 ORM 및 데이터베이스
- **NextAuth.js** - 인증 및 세션 관리
- **rclone** - 멀티 클라우드 스토리지 백엔드
- **Docker** - 컨테이너화된 배포

## Docker로 빠른 시작

### 사전 요구 사항
- Docker & Docker Compose
- `~/.config/rclone/rclone.conf`에 위치한 rclone 설정 파일

### 개발 환경 설정

1. 저장소 복제
```bash
git clone <repository-url>
cd rrlist
```

2. 개발 컨테이너 시작
```bash
docker compose up rrlist-dev
```

3. 애플리케이션 접근
- 웹 UI: http://localhost:3003
- 기본 관리자 자격 증명은 첫 시작 시 컨테이너 로그에 표시됩니다

### 프로덕션 배포

```bash
# 프로덕션 컨테이너 빌드 및 시작
docker compose up rrlist -d
```

## 아키텍처

### 서비스
- **rrlist-dev**: 핫 리로드가 있는 개발 컨테이너
- **rrlist**: 최적화된 빌드가 있는 프로덕션 컨테이너
- **자동 설정**: 안전한 랜덤 패스워드로 관리자 사용자 생성

### 컨테이너 기능
- **사용자 관리**: 파일 권한을 위한 적절한 UID/GID 매칭
- **rclone 통합**: 상태 모니터링을 포함한 백그라운드 데몬
- **설정 동기화**: 자동 토큰 새로고침 동기화
- **로그 순환**: 크기 제한 로깅 (10MB × 3개 파일)
- **타임존 지원**: `TZ` 환경변수를 통한 설정 가능

## 설정

### 환경 변수 (.env)
```env
# 데이터베이스
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3003"
NEXTAUTH_SECRET="your-nextauth-secret-key"

# rclone 설정
RCLONE_RC_URL="http://127.0.0.1:5572"
RCLONE_RC_USER=""
RCLONE_RC_PASS=""
```

### Docker Compose 서비스

#### 개발 환경 (rrlist-dev)
- Node.js 18 Alpine 베이스 이미지
- 실시간 코드 변경을 위한 볼륨 마운팅
- 자동 관리자 사용자 생성
- 상태 확인이 포함된 rclone 데몬

#### 프로덕션 (rrlist)
- 멀티 스테이지 Docker 빌드
- 최적화된 Next.js 독립 실행형 출력
- 읽기 전용 rclone.conf 마운팅
- 재시작 정책 및 상태 확인

## 프로젝트 구조

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/           # 인증 엔드포인트
│   │   │   └── rclone/         # rclone RC API 프록시
│   │   │       ├── files/      # 파일 작업
│   │   │       ├── remotes/    # 원격 스토리지 목록
│   │   │       ├── storage/    # 스토리지 사용량 모니터링
│   │   │       └── check/      # 상태 확인
│   │   ├── auth/               # 인증 페이지
│   │   │   ├── login/          # 로그인 페이지
│   │   │   └── change-password/ # 패스워드 변경
│   │   └── page.tsx            # 메인 파일 브라우저
│   ├── components/
│   │   └── file-browser/       # 파일 브라우저 컴포넌트
│   ├── lib/
│   │   └── auth.ts             # NextAuth 설정
│   └── prisma/
│       └── schema.prisma       # 데이터베이스 스키마
├── entrypoint.sh               # 컨테이너 초기화
├── Dockerfile                  # 컨테이너 빌드 지시사항
├── compose.yml                 # Docker Compose 설정
└── next.config.js              # Next.js 설정
```

## 구현된 기능

### ✅ 인증 시스템
- NextAuth.js를 활용한 안전한 사용자 인증
- 랜덤 패스워드로 자동 관리자 사용자 생성
- 첫 로그인 시 패스워드 변경 강제
- 세션 관리 및 보호

### ✅ 파일 브라우저
- rclone을 통한 멀티 클라우드 스토리지 지원
- 실시간 파일 목록 및 네비게이션
- 실시간 업데이트가 있는 스토리지 사용량 모니터링
- 모든 원격 저장소의 상태 확인

### ✅ 실시간 모니터링
- 실시간 스토리지 업데이트를 위한 Server-Sent Events
- 백그라운드 스토리지 폴링 (5분 간격)
- 자동 오류 감지 및 보고
- 연결 상태 표시기

### ✅ 컨테이너 최적화
- 파일 권한을 위한 적절한 UID/GID 처리
- rclone.conf 토큰 새로고침 동기화
- inotify를 통한 원자적 쓰기 감지
- 모니터링을 위한 상태 확인 엔드포인트

### ✅ 보안 기능
- 환경 기반 설정
- 안전한 세션 처리
- 입력 검증 및 살균
- 적절한 오류 처리 및 로깅

## 개발

### 로컬 개발
```bash
# 의존성 설치
npm install

# Prisma 클라이언트 생성
npx prisma generate

# 개발 서버 시작
npm run dev
```

### 데이터베이스 관리
```bash
# 스키마 변경 사항 적용
npx prisma db push

# 데이터베이스 초기화 (개발 환경만)
rm dev.db && npx prisma db push
```

### 컨테이너 개발
```bash
# 로그 보기
docker logs rrlist-dev -f

# 컨테이너에서 명령 실행
docker exec -it rrlist-dev sh

# 컨테이너 재시작
docker restart rrlist-dev
```

## 모니터링 & 로그

### 스토리지 모니터링
- `/api/rclone/storage/stream`을 통한 실시간 스토리지 사용량
- 5분마다 백그라운드 폴링
- 동시 스토리지 확인 (한 번에 5개 원격 저장소)
- 오류 감지 및 보고

### 로그 관리
- 순환 로그: 최대 10MB 크기, 3개 파일 보관
- 타임스탬프가 있는 구조화된 로깅
- 컨테이너 상태 모니터링
- rclone 데몬 상태 추적

## 보안 고려 사항

- **인증 필수**: 모든 엔드포인트 보호
- **세션 보안**: NextAuth.js를 통한 안전한 JWT 토큰
- **파일 권한**: 컨테이너에서 적절한 UID/GID 처리
- **설정 보호**: 600 권한의 rclone.conf
- **입력 검증**: 모든 사용자 입력 살균 처리
- **오류 처리**: 정보 노출 없는 안전한 오류 메시지

## 주요 구현 과정

### 1단계: 기본 인프라
- **프로젝트 설정**: Next.js 15 프로젝트 생성 및 TypeScript 설정
- **데이터베이스**: Prisma 스키마 정의 및 설정 (User, Role, Permission 모델)
- **인증 시스템**: NextAuth.js를 통한 사용자 인증 구현
- **자동 관리자 생성**: 컨테이너 첫 시작 시 랜덤 패스워드로 admin 사용자 생성

### 2단계: rclone 통합
- **rclone 클라이언트**: RC API 통신 라이브러리 개발
- **파일 탐색**: 파일/폴더 목록 및 네비게이션 기능
- **상태 모니터링**: 실시간 스토리지 사용량 및 상태 확인
- **데몬 관리**: rclone 데몬 자동 시작 및 상태 확인

### 3단계: 컨테이너 최적화
- **권한 관리**: UID/GID 매칭을 통한 파일 권한 해결
- **설정 동기화**: rclone.conf 토큰 새로고침 자동 동기화
- **파일 감시**: inotify를 통한 원자적 쓰기 감지
- **로그 최적화**: 로그 순환 및 크기 제한

### 4단계: 보안 및 최적화
- **SSE 인증**: Server-Sent Events에 인증 추가
- **환경변수 정리**: 중복 설정 제거 및 .env 통합
- **타임존 설정**: TZ 환경변수 지원
- **로그 관리**: Docker 로그 크기 제한 및 순환

## 기술적 해결 과제

### Docker 권한 문제 해결
- 컨테이너 내부 앱의 UID/GID를 호스트와 일치시켜 파일 권한 문제 해결
- rclone.conf 파일의 600 권한 유지하면서 토큰 업데이트 지원

### rclone 설정 동기화
- rclone이 토큰 새로고침 시 임시 파일 생성 후 mv하는 패턴 감지
- inotify로 MOVED_TO 이벤트 감지하여 설정 파일 동기화

### 실시간 모니터링
- Server-Sent Events로 실시간 스토리지 사용량 업데이트
- 백그라운드 작업으로 주기적 스토리지 상태 확인
- 동시성 제어 및 오류 처리

## 기여하기

1. 저장소 포크
2. 기능 브랜치 생성
3. 적절한 테스트와 함께 변경 사항 작성
4. 필요에 따라 문서 업데이트
5. 풀 리퀘스트 제출

## 라이센스

[라이센스 정보 추가 예정]

---

영어 문서는 [README.md](README.md)를 참조하세요.