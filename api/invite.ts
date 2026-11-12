/**
 * Vercel Function: lưu & đọc thiệp trên Upstash Redis.
 * Bật 1 lần: Vercel → Project → Storage → Upstash (Redis) → Connect.
 * Vercel tự thêm biến môi trường KV_REST_API_URL / KV_REST_API_TOKEN (hoặc UPSTASH_REDIS_REST_URL / _TOKEN).
 * Tự thêm ADMIN_PASSWORD (Settings → Environment Variables): mật khẩu mở trình tạo thiệp.
 */
import { Redis } from '@upstash/redis'
import { getInvite, saveInvite, type ApiResult, type Auth, type KV } from '../server/invite-store.js'

function kv(): KV | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const redis = new Redis({ url, token, automaticDeserialization: false })
  return {
    get: async (key) => (await redis.get<string>(key)) ?? null,
    set: async (key, value) => {
      await redis.set(key, value)
    },
    // Danh sách Redis: thêm/xoá từng phần tử nguyên tử, nhiều khách gửi cùng lúc không đè nhau
    push: async (key, value) => {
      await redis.lpush(key, value)
    },
    list: async (key, max) => (await redis.lrange<string>(key, 0, max - 1)) ?? [],
    remove: async (key, value) => {
      await redis.lrem(key, 1, value)
    }
  }
}

const json = ({ status, body }: ApiResult, cache = 'no-store') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache } })

const notConfigured = () => json({ status: 503, body: { error: 'Chưa bật database Upstash trên Vercel' } })

export async function GET(request: Request) {
  const store = kv()
  if (!store) return notConfigured()
  const params = new URL(request.url).searchParams
  // Cho CDN giữ 30 giây: khách mở cùng lúc không phải gọi database nhiều lần
  return json(await getInvite(store, params.get('slug'), params.get('guest')), 'public, s-maxage=30, stale-while-revalidate=300')
}

export async function POST(request: Request) {
  const store = kv()
  if (!store) return notConfigured()
  const text = await request.text()
  if (text.length > 40_000) return json({ status: 413, body: { error: 'Dữ liệu quá lớn' } })
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    return json({ status: 400, body: { error: 'Dữ liệu không hợp lệ' } })
  }
  const auth: Auth = { password: process.env.ADMIN_PASSWORD?.trim() || undefined }
  return json(await saveInvite(store, payload, auth))
}
