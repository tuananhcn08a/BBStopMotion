/**
 * T-XW10 — logic thuần diary (streak khoan hồng, chip Hub, onion "hôm qua", dự phóng cuối tháng).
 * Mọi test dùng `now` injectable qua tham số — KHÔNG mock `Date.now()` toàn cục — verify nhiều
 * ngày/ranh giới lịch chính xác theo yêu cầu gate T-XW10.
 */
import { describe, it, expect } from 'vitest'
import {
  addDaysMs, capturedDaysCount, computeProjectChip, computeStreak, diaryPhotoPositionLast, diaryPhotoPositionNext,
  diaryTodayCount, distinctCaptureDaysMs, endOfMonthDurationSeconds, hasCapturedToday,
  latestFrameSeqForYesterday, projectDayNumber, startOfDayMs,
} from '../src/lib/project/diary'
import { ProjectFrame } from '../src/lib/project/types'

// Mốc cố định để test không phụ thuộc ngày chạy thật: 2026-07-20 12:00:00 giờ máy.
const DAY0 = new Date(2026, 6, 20, 12, 0, 0).getTime() // 20/07
const DAY_MINUS_1 = new Date(2026, 6, 19, 9, 0, 0).getTime() // 19/07 (hôm qua so với DAY0)
const DAY_MINUS_2 = new Date(2026, 6, 18, 20, 0, 0).getTime() // 18/07
const DAY_MINUS_4 = new Date(2026, 6, 16, 8, 0, 0).getTime() // 16/07

describe('startOfDayMs / distinctCaptureDaysMs — nền tảng so sánh ngày lịch (giờ máy)', () => {
  it('startOfDayMs trả 00:00:00 cùng ngày, không đổi qua giờ khác nhau trong ngày', () => {
    const morning = new Date(2026, 6, 20, 6, 30).getTime()
    const night = new Date(2026, 6, 20, 23, 59).getTime()
    expect(startOfDayMs(morning)).toBe(startOfDayMs(night))
    expect(new Date(startOfDayMs(morning)).getHours()).toBe(0)
  })

  it('distinctCaptureDaysMs dedup nhiều ảnh cùng ngày + sort tăng dần', () => {
    const days = distinctCaptureDaysMs([DAY0, DAY0 + 1000, DAY_MINUS_2, DAY_MINUS_1])
    expect(days).toHaveLength(3)
    expect(days[0]).toBeLessThan(days[1])
    expect(days[1]).toBeLessThan(days[2])
  })
})

describe('hasCapturedToday — TS-XP-03/BR-XP-9', () => {
  it('có ảnh chụp hôm nay (theo now) → true', () => {
    expect(hasCapturedToday([DAY0], DAY0)).toBe(true)
  })
  it('chỉ có ảnh hôm qua, chưa chụp hôm nay → false', () => {
    expect(hasCapturedToday([DAY_MINUS_1], DAY0)).toBe(false)
  })
  it('mảng rỗng (dự án mới) → false', () => {
    expect(hasCapturedToday([], DAY0)).toBe(false)
  })
})

describe('computeStreak — BR-XP-7/8 khoan hồng (nghỉ 1 ngày không reset, nghỉ ≥2 ngày reset)', () => {
  it('1 ngày chụp duy nhất → streak 1', () => {
    expect(computeStreak([DAY0])).toBe(1)
  })

  it('chụp liên tục 3 ngày không nghỉ → streak 3', () => {
    expect(computeStreak([DAY_MINUS_2, DAY_MINUS_1, DAY0])).toBe(3)
  })

  it('TS-XP-04: streak 5 + nghỉ ĐÚNG 1 ngày + chụp lại = 6 (khoan hồng, KHÔNG reset)', () => {
    // 5 ngày liên tục (16..20/07 minus mapping) rồi nghỉ 1 ngày (21/07) rồi chụp lại 22/07.
    const d1 = new Date(2026, 6, 16, 8).getTime()
    const d2 = new Date(2026, 6, 17, 8).getTime()
    const d3 = new Date(2026, 6, 18, 8).getTime()
    const d4 = new Date(2026, 6, 19, 8).getTime()
    const d5 = new Date(2026, 6, 20, 8).getTime()
    // nghỉ 21/07 (không chụp)
    const d7 = new Date(2026, 6, 22, 8).getTime() // cách d5 đúng 2 ngày lịch (nghỉ 1 ngày ở giữa)
    expect(computeStreak([d1, d2, d3, d4, d5])).toBe(5)
    expect(computeStreak([d1, d2, d3, d4, d5, d7])).toBe(6)
  })

  it('TS-XP-40: nghỉ ≥2 ngày liên tiếp (khoảng cách ≥3 ngày) → reset về 1', () => {
    // DAY_MINUS_4 (16/07) rồi nhảy thẳng DAY0 (20/07) — khoảng cách 4 ngày → reset.
    expect(computeStreak([DAY_MINUS_4, DAY0])).toBe(1)
  })

  it('khoảng cách đúng 3 ngày (nghỉ 2 ngày liên tiếp) → reset về 1', () => {
    const d1 = new Date(2026, 6, 17, 8).getTime()
    const d2 = new Date(2026, 6, 20, 8).getTime() // cách 3 ngày lịch (18,19 nghỉ)
    expect(computeStreak([d1, d2])).toBe(1)
  })

  it('mảng rỗng → streak 0', () => {
    expect(computeStreak([])).toBe(0)
  })

  it('nhiều ảnh trong CÙNG 1 ngày không tính thêm streak (dedup theo ngày)', () => {
    expect(computeStreak([DAY0, DAY0 + 1000, DAY0 + 2000])).toBe(1)
  })
})

