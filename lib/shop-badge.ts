import type { Dict } from './i18n';

/**
 * 택스리펀 배지의 텍스트·색. 지도 마커 색(shops-map)과 **같은 의미의 팔레트**를 쓴다.
 *  - 택스리펀 확인(초록): API 가 태그를 준 매장. "여기서 택스리펀 됨"까지만 뜻한다(금액 아님).
 *  - 여부 불명(회색): 태그가 없는 매장. "안 됨"이 아니라 "정보 없음"이다(둘을 구분, F-6).
 */
export function taxRefundLabel(taxRefund: boolean, d: Dict): string {
  return taxRefund ? d.taxRefundYes : d.taxRefundUnknown;
}

export function taxRefundBadgeClass(taxRefund: boolean): string {
  return taxRefund
    ? 'bg-green-500/15 text-green-400 border-green-500/30'
    : 'bg-gray-500/15 text-gray-400 border-gray-500/30';
}

/** 지도 마커 색(배지와 의미 일치). */
export const TAX_REFUND_COLOR = '#22c55e'; // 초록 — 택스리펀 확인
export const UNKNOWN_COLOR = '#9ca3af'; // 회색 — 여부 불명
