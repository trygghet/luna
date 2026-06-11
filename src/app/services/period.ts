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
  private readonly storageKey = 'luna_period_logs';
  private logs: DailyLog[];

  /**
   * mockData 供應初始每日紀錄
   */
  private defaultLogs: DailyLog[] = [
    { date: '2026-05-01', flow: '多', note: '經期第一天' },
    { date: '2026-05-02', flow: '正常', note: '持續中' },
    { date: '2026-05-03', flow: '少', note: '結束前一天' },
  ];

  constructor() {
    this.logs = this.loadLogsFromStorage() ?? [...this.defaultLogs];
    this.persistLogs();
  }

  /**
   * 取得特定日期的紀錄
   * @param date YYYY-MM-DD
   */
  getDailyLog(date: string): DailyLog | undefined {
    return this.logs.find((log) => log.date === date);
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

    const index = this.logs.findIndex((item) => item.date === log.date);
    if (log.flow === '無') {
      if (index >= 0) {
        this.logs.splice(index, 1);
      }
    } else if (index >= 0) {
      this.logs[index] = { ...log };
    } else {
      this.logs.push({ ...log });
    }

    this.persistLogs();

    // 同步到 Google 日曆
    this.gcalService.syncLog(log).then(() => {
      const nextPredict = this.predictNextPeriod();
      this.gcalService.syncPrediction(nextPredict);
    });
  }

  /**
   * 刪除特定日期的紀錄
   */
  deleteDailyLog(date: string): void {
    if (!this.isValidDate(date)) {
      console.error('日期格式不正確，應為 YYYY-MM-DD');
      return;
    }

    const index = this.logs.findIndex((item) => item.date === date);
    if (index < 0) {
      return;
    }

    this.logs.splice(index, 1);
    this.persistLogs();

    this.gcalService.syncLog({ date, flow: '無', note: '' }).then(() => {
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

    this.logs.forEach((item) => {
      if (item.date.startsWith(`${yearString}-${monthString}`)) {
        logs.set(item.date, item);
      }
    });

    return logs;
  }

  private loadLogsFromStorage(): DailyLog[] | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return null;
      }
      return parsed.filter(
        (item): item is DailyLog =>
          item && typeof item.date === 'string' && typeof item.flow === 'string' && typeof item.note === 'string'
      );
    } catch (error) {
      console.warn('讀取月經紀錄時，localStorage 資料格式錯誤，已重置。', error);
      return null;
    }
  }

  private persistLogs(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.logs));
    } catch (error) {
      console.error('儲存月經紀錄到 localStorage 失敗', error);
    }
  }

  /**
   * 預測下次月經日期
   * 取最後一筆非「無」流量日期，往後推 28 天
   */
  predictNextPeriod(): string {
    const sortedLogs = [...this.logs]
      .filter((item) => item.flow !== '無')
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const lastLog = sortedLogs[sortedLogs.length - 1];
    const baseDate = lastLog ? new Date(lastLog.date) : new Date();
    baseDate.setDate(baseDate.getDate() + 28);

    return this.formatDate(baseDate);
  }

  /**
   * 匯入/合併從 Google 日曆取得的紀錄，並儲存至本機
   */
  importLogs(importedLogs: DailyLog[]): void {
    if (!Array.isArray(importedLogs)) return;

    importedLogs.forEach((imported) => {
      const index = this.logs.findIndex((local) => local.date === imported.date);
      if (index >= 0) {
        // 若本機已存在該日期的紀錄，直接以日曆為準覆蓋
        this.logs[index] = { ...imported };
      } else {
        this.logs.push({ ...imported });
      }
    });

    this.persistLogs();
  }

  /**
   * 取得所有紀錄（方便 Debug）
   */
  getAllLogs(): DailyLog[] {
    return [...this.logs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
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

