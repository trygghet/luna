import { Injectable, inject } from '@angular/core';
import { GoogleCalendarService } from './google-calendar';

/**
 * 每日流量紀錄介面
 */
export interface DailyLog {
  date: string;
  flow: '無' | '少' | '正常' | '多';
  note: string;
}

/**
 * 月經追蹤服務
 */
@Injectable({
  providedIn: 'root',
})
export class PeriodService {
  private gcalService = inject(GoogleCalendarService);

  /**
   * mockData 供應初始每日紀錄
   */
  private mockData: DailyLog[] = [
    { date: '2026-05-01', flow: '多', note: '經期第一天' },
    { date: '2026-05-02', flow: '正常', note: '持續中' },
    { date: '2026-05-03', flow: '少', note: '結束前一天' },
  ];

  constructor() {}

  /**
   * 取得特定日期的紀錄
   * @param date YYYY-MM-DD
   */
  getDailyLog(date: string): DailyLog | undefined {
    return this.mockData.find((log) => log.date === date);
  }

  /**
   * 儲存或更新特定日期的紀錄
   * @param log DailyLog
   */
  saveDailyLog(log: DailyLog): void {
    if (!this.isValidDate(log.date)) {
      console.error('日期格式不正確，應為 YYYY-MM-DD');
      return;
    }

    const index = this.mockData.findIndex((item) => item.date === log.date);
    if (index >= 0) {
      this.mockData[index] = { ...log };
    } else {
      this.mockData.push({ ...log });
    }

    // 同步到 Google 日曆
    this.gcalService.syncLog(log).then(() => {
      const nextPredict = this.predictNextPeriod();
      this.gcalService.syncPrediction(nextPredict);
    });
  }

  /**
   * 取得指定月份所有紀錄
   */
  getMonthlyLogs(year: number, month: number): Map<string, DailyLog> {
    const logs = new Map<string, DailyLog>();
    const monthString = String(month).padStart(2, '0');
    const yearString = String(year);

    this.mockData.forEach((item) => {
      if (item.date.startsWith(`${yearString}-${monthString}`)) {
        logs.set(item.date, item);
      }
    });

    return logs;
  }

  /**
   * 預測下次月經日期
   * 取最後一筆非「無」流量日期，往後推 28 天
   */
  predictNextPeriod(): string {
    const sortedLogs = [...this.mockData]
      .filter((item) => item.flow !== '無')
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const lastLog = sortedLogs[sortedLogs.length - 1];
    const baseDate = lastLog ? new Date(lastLog.date) : new Date();
    baseDate.setDate(baseDate.getDate() + 28);

    return this.formatDate(baseDate);
  }

  /**
   * 取得所有紀錄（方便 Debug）
   */
  getAllLogs(): DailyLog[] {
    return [...this.mockData].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
      return false;
    }
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

