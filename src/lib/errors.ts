/** 서버 오류 코드 → 무엇이 잘못됐고 어떻게 고치는지 말하는 안내 */
const MAP: Record<string, string> = {
  not_authenticated: '로그인이 풀렸어요. 다시 로그인해주세요.',
  invalid_role: '신랑 또는 신부를 골라주세요.',
  nick_too_long: '호칭은 12자 이내로 입력해주세요.',
  already_in_household: '이미 다른 가정에 속해 있어요. 한 계정은 한 가정에만 들어갈 수 있어요.',
  invalid_code: '이 코드의 가정을 찾지 못했어요. 짝꿍에게 받은 6자리 코드를 다시 확인해주세요.',
  household_full: '이미 두 사람이 등록된 가정이에요. 코드가 맞는지 짝꿍에게 확인해주세요.',
  not_member: '가정 정보를 찾지 못했어요. 새로고침한 뒤 다시 시도해주세요.',
  invite_code_exhausted: '초대코드를 만들지 못했어요. 잠시 뒤 다시 시도해주세요.',
};

export function errorMessage(e: unknown, fallback = '저장하지 못했어요. 네트워크를 확인하고 다시 시도해주세요.'): string {
  const msg = (e as { message?: string } | null)?.message ?? '';
  if (MAP[msg]) return MAP[msg];
  const code = (e as { code?: string } | null)?.code;
  if (code === '42501') return '권한이 없어 저장하지 못했어요. 같은 가정 구성원인지 확인해주세요.';
  if (code === '23514') return '입력값이 허용 범위를 벗어났어요. 값을 확인해주세요.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return '네트워크에 연결하지 못했어요. 연결을 확인하고 다시 시도해주세요.';
  return fallback;
}
