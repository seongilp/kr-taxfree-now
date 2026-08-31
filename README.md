# KR Tax-Free Now

**Find tax-refund (사후면세) shops near you, on a map, in your language.**

내 주변에서 택스리펀 되는 가게를 내 언어(영·일·중간·중번)로 지도에서 찾는 외국인 여행객용 앱.
니치는 **브랜드 무관 × 택스리펀 × 내 주변 × 4개 언어** — 올리브영 공식앱은 자기 브랜드만, 네이버지도는
택스리펀으로 못 거르고, VisitKorea는 "내 주변" 각이 없다. 형제 앱 `kr-events-now`(시간축)의 **공간축** 버전.

## 데이터

한국관광공사 TourAPI 외국어 서비스 `B551011/{Eng,Jpn,Chs,Cht}Service2` 의 `areaBasedList2`
(**contentTypeId=79 쇼핑**) · `detailCommon2`. 좌표(mapx/mapy, WGS84)를 API 가 직접 준다.

- 전국 쇼핑 카탈로그: 언어별 약 **11,070건**(영 11,070 / 일 11,075 / 중간 11,054 / 중번 10,924).
- 그중 **약 98.8%가 택스리펀 태그**(`[Tax Refund Shop]` / `[事後免税店]` / `[事后免税店]` / `[事後免稅店]`)
  — 사실상 전국 사후면세점 디렉토리.
- 올리브영 약 **1,257건**(4개 언어). 브랜드 칩은 데이터에서 자동 추출(하드코딩 없음), 올리브영이 자동 1위.

## 설계의 핵심 — 11,070건을 통째로 안 보낸다

11,070건 × 4개 언어를 클라이언트로 내리면 모바일·해외 로밍에서 죽는다. 그래서:

1. **서버가 전량을 캐시**한다(`lib/kto-cache.ts`). 언어당 하루 1회 12페이지 수집 = **약 48콜/일**
   (오퍼레이션당 한도 1,000/일 대비 여유 큼). 위치가 바뀌어도 업스트림은 **0** — 캐시된 전량에서 다시 고른다.
2. **서버가 공간 필터**를 한다(`lib/geo.ts` `nearest()`). 요청 좌표 기준으로 가까운 **≤200건**만 내린다
   (payload ~30KB). `locationBasedList2`(반경 API)를 사용자 요청마다 부르는 설계는 쓰지 않는다 —
   쿼터가 사용자 수에 비례해 터지기 때문.

메모리 캐시 + inflight 로 충분하다(Neon 불필요). TTL 은 KST 자정 컷.

## 정직성 (이 앱의 생명)

택스리펀은 돈 문제라 틀리면 사용자가 공항에서 손해를 본다.

- API 는 `[Tax Refund Shop]` **태그만** 준다. **환급률·즉시/사후 구분·금액은 주지 않는다** —
  UI 가 절대 계산하지 않고, 상세 시트에 이 천장을 명시한다.
- 태그 없는 매장은 **"택스리펀 여부 정보 없음"**(회색)이지 "안 됨"이 아니다. 둘을 구분한다.
- 외국어 서비스에 섞여 온 **한국어 상호·주소는 결측 처리**한다(기계번역으로 안 메운다). 좌표는 살아 있어
  지도 핀·길찾기는 그대로 된다.
- 위치 거부/불가/미지원을 각각 다른 상태로 보여주고, 폴백(서울)이면 거리를 "서울에서 N km"로 정직하게 표기.

## 함정 방어 (형제 앱들이 피 흘려 배운 것)

- **serviceKey verbatim.** `DATA_GO_KR_KEY`(=`HORSE`)는 이미 %-인코딩된 Encoding 키. `?serviceKey=${key}`로
  그대로 보간한다. `URLSearchParams`/params 에 넣으면 재인코딩되어 403(미구독과 헷갈림).
- **200 이 성공이 아니다.** `resultCode`/`returnReasonCode` 파싱. 정상/에러 최상위 구조가 통째로 다르다.
- `detailCommon2` 에 `overviewYN`/`addrinfoYN` 붙이지 않는다(v2 에 없어 resultCode 10).
- 모든 fetch 에 `AbortSignal.timeout(6s)`. 실패는 캐시하지 않는다.
- **MapLibre v5**(v6 는 Turbopack 워커 로딩 실패로 지도가 조용히 안 뜬다). Vercel `regions:["icn1"]`.

## 개발

```bash
cp .env.example .env.local   # DATA_GO_KR_KEY 채우기(관광공사 Encoding 키, verbatim)
npm install
npm run dev                  # http://localhost:3000
npm test                     # KST · 응답 파서 · 공간 필터 · 브랜드 추출
npm run build
```

## 구조

```
lib/
  kto-api.ts     areaBasedList2(쇼핑 79) 페이지네이션 + detailCommon2. 키 verbatim.
  shops.ts       정규화·응답 파서·택스리펀 태그·한글 결측 처리 (순수)
  brands.ts      브랜드 자동 추출 — 한국어 원제 선두 토큰 빈도 (순수)
  kto-cache.ts   전량 카탈로그 캐시(KST 자정 TTL) + 브랜드 배정
  geo.ts         하버사인 + nearest() 공간 필터 (순수)
  kst.ts         KST 달력 날짜(에폭 일수 정수)
  i18n.ts        4개 언어 사전(직접 번역, 기계번역 아님)
app/
  [lang]/        랜딩 · 지도(map) — i18n 라우팅
  api/shops/     공간 필터 API(서버) + 상세
components/      지도 · 리스트 카드 · 상세 시트 · 브라우저
```

데이터: 한국관광공사(TourAPI). 위치 데이터는 정적이며 재고·프로모션·실시간은 제공하지 않는다.
