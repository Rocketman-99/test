/**
 * API 키 정규화.
 *
 * 콘솔에서 키를 복사하면 뒤에 개행이나 공백이 딸려오는 경우가 흔하다.
 * 입력창이 type="password" 라 눈으로 확인이 안 되는데, 그대로 전송하면
 * 서버가 401 authentication_error 를 돌려준다. 클라이언트/서버 양쪽에서
 * 이 함수를 거치게 해서 그 경로를 막는다.
 *
 * 공백만 남는 값은 undefined 로 돌려 `?? process.env.X` 폴백이 살아나게 한다.
 */
export function normalizeApiKey(raw?: string | null): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}
