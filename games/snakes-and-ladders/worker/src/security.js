const encoder = new TextEncoder();

export async function getFitBalance(env, wallet) {
  const rpcUrl = env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/";
  const call = async (payload) => {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error("BSC RPC unavailable.");
    const data = await response.json();
    if (data.error || typeof data.result !== "string" || !/^0x[0-9a-f]+$/i.test(data.result)) {
      throw new Error("BSC RPC returned an invalid result.");
    }
    return data.result;
  };
  const chainId = await call({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] });
  if (BigInt(chainId) !== 56n) throw new Error("Configured RPC is not BNB Smart Chain.");
  const data = "0x70a08231" + wallet.slice(2).toLowerCase().padStart(64, "0");
  return BigInt(await call({
    jsonrpc: "2.0", id: 2, method: "eth_call",
    params: [{ to: "0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa", data }, "latest"]
  }));
}

export async function rateLimit(request, env, bucket, limit, seconds) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = bucket + ":" + ip;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / seconds) * seconds;
  const row = await env.DB.prepare(
    "INSERT INTO api_rate_limits (bucket_key, window_start, hits, expires_at) VALUES (?, ?, 1, ?) " +
    "ON CONFLICT(bucket_key) DO UPDATE SET hits = CASE WHEN api_rate_limits.window_start = excluded.window_start THEN api_rate_limits.hits + 1 ELSE 1 END, window_start = excluded.window_start, expires_at = excluded.expires_at RETURNING hits"
  ).bind(key, windowStart, windowStart + seconds * 2).first();
  return Number(row?.hits || 0) <= limit;
}