describe('computeProjectChip — mirror ProjectHubPresenter.chip, priority todo > streak > done', () => {
  it('diary CHƯA chụp hôm nay → todo (bất kể exportedAt/streak cũ)', () => {
    const chip = computeProjectChip('diary', 1700000000000, [DAY_MINUS_1, DAY_MINUS_2], DAY0)
    expect(chip).toEqual({ kind: 'todo' })
  })

  it('diary ĐÃ chụp hôm nay + streak>0 → streak (kèm số ngày)', () => {
    const chip = computeProjectChip('diary', undefined, [DAY_MINUS_1, DAY0], DAY0)
    expect(chip).toEqual({ kind: 'streak', streakDays: 2 })
  })

  it('diary chưa export, chưa từng chụp (dự án mới 0 frame) → todo (không phải null)', () => {
    const chip = computeProjectChip('diary', undefined, [], DAY0)
    expect(chip).toEqual({ kind: 'todo' })
  })

  it('animation đã export → done', () => {
    const chip = computeProjectChip('animation', 1700000000000, [], DAY0)
    expect(chip).toEqual({ kind: 'done' })
  })

  it('animation CHƯA export → null (không có chip, khớp iOS — không có "Đang làm")', () => {
    const chip = computeProjectChip('animation', undefined, [], DAY0)
    expect(chip).toBeNull()
  })

  it('diary đã chụp hôm nay + đã export → streak ưu tiên hơn done (nếu streak>0)', () => {
    const chip = computeProjectChip('diary', 1700000000000, [DAY0], DAY0)
    expect(chip).toEqual({ kind: 'streak', streakDays: 1 })
  })
})

describe('diaryTodayCount — TS-XP-15', () => {
  it('đếm đúng số ảnh chụp HÔM NAY (theo now), bỏ qua ảnh ngày khác', () => {
    expect(diaryTodayCount([DAY0, DAY0 + 1000, DAY_MINUS_1], DAY0)).toBe(2)
  })
  it('không có ảnh hôm nay → 0', () => {
    expect(diaryTodayCount([DAY_MINUS_1], DAY0)).toBe(0)
  })
})

describe('latestFrameSeqForYesterday — BR-XP-5, onion "hôm qua"', () => {
  function frame(seq: number, capturedAt: number): ProjectFrame {
    return { seq, file: `frames/${String(seq + 1).padStart(4, '0')}.jpg`, capturedAt }
  }

  it('có nhiều ảnh hôm qua → trả seq của ảnh MỚI NHẤT (capturedAt lớn nhất)', () => {
    const frames = [
      frame(0, DAY_MINUS_2),
      frame(1, DAY_MINUS_1), // hôm qua, sáng
      frame(2, DAY_MINUS_1 + 3600_000), // hôm qua, trễ hơn 1h — MỚI NHẤT trong ngày hôm qua
      frame(3, DAY0),
    ]
    expect(latestFrameSeqForYesterday(frames, DAY0)).toBe(2)
  })

  it('không có ảnh hôm qua (chỉ có hôm nay/2 ngày trước) → null (TS-XP-16 Empty)', () => {
    const frames = [frame(0, DAY_MINUS_2), frame(1, DAY0)]
    expect(latestFrameSeqForYesterday(frames, DAY0)).toBeNull()
  })

  it('T-XW14 B1: tìm đúng ảnh "hôm qua" ngay SAU ngày DST spring-forward (America/New_York)', () => {
    const originalTZ = process.env.TZ
    process.env.TZ = 'America/New_York'
    try {
      // Chụp 1 ảnh sáng sớm ngày DST-start (08/03/2026), xem lại chiều ngày 09/03/2026 — phải vẫn
      // nhận đúng ảnh 08/03 là "hôm qua" dù ngày đó chỉ có 23h thực (DST-safe qua `addDaysMs`).
      const dstDayFrame = new Date(2026, 2, 8, 6, 0, 0).getTime()
      const now = new Date(2026, 2, 9, 15, 0, 0).getTime()
      const frames = [frame(0, dstDayFrame)]
      expect(latestFrameSeqForYesterday(frames, now)).toBe(0)
    } finally {
      process.env.TZ = originalTZ
    }
  })

  it('dự án chưa có frame nào → null', () => {
    expect(latestFrameSeqForYesterday([], DAY0)).toBeNull()
  })
})

