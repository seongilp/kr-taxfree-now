import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dayToYmd, kstToday, msUntilKstMidnight, todayYmdKst, ymdToDay } from '../kst';

const DAY_MS = 86_400_000;
const KST_OFFSET = 9 * 3600 * 1000;

describe('ymdToDay — 존재하는 날짜만 에폭 일수로', () => {
  it('정상 날짜를 에폭 일수로 바꾼다', () => {
    assert.equal(ymdToDay('19700101'), 0);
    assert.equal(ymdToDay('19700102'), 1);
  });
  it('존재하지 않는 날짜(2월 31일)는 null — 조용히 3월로 굴러가지 않는다', () => {
    assert.equal(ymdToDay('20260231'), null);
  });
  it('형식이 어긋나면 null', () => {
    assert.equal(ymdToDay('2026-09-01'), null);
    assert.equal(ymdToDay('202609'), null);
    assert.equal(ymdToDay(''), null);
    assert.equal(ymdToDay(undefined), null);
    assert.equal(ymdToDay(null), null);
  });
  it('round-trip: ymd → day → ymd', () => {
    assert.equal(dayToYmd(ymdToDay('20260901')!), '20260901');
  });
});

describe('kstToday — 자정 경계가 KST 로 도는지', () => {
  it('KST 자정 직전과 직후는 서로 다른 날, 하지만 같은 KST 벽시계 날짜 안이면 같은 날', () => {
    // 2026-09-01 KST 00:00 = 2026-08-31 15:00 UTC
    const kstMidnight = Date.UTC(2026, 7, 31, 15, 0, 0);
    assert.equal(dayToYmd(kstToday(kstMidnight)), '20260901');
    // 그 1ms 전은 아직 8/31 (KST)
    assert.equal(dayToYmd(kstToday(kstMidnight - 1)), '20260831');
    // 23:59:59 KST 여전히 9/1
    assert.equal(dayToYmd(kstToday(kstMidnight + DAY_MS - 1)), '20260901');
  });
  it('UTC 자정이 아니라 KST 자정이 기준이다', () => {
    // 2026-09-01 03:00 UTC = 2026-09-01 12:00 KST → 9/1
    assert.equal(todayYmdKst(Date.UTC(2026, 8, 1, 3, 0, 0)), '20260901');
    // 2026-09-01 00:00 UTC = 2026-09-01 09:00 KST → 여전히 9/1 (UTC 기준이면 틀림)
    assert.equal(todayYmdKst(Date.UTC(2026, 8, 1, 0, 0, 0)), '20260901');
    // 2026-08-31 20:00 UTC = 2026-09-01 05:00 KST → 9/1 (UTC 기준이면 8/31 로 틀림)
    assert.equal(todayYmdKst(Date.UTC(2026, 7, 31, 20, 0, 0)), '20260901');
  });
});

describe('msUntilKstMidnight — 캐시 TTL 자정 컷', () => {
  it('KST 자정 정각이면 꼬박 하루', () => {
    const kstMidnight = Date.UTC(2026, 7, 31, 15, 0, 0);
    assert.equal(msUntilKstMidnight(kstMidnight), DAY_MS);
  });
  it('항상 (0, 하루] 범위', () => {
    for (const t of [0, KST_OFFSET, Date.now(), Date.UTC(2026, 8, 1, 5, 33, 12)]) {
      const v = msUntilKstMidnight(t);
      assert.ok(v > 0 && v <= DAY_MS, `범위 밖: ${v}`);
    }
  });
});
