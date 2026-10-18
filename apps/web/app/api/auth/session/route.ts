import { NextResponse } from 'next/server';

import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth/session';

/**
 * Token'ı `httpOnly` çereze yazar. Çerez tarayıcı JavaScript'ine kapalı olduğu
 * için buradan geçmek zorunda.
 *
 * **Token burada doğrulanmıyor** ve bu bilinçli: doğrulama için Firebase Admin
 * SDK'sı gerekirdi, o da servis hesabı anahtarını web sunucusuna taşımak demek.
 * Çerezin tek işlevi `middleware.ts`e "bir oturum var" demek. Uydurma bir çerezle
 * gelen kişi yalnız boş bir kabuk görür: sayfadaki her veri çağrısı gerçek
 * token'ı olmadığı için backend'de 401 yer.
 */

export async function POST(request: Request) {
  const body = (await request.json()) as { token?: unknown };

  if (typeof body.token !== 'string' || !body.token) {
    return NextResponse.json(
      { error: 'token alanı zorunlu.' },
      { status: 400 }
    );
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: body.token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
