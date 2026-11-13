"""
Dựng video TikTok 1080×1920 / 30fps:
  ảnh chụp web (đã làm mờ SĐT) + đoạn quay bản đồ 3D + giọng đọc NamMinh + phụ đề kiểu zine.
Chạy:  python render.py            → out/thiep-tot-nghiep-tiktok.mp4 (+ .srt)
       python render.py --preview  → chỉ xuất vài khung hình xem thử vào out/preview/
"""
import json, os, re, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS = 1080, 1920, 30
PAD = 0.35            # nghỉ sau mỗi câu
XFADE = 0.22          # chuyển cảnh mờ dần (giây)
FONT_BLACK = 'C:/Windows/Fonts/seguibl.ttf'
FONT_BOLD = 'C:/Windows/Fonts/segoeuib.ttf'
YELLOW, INK, PAPER = (244, 210, 58), (17, 17, 17), (255, 255, 255)
OUT = 'out'
os.makedirs(OUT, exist_ok=True)

# ---------- âm thanh & thời lượng ----------
timing = json.load(open('audio/timing.json', encoding='utf-8'))


def audio_len(path):
    err = subprocess.run([FF, '-i', path], capture_output=True, text=True).stderr
    h, m, s = re.search(r'Duration: (\d+):(\d+):([\d.]+)', err).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


durs = [audio_len(f"audio/{s['id']}.mp3") + PAD for s in timing]
starts = np.cumsum([0] + durs[:-1]).tolist()
TOTAL = sum(durs)

# ---------- ảnh nguồn ----------
img = {k: Image.open(f'shots/{k}.png').convert('RGB') for k in ['guest-full', 'dashboard-full', 'rsvp-form', 'rsvp-done']}


def ease(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def kb(src, cx, cy, zoom):
    """Ken Burns: cắt khung quanh (cx, cy) với độ phóng zoom, đưa về 1080×1920"""
    w, h = W / zoom, H / zoom
    x0 = min(max(cx - w / 2, 0), src.width - w)
    y0 = min(max(cy - h / 2, 0), src.height - h)
    return src.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + w, y0 + h))


def lerp(a, b, k):
    return a + (b - a) * k


# ---------- đoạn bản đồ: chọn các chặng đẹp, bỏ đoạn camera xuyên qua nhà xe ----------
MAP_SEGS = [(0.3, 1.5), (1.5, 3.6), (3.7, 5.0), (10.3, 12.4), (12.6, 13.7)]


def load_map_frames():
    raw = subprocess.run([FF, '-v', 'error', '-i', 'clips/map-slow.mp4', '-vf', 'fps=30', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    n = len(raw) // (540 * 960 * 3)
    frames = np.frombuffer(raw, np.uint8)[: n * 540 * 960 * 3].reshape(n, 960, 540, 3)
    picked = []
    for a, b in MAP_SEGS:
        picked += list(frames[int(a * 30): int(b * 30)])
    return picked


map_frames = load_map_frames()


def map_frame(k):
    f = map_frames[min(len(map_frames) - 1, int(k * len(map_frames)))]
    im = Image.fromarray(f).resize((W, H), Image.BICUBIC)
    return im.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))


# ---------- vẽ chữ kiểu zine ----------
def font(path, size):
    return ImageFont.truetype(path, size)


def zine_box(draw, box, fill=PAPER, radius=26, border=6, shadow=10):
    x0, y0, x1, y1 = box
    draw.rounded_rectangle((x0 + shadow, y0 + shadow, x1 + shadow, y1 + shadow), radius, fill=INK)
    draw.rounded_rectangle(box, radius, fill=fill, outline=INK, width=border)


