"""Tạo giọng đọc nam (vi-VN-NamMinhNeural) cho từng cảnh + mốc thời gian từng từ để làm phụ đề."""
import asyncio, json, sys
import edge_tts

VOICE = 'vi-VN-NamMinhNeural'

async def once(scene):
    com = edge_tts.Communicate(scene['text'], VOICE, rate='+8%', boundary='WordBoundary')
    words, audio = [], bytearray()
    async for ch in com.stream():
        if ch['type'] == 'audio':
            audio += ch['data']
        elif ch['type'] == 'WordBoundary':
            words.append({'t': ch['offset'] / 1e7, 'd': ch['duration'] / 1e7, 'w': ch['text']})
    return audio, words

async def one(scene):
    # Dịch vụ thỉnh thoảng trả về rỗng ngẫu nhiên → thử lại tối đa 40 lần
    for attempt in range(40):
        try:
            audio, words = await once(scene)
            if audio and words:
                open(f"audio/{scene['id']}.mp3", 'wb').write(audio)
                print(scene['id'], 'ok sau', attempt + 1, 'lần')
                return {'id': scene['id'], 'text': scene['text'], 'words': words}
        except edge_tts.exceptions.NoAudioReceived:
            pass
        await asyncio.sleep(2)
    raise SystemExit(f"Không tạo được giọng cho {scene['id']}")

async def main():
    import os
    scenes = json.load(open('kich-ban.json', encoding='utf-8'))
    old = {s['id']: s for s in json.load(open('audio/timing.json', encoding='utf-8'))} if os.path.exists('audio/timing.json') else {}
    out = []
    for s in scenes:
        if s['id'] in old and old[s['id']]['text'] == s['text'] and os.path.exists(f"audio/{s['id']}.mp3"):
            out.append(old[s['id']])
        else:
            out.append(await one(s))
        json.dump(out, open('audio/timing.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for s in out:
        print(s['id'], len(s['words']), 'từ, kết thúc', round(s['words'][-1]['t'] + s['words'][-1]['d'], 2), 's')

asyncio.run(main())
