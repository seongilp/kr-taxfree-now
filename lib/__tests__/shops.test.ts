import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  cleanName,
  containsHangul,
  hasTaxRefundTag,
  itemsOf,
  koreanOriginal,
  normalize,
  parseApiError,
  type ShopRaw,
} from '../shops';

describe('parseApiError — 정상/에러 최상위 구조가 통째로 다르다(F-9)', () => {
  it('정상(resultCode 0000)은 null', () => {
    assert.equal(parseApiError({ response: { header: { resultCode: '0000', resultMsg: 'OK' } } }), null);
  });
  it('cmmMsgHeader(키/쿼터 계열)를 잡는다 — 200 이어도 실패', () => {
    const json = {
      OpenAPI_ServiceResponse: {
        cmmMsgHeader: { returnReasonCode: '22', errMsg: 'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR' },
      },
    };
    assert.deepEqual(parseApiError(json), { code: '22', msg: 'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR' });
  });
  it('response.header 의 비-0000 도 에러로(파라미터 오류 10/11 등)', () => {
    const json = { response: { header: { resultCode: '10', resultMsg: 'INVALID_REQUEST_PARAMETER_ERROR' } } };
    assert.deepEqual(parseApiError(json), { code: '10', msg: 'INVALID_REQUEST_PARAMETER_ERROR' });
  });
});

describe('itemsOf — 0건은 items:"" 로 온다', () => {
  it('0건(items:"")은 빈 배열', () => {
    assert.deepEqual(itemsOf({ response: { body: { items: '', totalCount: 0 } } }), []);
  });
  it('단일 객체(item 하나)도 배열로 감싼다', () => {
    assert.equal(itemsOf({ response: { body: { items: { item: { contentid: '1' } } } } }).length, 1);
  });
  it('배열은 그대로', () => {
    const many = itemsOf({ response: { body: { items: { item: [{ contentid: '1' }, { contentid: '2' }] } } } });
    assert.equal(many.length, 2);
  });
  it('에러 구조가 들어와도 crash 아니라 빈 배열(판정은 parseApiError)', () => {
    assert.deepEqual(itemsOf({ OpenAPI_ServiceResponse: { cmmMsgHeader: { returnReasonCode: '30' } } }), []);
  });
});

describe('hasTaxRefundTag — 언어별 태그 표기를 모두 잡는다(실측)', () => {
  it('영 [Tax Refund Shop]', () => {
    assert.equal(hasTaxRefundTag('Some Store[Tax Refund Shop](한글)'), true);
  });
  it('일 [事後免税店] / 중간 [事后免税店] / 중번 [事後免稅店]', () => {
    assert.equal(hasTaxRefundTag('店[事後免税店](한글)'), true);
    assert.equal(hasTaxRefundTag('店[事后免税店](한글)'), true);
    assert.equal(hasTaxRefundTag('店[事後免稅店](한글)'), true);
  });
  it('태그 없으면 false — "안 됨"이 아니라 "여부 정보 없음"', () => {
    assert.equal(hasTaxRefundTag('10 Corso Como Cheongdam Branch (10꼬르소꼬모 청담점)'), false);
  });
});

describe('cleanName — 택스리펀 태그 + 한글 원제 괄호를 벗긴다(F-2)', () => {
  it('영문: 태그와 한글 괄호를 모두 제거', () => {
    assert.equal(
      cleanName('0914 Flagship Store Dosan Park[Tax Refund Shop](0914 도산공원 플래그십 스토어)'),
      '0914 Flagship Store Dosan Park',
    );
  });
  it('일문: 전각 괄호（）의 한글 원제 + 태그 제거', () => {
    assert.equal(cleanName('AK PLAZA弘大[事後免税店]（AK PLAZA 홍대）'), 'AK PLAZA弘大');
  });
  it('한글 없는 괄호는 정보이므로 남긴다', () => {
    assert.equal(cleanName('AK PLAZA (Hongdae)'), 'AK PLAZA (Hongdae)');
  });
  it('일본어/중국어 상호 자체는 건드리지 않는다(한글만 타겟)', () => {
    assert.equal(cleanName('優衣庫'), '優衣庫');
  });
});

describe('koreanOriginal — 4개 언어 공통 한국어 원제(브랜드 키의 근거)', () => {
  it('괄호 안 한글 원제를 뽑는다', () => {
    assert.equal(
      koreanOriginal('[事后免税店]TRENDPOD BY欧利芙洋弘大店(올리브영 트렌드팟 바이 홍대점)'),
      '올리브영 트렌드팟 바이 홍대점',
    );
  });
  it('한글 괄호가 없으면 빈 문자열', () => {
    assert.equal(koreanOriginal('AK PLAZA (Hongdae)'), '');
  });
});

const rawTagged: ShopRaw = {
  contentid: '2955131',
  title: '0914 Flagship Store Dosan Park[Tax Refund Shop](0914 도산공원 플래그십 스토어)',
  addr1: '15, Dosan-daero 45-gil, Gangnam-gu, Seoul',
  mapx: '127.03511742497182',
  mapy: '37.523230883209216',
  firstimage: 'https://img/x.jpg',
};

describe('normalize — 좌표 없으면 버림, 한글 결측 처리, 택스리펀 태그 판정', () => {
  it('정상 item 정규화(이름 정리·좌표 숫자·택스리펀 true)', () => {
    const s = normalize(rawTagged)!;
    assert.equal(s.name, '0914 Flagship Store Dosan Park');
    assert.equal(s.lat, 37.523230883209216);
    assert.equal(s.lon, 127.03511742497182);
    assert.equal(s.taxRefund, true);
    assert.equal(s.image, 'https://img/x.jpg');
  });
  it('좌표가 없으면 null(지도에 못 찍는다 = 존재이유)', () => {
    assert.equal(normalize({ ...rawTagged, mapx: '', mapy: '' }), null);
  });
  it('한국 밖 좌표(0,0 등)는 null', () => {
    assert.equal(normalize({ ...rawTagged, mapx: '0', mapy: '0' }), null);
  });
  it('주소에 한글이 섞이면 null 로 결측(번체 함정, F-3) — 좌표는 살아 지도는 된다', () => {
    const s = normalize({ ...rawTagged, addr1: '서울특별시 강남구 도산대로' })!;
    assert.equal(s.addr, null);
    assert.equal(s.lat, 37.523230883209216);
  });
  it('로마자/현지어 주소는 유지', () => {
    const s = normalize(rawTagged)!;
    assert.equal(s.addr, '15, Dosan-daero 45-gil, Gangnam-gu, Seoul');
  });
  it('태그 없는 매장은 taxRefund false(정보 없음, "안 됨" 아님)', () => {
    const s = normalize({ ...rawTagged, title: '10 Corso Como (10꼬르소꼬모 청담점)' })!;
    assert.equal(s.taxRefund, false);
    assert.equal(s.name, '10 Corso Como');
  });
  it('이름이 순수 한글만 남으면 버린다(중/일 화면에 한국어 상호 노출 금지, F-2)', () => {
    // 중국어 서비스에 번역 안 된 한국어 상호가 그대로 온 경우.
    assert.equal(normalize({ ...rawTagged, title: '스테이지35 성수' }), null);
  });
});

describe('containsHangul', () => {
  it('한글 음절·자모를 잡고, 한자·가나는 통과', () => {
    assert.equal(containsHangul('올리브영'), true);
    assert.equal(containsHangul('欧利芙洋'), false);
    assert.equal(containsHangul('優衣庫'), false);
    assert.equal(containsHangul('Olive Young'), false);
  });
});