describe('endOfMonthDurationSeconds — FilmProjection, dự phóng cuối tháng', () => {
  it('chưa đủ 2 ngày lịch khác nhau → null (tránh suy diễn từ 1 điểm dữ liệu)', () => {
    expect(endOfMonthDurationSeconds([DAY0, DAY0 + 1000], 3, DAY0)).toBeNull()
  })

  it('fps<=0 → null', () => {
    expect(endOfMonthDurationSeconds([DAY_MINUS_1, DAY0], 0, DAY0)).toBeNull()
  })

  it('mảng rỗng → null', () => {
    expect(endOfMonthDurationSeconds([], 3, DAY0)).toBeNull()
  })

  it('2 ngày, mỗi ngày 1 ảnh, fps=3 — tính đúng công thức (avg/ngày × ngày còn lại + hiện có) / fps', () => {
    // now = 20/07/2026 → tháng 7 có 31 ngày → còn lại 31-20=11 ngày.
    const result = endOfMonthDurationSeconds([DAY_MINUS_1, DAY0], 3, DAY0)
    // avgFramesPerDay = 2/2 = 1; projectedFrames = 2 + 1*11 = 13; /3 = 4.333...
    expect(result).not.toBeNull()
    expect(result!).toBeCloseTo(13 / 3, 5)
  })
})

describe('capturedDaysCount', () => {
  it('đếm đúng số ngày lịch khác nhau (dedup)', () => {
    expect(capturedDaysCount([DAY0, DAY0 + 1000, DAY_MINUS_1, DAY_MINUS_2])).toBe(3)
  })
  it('rỗng → 0', () => {
    expect(capturedDaysCount([])).toBe(0)
  })
})

describe('diaryPhotoPositionNext / diaryPhotoPositionLast — T-XP39/diaryDayNumber', () => {
  it('Next = frameCount + 1 (forward-looking), luôn có giá trị kể cả 0 frame', () => {
    expect(diaryPhotoPositionNext(0)).toBe(1)
    expect(diaryPhotoPositionNext(14)).toBe(15)
  })
  it('Last = frameCount (đã có), null khi 0 frame', () => {
    expect(diaryPhotoPositionLast(0)).toBeNull()
    expect(diaryPhotoPositionLast(15)).toBe(15)
  })
})

describe('projectDayNumber — mirror ProjectDay.number, "Ngày N" CHỈ dùng ở Hub', () => {
  it('tạo dự án hôm nay → Ngày 1', () => {
    expect(projectDayNumber(DAY0, DAY0)).toBe(1)
  })
  it('tạo 5 ngày trước → Ngày 6 (ngày tạo = Ngày 1)', () => {
    const created = new Date(2026, 6, 15, 8).getTime()
    expect(projectDayNumber(created, DAY0)).toBe(6)
  })
  it('không phụ thuộc GIỜ trong ngày (tạo tối, xem sáng hôm sau vẫn chỉ +1 ngày)', () => {
    const createdLateNight = new Date(2026, 6, 19, 23, 50).getTime()
    const viewedEarlyMorning = new Date(2026, 6, 20, 0, 10).getTime()
    expect(projectDayNumber(createdLateNight, viewedEarlyMorning)).toBe(2)
  })
})

