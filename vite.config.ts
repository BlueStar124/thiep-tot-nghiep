import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { getInvite, saveInvite, type KV } from './server/invite-store'

/** Chạy thử API /api/invite trên máy: lưu vào file .data/invites.json thay cho Upstash */
function localInviteApi(): Plugin {
  const file = path.resolve('.data/invites.json')
  const load = async (): Promise<Record<string, string>> => {
    try {
      return JSON.parse(await readFile(file, 'utf8'))
    } catch {
      return {}
    }
  }
  const kv: KV = {
    get: async (key) => (await load())[key] ?? null,
    set: async (key, value) => {
      const all = await load()
      all[key] = value
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, JSON.stringify(all, null, 2))
    }
  }
  return {
    name: 'local-invite-api',
    configureServer(server) {
      server.middlewares.use('/api/invite', async (req, res) => {
        let result
        if (req.method === 'POST') {
          let text = ''
          for await (const chunk of req) text += chunk
          try {
            result = await saveInvite(kv, JSON.parse(text))
          } catch {
            result = { status: 400, body: { error: 'Dữ liệu không hợp lệ' } }
          }
        } else {
          result = await getInvite(kv, new URL(req.url ?? '', 'http://x').searchParams.get('slug'))
        }
        res.statusCode = result.status
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(result.body))
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localInviteApi()],
  server: {
    port: 3000,
    host: true,
    open: true
  }
})
