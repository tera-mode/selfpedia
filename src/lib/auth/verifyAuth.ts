import { NextRequest } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export interface AuthResult {
  authenticated: boolean;
  uid: string | null;
  email?: string | null;
  isAnonymous?: boolean;
  error?: string;
}

/**
 * リクエストからFirebase認証トークンを検証
 * Authorizationヘッダーから Bearer トークンを取得して検証する
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        authenticated: false,
        uid: null,
        error: 'Missing or invalid Authorization header',
      };
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
      return {
        authenticated: false,
        uid: null,
        error: 'No token provided',
      };
    }

    // Firebase Admin SDKでトークンを検証
    const decodedToken = await adminAuth.verifyIdToken(token);

    // 匿名ユーザーかどうかを判定
    // Firebase匿名認証の場合、providerIdが'anonymous'またはsign_in_providerが'anonymous'
    const isAnonymous = decodedToken.firebase?.sign_in_provider === 'anonymous';

    return {
      authenticated: true,
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      isAnonymous,
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return {
      authenticated: false,
      uid: null,
      error: 'Invalid or expired token',
    };
  }
}

/**
 * 認証が必須のAPIで使用するヘルパー
 * 認証に失敗した場合はエラーレスポンスを返す
 */
export function createUnauthorizedResponse(message?: string) {
  return {
    error: message || 'Unauthorized',
    status: 401,
  };
}