def tag_overlay(lines, size=84, rotate=-3, fill=YELLOW):
    """Nhãn vàng nghiêng, viền nét đứt – giống bảng tên trên thiệp"""
    f = font(FONT_BLACK, size)
    pad_x, pad_y, gap = 44, 30, 6
    sizes = [f.getbbox(t) for t in lines]
    tw = max(b[2] - b[0] for b in sizes)
    lh = [b[3] - b[1] for b in sizes]
    bw, bh = tw + pad_x * 2, sum(lh) + gap * (len(lines) - 1) + pad_y * 2
    im = Image.new('RGBA', (bw + 40, bh + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((14, 14, bw + 14, bh + 14), fill=INK)
    d.rectangle((6, 6, bw + 6, bh + 6), fill=fill)
    # viền nét đứt bên trong
    ix0, iy0, ix1, iy1 = 20, 20, bw - 8, bh - 8
    for x in range(ix0, ix1, 26):
        d.line((x, iy0, min(x + 14, ix1), iy0), fill=INK, width=4)
        d.line((x, iy1, min(x + 14, ix1), iy1), fill=INK, width=4)
    for y in range(iy0, iy1, 26):
        d.line((ix0, y, ix0, min(y + 14, iy1)), fill=INK, width=4)
        d.line((ix1, y, ix1, min(y + 14, iy1)), fill=INK, width=4)
    y = 6 + pad_y
    for t, b, h_ in zip(lines, sizes, lh):
        w_ = b[2] - b[0]
        d.text((6 + (bw - w_) / 2 - b[0], y - b[1]), t, font=f, fill=INK)
        y += h_ + gap
    return im.rotate(rotate, resample=Image.BICUBIC, expand=True)


# ---------- phụ đề: gom từ thành cụm ngắn, tô vàng từ đang đọc ----------
CAP_FONT = font(FONT_BLACK, 66)
CAP_Y = 1330  # vùng an toàn: không bị chữ mô tả / nút TikTok che


MAX_CHARS = 24


def chunk_words(words):
    """Tách theo chỗ ngắt hơi (dấu phẩy, chấm), rồi chia mỗi đoạn thành các cụm dài gần bằng nhau"""
    phrases, cur = [], []
    for i, w in enumerate(words):
        if cur and w['t'] - (words[i - 1]['t'] + words[i - 1]['d']) > 0.22:
            phrases.append(cur)
            cur = []
        cur.append(w)
    if cur:
        phrases.append(cur)
    chunks = []
    for ph in phrases:
        total = len(' '.join(x['w'] for x in ph))
        n = max(1, -(-total // MAX_CHARS))
        target = total / n
        cur, ln = [], 0
        for w in ph:
            if cur and ln + 1 + len(w['w']) > target + 4 and len(chunks) < 999:
                chunks.append(cur)
                cur, ln = [], 0
            ln += (1 if cur else 0) + len(w['w'])
            cur.append(w)
        chunks.append(cur)
    return chunks


SPLITS = json.load(open('phu-de.json', encoding='utf-8'))


def manual_chunks(sid, words):
    """Cụm phụ đề chia tay theo nhịp đọc (phu-de.json); số từ không khớp thì quay về chia tự động"""
    parts = [p.split() for p in SPLITS.get(sid, '').split('/') if p.strip()]
    if sum(map(len, parts)) != len(words):
        print('! phụ đề', sid, 'không khớp số từ – chia tự động')
        return chunk_words(words)
    out, i = [], 0
    for p in parts:
        out.append(words[i:i + len(p)])
        i += len(p)
    return out


captions = []  # (start, end, [words with abs time])
for si, s in enumerate(timing):
    base = starts[si]
    cks = manual_chunks(s['id'], s['words'])
    for ci, ck in enumerate(cks):
        a = base + ck[0]['t']
        b = base + (cks[ci + 1][0]['t'] if ci + 1 < len(cks) else min(durs[si], ck[-1]['t'] + ck[-1]['d'] + 0.3))
        captions.append((a, b, [dict(w, at=base + w['t']) for w in ck]))

_cap_cache = {}


def caption_image(ws, active):
    key = (id(ws), active)
    if key in _cap_cache:
        return _cap_cache[key]
    fnt = CAP_FONT
    while True:
        space = fnt.getlength(' ')
        lens = [fnt.getlength(w['w']) for w in ws]
        total = sum(lens) + space * (len(ws) - 1)
        if total <= 900 or fnt.size <= 44:
            break
        fnt = font(FONT_BLACK, fnt.size - 4)
    asc, desc = fnt.getmetrics()
    pad_x, pad_y = 40, 26
    bw, bh = int(total + pad_x * 2), asc + desc + pad_y * 2
    im = Image.new('RGBA', (bw + 20, bh + 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    zine_box(d, (0, 0, bw, bh))
    x = pad_x
    for i, (w, ln) in enumerate(zip(ws, lens)):
        if i == active:
            d.rounded_rectangle((x - 10, pad_y - 4, x + ln + 10, pad_y + asc + desc + 2), 12, fill=YELLOW)
        d.text((x, pad_y), w['w'], font=fnt, fill=INK)
        x += ln + space
    _cap_cache[key] = im
    return im


def draw_caption(frame, t):
    for a, b, ws in captions:
        if a <= t < b:
            active = max(i for i, w in enumerate(ws) if w['at'] <= t + 0.02) if t >= ws[0]['at'] else 0
            ov = caption_image(ws, active)
            frame.paste(ov, (int((W - ov.width) / 2 + 5), int(CAP_Y - ov.height / 2)), ov)
            return


HOOK = tag_overlay(['MÌNH TỰ CODE', 'THIỆP TỐT NGHIỆP'], 86, -3)
OUTRO = tag_overlay(['HẸN GẶP MỌI NGƯỜI', 'Ở LỄ TỐT NGHIỆP!'], 74, 2)

# ---------- từng cảnh ----------
G = img['guest-full']


def scene(i, k):
    """Khung hình cảnh i tại tiến độ k ∈ [0,1]"""
    e = ease(k)
    if i == 0:  # mở đầu: thiệp + trang khách, zoom nhẹ, tiêu đề nhãn vàng
        f = kb(G, 540, 960, lerp(1.0, 1.07, e))
        pop = min(1.0, k * 6)  # nhãn bật vào trong ~0,5s đầu
        hk = HOOK if pop >= 1 else HOOK.resize((max(1, int(HOOK.width * (0.7 + 0.3 * pop))), max(1, int(HOOK.height * (0.7 + 0.3 * pop)))), Image.BICUBIC)
        f.paste(hk, (int((W - hk.width) / 2), int(330 - hk.height / 2)), hk)
        return f
    if i == 1:  # cận cảnh thiệp: lia từ chữ GRADUATION xuống phần thông tin
        return kb(G, lerp(540, 600, e), lerp(760, 1180, e), lerp(1.75, 1.95, e))
    if i == 2:  # cuộn xuống: Kính mời Cô Lan → tên → đếm ngược → thông tin
        return kb(G, 540, lerp(1960, 2620, e), 1.0)
    if i == 3:  # bản đồ 3D
        return map_frame(k)
    if i == 4:  # form xác nhận → đã gửi
        a = kb(img['rsvp-form'], 540, 1000, lerp(1.0, 1.08, ease(min(1, k / 0.6))))
        if k < 0.55:
            return a
        b = kb(img['rsvp-done'], 540, 900, 1.12)
        return Image.blend(a, b, ease((k - 0.55) / 0.12))
    if i == 5:  # bảng theo dõi lời chúc: cuộn chậm
        return kb(img['dashboard-full'], 540, lerp(960, 2050, e), 1.0)
    if i == 6:  # kết: thiệp thu nhỏ dần + nhãn hẹn gặp
        f = kb(G, 540, lerp(840, 960, e), lerp(1.35, 1.0, e))
        f.paste(OUTRO, (int((W - OUTRO.width) / 2), int(330 - OUTRO.height / 2)), OUTRO)
        return f


def frame_at(t):
    si = max(i for i, s in enumerate(starts) if s <= t)
    k = (t - starts[si]) / durs[si]
    f = scene(si, k)
    # mờ dần từ cảnh trước trong XFADE giây đầu
    if si > 0 and t - starts[si] < XFADE:
        prev = scene(si - 1, 1.0)
        f = Image.blend(prev, f, ease((t - starts[si]) / XFADE))
    f = f.convert('RGB')
    draw_caption(f, t)
    return f


# ---------- xuất ----------
def write_srt():
    def ts(x):
        ms = int(round(x * 1000))
        return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}'
    with open(f'{OUT}/thiep-tot-nghiep-tiktok.srt', 'w', encoding='utf-8') as fh:
        for n, (a, b, ws) in enumerate(captions, 1):
            fh.write(f"{n}\n{ts(a)} --> {ts(b)}\n{' '.join(w['w'] for w in ws)}\n\n")


if '--preview' in sys.argv:
    os.makedirs(f'{OUT}/preview', exist_ok=True)
    for i in range(len(durs)):
        for k in (0.15, 0.7):
            frame_at(starts[i] + durs[i] * k).resize((360, 640)).save(f'{OUT}/preview/s{i + 1}-{int(k * 100)}.png')
    print('preview ok', round(TOTAL, 2), 's')
    sys.exit()

write_srt()
n_frames = int(round(TOTAL * FPS))
a_in, a_f = [], []
for i, s in enumerate(timing):
    a_in += ['-i', f"audio/{s['id']}.mp3"]
    a_f.append(f'[{i + 1}:a]aresample=44100,apad,atrim=0:{durs[i]:.3f}[a{i}]')
filt = ';'.join(a_f) + ';' + ''.join(f'[a{i}]' for i in range(len(timing))) + f'concat=n={len(timing)}:v=0:a=1,loudnorm=I=-14:TP=-1.5:LRA=11[aout]'
cmd = [FF, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', *a_in,
       '-filter_complex', filt, '-map', '0:v', '-map', '[aout]',
       '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
       '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', '-shortest', f'{OUT}/thiep-tot-nghiep-tiktok.mp4']
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for n in range(n_frames):
    p.stdin.write(frame_at(n / FPS).tobytes())
    if n % 150 == 0:
        print(f'{n}/{n_frames}', flush=True)
p.stdin.close()
p.wait()
print('xong', round(TOTAL, 2), 's, mã', p.returncode)
