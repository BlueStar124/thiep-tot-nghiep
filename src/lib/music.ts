/**
 * Nhạc nền thiệp: phát file public/nhac-nen.mp3 ("Rực Rỡ").
 * - Chỉ tải nhạc khi khách bấm bật (preload none) → không làm chậm lúc mở thiệp.
 * - Lặp lại liên tục, tăng âm lượng từ từ khi bật, giảm dần khi tắt.
 * - Vẫn phát tiếp khi chuyển sang bản đồ; quay lại thiệp nút vẫn đúng trạng thái.
 */
const SRC = '/nhac-nen.mp3'
const VOLUME = 0.55

type Listener = (playing: boolean) => void

class MusicPlayer {
  private audio: HTMLAudioElement | null = null
  private playing = false
  private fadeTimer: number | null = null
  private listeners = new Set<Listener>()
  /** Khách đã từng bật hoặc chủ động tắt → không tự phát nữa */
  private touched = false

  private el() {
    if (!this.audio) {
      const a = new Audio(SRC)
      a.loop = true
      a.preload = 'none'
      a.volume = 0
      this.audio = a
    }
    return this.audio
  }

  private set(playing: boolean) {
    this.playing = playing
    this.listeners.forEach((fn) => fn(playing))
  }

  private fadeTo(target: number, ms: number, done?: () => void) {
    const a = this.el()
    if (this.fadeTimer) clearInterval(this.fadeTimer)
    const steps = Math.max(1, Math.round(ms / 50))
    const delta = (target - a.volume) / steps
    let i = 0
    this.fadeTimer = window.setInterval(() => {
      i++
      a.volume = Math.min(1, Math.max(0, i >= steps ? target : a.volume + delta))
      if (i >= steps) {
        if (this.fadeTimer) clearInterval(this.fadeTimer)
        this.fadeTimer = null
        done?.()
      }
    }, 50)
  }

  /** auto = true: lần tự phát; nếu trình duyệt từ chối thì lần chạm sau sẽ thử lại */
  play(auto = false) {
    const a = this.el()
    if (!auto) this.touched = true
    this.set(true)
    a.play()
      .then(() => {
        this.touched = true
        this.fadeTo(VOLUME, 1200)
      })
      .catch(() => this.set(false)) // trình duyệt chặn hoặc lỗi tải → trả nút về "tắt"
  }

  pause() {
    this.touched = true
    this.set(false)
    this.fadeTo(0, 400, () => this.audio?.pause())
  }

  /** Bật/tắt, trả về trạng thái mới (giữ tương thích với chỗ gọi cũ) */
  toggle(): boolean {
    if (this.playing) this.pause()
    else this.play()
    return this.playing
  }

  /**
   * Tự phát khi khách chạm/bấm lần đầu (trình duyệt chỉ cho phát nhạc sau một thao tác của người dùng).
   * skip(target) = true → bỏ qua lần chạm đó (ví dụ chạm trúng nút loa, để nút tự xử lý).
   * Trả về hàm huỷ.
   */
  armAutoplay(skip?: (target: EventTarget | null) => boolean) {
    if (this.touched) return () => {}
    // Các thao tác trình duyệt tính là "người dùng cho phép" phát âm thanh
    const events = ['mousedown', 'pointerup', 'touchend', 'keydown'] as const
    const cleanup = () => events.forEach((ev) => window.removeEventListener(ev, onFirst, true))
    const onFirst = (e: Event) => {
      if (this.touched) return cleanup()
      if (skip?.(e.target)) return // chạm trúng nút loa → để nút tự xử lý
      this.play(true)
    }
    events.forEach((ev) => window.addEventListener(ev, onFirst, { capture: true, passive: true }))
    return cleanup
  }

  /** Đã có nhạc lần nào chưa (để nút loa nhấp nháy mời bật) */
  wasTouched() {
    return this.touched
  }

  getPlaying() {
    return this.playing
  }

  /** Theo dõi trạng thái để nút bật/tắt luôn đúng */
  subscribe(fn: Listener) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
}

export const soundEngine = new MusicPlayer()
