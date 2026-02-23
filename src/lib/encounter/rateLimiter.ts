// レート制限ユーティリティ
// Vercelサーバーレス環境ではリクエスト間でメモリが共有されない場合があるが、
// 同一Lambdaインスタンスの再利用時には有効

class RateLimiter {
  private lastCall: Map<string, number> = new Map();
  private intervals: Record<string, number> = {
    rakuten: 1100,    // 1秒1リクエスト + バッファ
    tmdb: 250,        // 4リクエスト/秒
    openbd: 100,      // 制限なし（礼儀として）
    rawg: 250,        // 明確な制限なし（礼儀として4/秒）
    jikan: 700,       // 3リクエスト/秒（MAL準拠・厳守）
  };

  async wait(service: string): Promise<void> {
    const interval = this.intervals[service] || 1000;
    const last = this.lastCall.get(service) || 0;
    const elapsed = Date.now() - last;
    if (elapsed < interval) {
      await new Promise(resolve => setTimeout(resolve, interval - elapsed));
    }
    this.lastCall.set(service, Date.now());
  }
}

export const rateLimiter = new RateLimiter();
