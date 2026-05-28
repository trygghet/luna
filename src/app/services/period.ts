import { Injectable } from '@angular/core';

/**
 * 每日流量紀錄介面
 * @interface DailyLog
 * @property date - 日期 (YYYY-MM-DD 格式)
 * @property flow - 月經流量 ('無' | '少' | '正常' | '多')
 * @property note - 備註 (可選)
 */
export interface DailyLog {
  date: string;
  flow: '無' | '少' | '正常' | '多';
  note?: string;
}

/**
 * 月經追蹤服務
 * 責任：管理每日月經流量紀錄、查詢與預估下次月經期
 */
@Injectable({
  providedIn: 'root',
})
export class PeriodService {
  /**
   * 私有每日流量紀錄物件
   * 鍵：日期 (YYYY-MM-DD)，值：該日的流量紀錄
   */
  private dailyLogs: Map<string, DailyLog> = new Map([
    ['2026-04-01', { date: '2026-04-01', flow: '多', note: '月經開始' }],
    ['2026-04-02', { date: '2026-04-02', flow: '正常', note: '' }],
    ['2026-04-03', { date: '2026-04-03', flow: '正常', note: '' }],
    ['2026-04-04', { date: '2026-04-04', flow: '少', note: '' }],
    ['2026-04-05', { date: '2026-04-05', flow: '少', note: '月經結束' }],
    ['2026-04-29', { date: '2026-04-29', flow: '多', note: '第二次月經開始' }],
    ['2026-04-30', { date: '2026-04-30', flow: '正常', note: '' }],
    ['2026-05-01', { date: '2026-05-01', flow: '正常', note: '' }],
    ['2026-05-02', { date: '2026-05-02', flow: '少', note: '' }],
    ['2026-05-03', { date: '2026-05-03', flow: '少', note: '第二次月經結束' }],
    ['2026-05-27', { date: '2026-05-27', flow: '多', note: '第三次月經開始' }],
    ['2026-05-28', { date: '2026-05-28', flow: '正常', note: '今天' }],
  ]);

  constructor() {}

  /**
   * 取得特定日期的每日紀錄
   * @param date - 日期 (YYYY-MM-DD 格式)
   * @returns DailyLog | null - 該日期的紀錄，若無則返回 null
   */
  getDailyLog(date: string): DailyLog | null {
    return this.dailyLogs.get(date) || null;
  }

  /**
   * 儲存或更新特定日期的每日紀錄
   * 如果該日期已存在則覆蓋，不存在則新增
   * @param log - 要儲存的每日紀錄
   * @returns void
   */
  saveDailyLog(log: DailyLog): void {
    if (!this.isValidDate(log.date)) {
      console.error('日期格式不正確，應為 YYYY-MM-DD');
      return;
    }

    this.dailyLogs.set(log.date, log);
    console.log('✓ 每日紀錄已儲存', log);
  }

  /**
   * 取得特定月份的所有紀錄
   * @param year - 年份
   * @param month - 月份 (1-12)
   * @returns Map<string, DailyLog> - 該月份的所有紀錄
   */
  getMonthlyLogs(year: number, month: number): Map<string, DailyLog> {
    const monthLogs = new Map<string, DailyLog>();
    const monthStr = String(month).padStart(2, '0');
    const yearStr = String(year);

    // 遍歷所有紀錄，篩選出指定月份的紀錄
    this.dailyLogs.forEach((log, date) => {
      if (date.startsWith(`${yearStr}-${monthStr}`)) {
        monthLogs.set(date, log);
      }
    });

    return monthLogs;
  }

  /**
   * 預估下一次月經開始日期
   * 算法：找到最後一個有流量的日期（非「無」），往後推 28 天
   * 如果沒有紀錄，則回傳今日加 28 天
   * @returns string - 預估日期 (YYYY-MM-DD 格式)
   */
  predictNextPeriod(): string {
    let lastPeriodStart: Date | null = null;

    // 將所有紀錄按日期排序，找最後一個有流量的日期
    const sortedDates = Array.from(this.dailyLogs.keys()).sort().reverse();

    for (const date of sortedDates) {
      const log = this.dailyLogs.get(date);
      if (log && log.flow !== '無') {
        lastPeriodStart = new Date(date);
        break;
      }
    }

    let baseDate: Date;
    if (!lastPeriodStart) {
      // 如果沒找到任何有流量的紀錄，使用今日
      baseDate = new Date();
    } else {
      baseDate = lastPeriodStart;
    }

    // 加上 28 天
    baseDate.setDate(baseDate.getDate() + 28);

    return this.formatDate(baseDate);
  }

  /**
   * 取得所有紀錄（用於調試）
   * @returns DailyLog[] - 所有紀錄的陣列
   */
  getAllLogs(): DailyLog[] {
    return Array.from(this.dailyLogs.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  /**
   * 輔助函數：驗證日期格式是否為 YYYY-MM-DD
   * @param dateString - 日期字串
   * @returns boolean - 是否有效
   */
  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
      return false;
    }
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * 輔助函數：將 Date 物件格式化為 YYYY-MM-DD 字串
   * @param date - Date 物件
   * @returns string - 格式化後的日期字串
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
          ? current
          : latest;
      });
      baseDate = new Date(lastRecord.startDate);
    }

    // 加上 28 天
    baseDate.setDate(baseDate.getDate() + 28);

    // 返回 YYYY-MM-DD 格式
    return this.formatDate(baseDate);
  }

  /**
   * 輔助函式：驗證日期格式是否為 YYYY-MM-DD
   * @param dateString - 日期字串
   * @returns boolean - 是否有效
   */
  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
      return false;
    }
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * 輔助函式：將 Date 物件格式化為 YYYY-MM-DD 字串
   * @param date - Date 物件
   * @returns string - 格式化後的日期字串
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