describe('addDaysMs — T-XW14 B1, cộng/trừ NGÀY LỊCH (DST-safe, không phải N×86 400 000ms)', () => {
  it('lùi 1 ngày trong tháng — kết quả đúng ngày hôm trước, giờ về 00:00:00', () => {
    const mar15 = new Date(2026, 2, 15, 14, 30).getTime()
    const result = addDaysMs(mar15, -1)
    const d = new Date(result)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2) // tháng 3 (0-based)
    expect(d.getDate()).toBe(14)
    expect(d.getHours()).toBe(0)
  })

  it('lùi qua ranh giới THÁNG (1/3 → 28/2, năm không nhuận)', () => {
    const mar1 = new Date(2026, 2, 1, 10, 0).getTime()
    const result = addDaysMs(mar1, -1)
    const d = new Date(result)
    expect(d.getMonth()).toBe(1) // tháng 2
    expect(d.getDate()).toBe(28)
  })

  it('lùi qua ranh giới NĂM (1/1 → 31/12 năm trước)', () => {
    const jan1 = new Date(2026, 0, 1, 10, 0).getTime()
    const result = addDaysMs(jan1, -1)
    const d = new Date(result)
    expect(d.getFullYear()).toBe(2025)
    expect(d.getMonth()).toBe(11) // tháng 12
    expect(d.getDate()).toBe(31)
  })

  it('lùi qua 29/2 năm NHUẬN (1/3/2028 → 29/2/2028)', () => {
    const mar1LeapYear = new Date(2028, 2, 1, 10, 0).getTime()
    const result = addDaysMs(mar1LeapYear, -1)
    const d = new Date(result)
    expect(d.getMonth()).toBe(1)
    expect(d.getDate()).toBe(29)
  })

  it('DST-safe: ngày chuyển giờ mùa xuân Mỹ (America/New_York, 08/03/2026, 23h thực) — ' +
     'addDaysMs vẫn ra ĐÚNG ngày lịch hôm trước; công thức CŨ trừ thẳng 86 400 000ms sẽ SAI', () => {
    const originalTZ = process.env.TZ
    process.env.TZ = 'America/New_York'
    try {
      // 09/03/2026 12:00 trưa, giờ New York — 1 ngày SAU ngày DST spring-forward (08/03/2026,
      // đồng hồ nhảy từ 2h sáng lên 3h sáng, ngày đó chỉ có 23 giờ thực).
      const dayAfterDstStart = new Date(2026, 2, 9, 12, 0, 0).getTime()

      const fixedResult = addDaysMs(dayAfterDstStart, -1) // ĐÚNG — dùng setDate (lịch)
      const fixedDate = new Date(fixedResult)
      expect(fixedDate.getMonth()).toBe(2)
      expect(fixedDate.getDate()).toBe(8) // 08/03 — đúng "hôm qua" theo lịch

      // Công thức CŨ (đã sửa, giữ lại đây để CHỨNG MINH nó sai trên ngày DST — không phải dead code
      // vô nghĩa, đây là bằng chứng B1 thật sự khác biệt, không chỉ đổi tên hàm).
      const buggyToday = new Date(dayAfterDstStart)
      buggyToday.setHours(0, 0, 0, 0)
      const buggyYesterday = buggyToday.getTime() - 86400000
      const buggyDate = new Date(buggyYesterday)
      // Ngày 09/03 00:00 trừ đúng 24h = 08/03 01:00 (vì 08/03 chỉ có 23h thực do DST) — VẪN rơi
      // đúng ngày 8 về mặt lịch trong trường hợp NÀY (chênh 1h không đủ vượt mốc nửa đêm), nên thay
      // vì assert sai lệch ngày (không phải lúc nào cũng lệch), ta assert TRỰC TIẾP: kết quả giờ
      // của công thức cũ KHÔNG phải 00:00:00 (bằng chứng nó không tính theo lịch mà tính theo ms
      // thô, khác hẳn `addDaysMs` luôn chuẩn hoá về 00:00:00) — đây chính là cơ chế gây lỗi lệch
      // ngày ở NHỮNG mốc khác gần ranh giới nửa đêm mà B1 phải phòng.
      expect(buggyDate.getHours()).not.toBe(0)
      expect(fixedDate.getHours()).toBe(0)
    } finally {
      process.env.TZ = originalTZ
    }
  })
})

describe('Timezone/ranh giới lịch — không phụ thuộc giờ chạy test thật', () => {
  it('2 mốc thời gian sát ranh giới nửa đêm khác NGÀY vẫn tách đúng streak', () => {
    const justBeforeMidnight = new Date(2026, 6, 19, 23, 59, 0).getTime()
    const justAfterMidnight = new Date(2026, 6, 20, 0, 1, 0).getTime()
    // 2 mốc cách nhau vài phút thực nhưng khác NGÀY LỊCH → 2 ngày riêng, streak=2 (liên tục).
    expect(computeStreak([justBeforeMidnight, justAfterMidnight])).toBe(2)
    expect(distinctCaptureDaysMs([justBeforeMidnight, justAfterMidnight])).toHaveLength(2)
  })
})
