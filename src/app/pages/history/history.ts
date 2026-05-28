import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PeriodService, DailyLog } from '../../services/period';

/**
 * 歷史紀錄（日曆）組件
 * 責任：顯示月經日曆、允許使用者點擊日期編輯每日流量紀錄
 */
@Component({
  selector: 'app-history',
  imports: [CommonModule, FormsModule],
  templateUrl: './history.html',
  styleUrls: ['./history.scss'],
})
export class History implements OnInit {
  /** 當前顯示的年份 */
  currentYear: number = new Date().getFullYear();

  /** 當前顯示的月份 (1-12) */
  currentMonth: number = new Date().getMonth() + 1;

  /** 當月的日期陣列（包含前月、當月、後月的日期以填滿日曆網格） */
  calendarDays: (number | null)[] = [];

  /** 本月份的所有紀錄 (日期 -> DailyLog) */
  monthlyLogs: Map<string, DailyLog> = new Map();

  /** 預估的下一次月經開始日期 */
  nextPeriodDate: string = '';

  /** 當前選中的日期 (YYYY-MM-DD) */
  selectedDate: string | null = null;

  /** 當前選中日期的紀錄（用於表單） */
  selectedDayLog: DailyLog = {
    date: '',
    flow: '無',
    note: '',
  };

  /** 流量選項 */
  flowOptions = [
    { value: '無', label: '無' },
    { value: '少', label: '少' },
    { value: '正常', label: '正常' },
    { value: '多', label: '多' },
  ];

  constructor(private periodService: PeriodService) {}

  /**
   * 組件初始化
   */
  ngOnInit(): void {
    this.loadCalendar();
    this.nextPeriodDate = this.periodService.predictNextPeriod();
  }

  /**
   * 加載日曆和本月紀錄
   */
  loadCalendar(): void {
    // 從 Service 取得本月所有紀錄
    this.monthlyLogs = this.periodService.getMonthlyLogs(
      this.currentYear,
      this.currentMonth
    );

    // 生成日曆網格
    this.generateCalendarDays();
  }

  /**
   * 生成當月的日曆網格
   * 包含前月、當月、後月的日期以填滿 6 週 × 7 天的網格
   */
  generateCalendarDays(): void {
    this.calendarDays = [];

    // 該月的第 1 天
    const firstDay = new Date(this.currentYear, this.currentMonth - 1, 1);
    // 該月的最後一天
    const lastDay = new Date(this.currentYear, this.currentMonth, 0);

    // 該月第 1 天是星期幾 (0=日, 1=一, ..., 6=六)
    const startingDayOfWeek = firstDay.getDay();

    // 前月應該顯示的天數
    const prevMonthLastDay = new Date(this.currentYear, this.currentMonth - 1, 0);
    const prevMonthDaysToShow = startingDayOfWeek;

    // 先加入前月的日期
    for (let i = prevMonthDaysToShow - 1; i >= 0; i--) {
      this.calendarDays.push(
        prevMonthLastDay.getDate() - i
      );
    }

    // 加入當月的日期
    for (let i = 1; i <= lastDay.getDate(); i++) {
      this.calendarDays.push(i);
    }

    // 加入後月的日期以填滿 42 格 (6 週)
    const remainingDays = 42 - this.calendarDays.length;
    for (let i = 1; i <= remainingDays; i++) {
      this.calendarDays.push(i);
    }
  }

  /**
   * 上一個月
   */
  previousMonth(): void {
    if (this.currentMonth === 1) {
      this.currentMonth = 12;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.selectedDate = null;
    this.selectedDayLog = { date: '', flow: '無', note: '' };
    this.loadCalendar();
  }

  /**
   * 下一個月
   */
  nextMonth(): void {
    if (this.currentMonth === 12) {
      this.currentMonth = 1;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.selectedDate = null;
    this.selectedDayLog = { date: '', flow: '無', note: '' };
    this.loadCalendar();
  }

  /**
   * 點擊日曆上的日期
   * @param day - 日期 (1-31)
   * @param isCurrentMonth - 是否為當月
   */
  selectDay(day: number, isCurrentMonth: boolean): void {
    // 如果點擊的不是當月的日期，忽略
    if (!isCurrentMonth) {
      return;
    }

    // 構建完整日期字串 (YYYY-MM-DD)
    const monthStr = String(this.currentMonth).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    this.selectedDate = `${this.currentYear}-${monthStr}-${dayStr}`;

    // 從 Service 取得該日的紀錄（若無則使用預設值）
    const existingLog = this.periodService.getDailyLog(this.selectedDate);
    if (existingLog) {
      this.selectedDayLog = { ...existingLog };
    } else {
      this.selectedDayLog = {
        date: this.selectedDate,
        flow: '無',
        note: '',
      };
    }
  }

  /**
   * 判斷某個日期是否在當前月份
   * @param index - 日曆陣列中的索引
   * @returns boolean
   */
  isCurrentMonth(index: number): boolean {
    const firstDay = new Date(this.currentYear, this.currentMonth - 1, 1);
    const startingDayOfWeek = firstDay.getDay();
    const lastDay = new Date(this.currentYear, this.currentMonth, 0);

    // 計算當月日期的起始索引
    const currentMonthStart = startingDayOfWeek;
    const currentMonthEnd = currentMonthStart + lastDay.getDate() - 1;

    return index >= currentMonthStart && index <= currentMonthEnd;
  }

  /**
   * 判斷某個日期是否有流量紀錄
   * @param day - 日期
   * @returns boolean
   */
  hasPeriodFlow(day: number): boolean {
    const monthStr = String(this.currentMonth).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${this.currentYear}-${monthStr}-${dayStr}`;
    const log = this.monthlyLogs.get(dateStr);
    return !!log && log.flow !== '無';
  }

  /**
   * 取得日期的流量等級 (用於 CSS 類別)
   * @param day - 日期
   * @returns string
   */
  getFlowLevel(day: number): string {
    const monthStr = String(this.currentMonth).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${this.currentYear}-${monthStr}-${dayStr}`;
    const log = this.monthlyLogs.get(dateStr);

    if (!log) return '';

    const flowMap: { [key: string]: string } = {
      無: '',
      少: 'flow-light',
      正常: 'flow-medium',
      多: 'flow-heavy',
    };

    return flowMap[log.flow] || '';
  }

  /**
   * 判斷某個日期是否為預估的下一次月經日
   * @param day - 日期
   * @returns boolean
   */
  isNextPeriodDay(day: number): boolean {
    const monthStr = String(this.currentMonth).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${this.currentYear}-${monthStr}-${dayStr}`;
    return dateStr === this.nextPeriodDate;
  }

  /**
   * 判斷某個日期是否為當前選中的日期
   * @param day - 日期
   * @returns boolean
   */
  isSelectedDay(day: number): boolean {
    if (!this.selectedDate) return false;

    const monthStr = String(this.currentMonth).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${this.currentYear}-${monthStr}-${dayStr}`;

    return dateStr === this.selectedDate;
  }

  /**
   * 儲存當前選中日期的紀錄
   */
  saveDailyLog(): void {
    if (!this.selectedDate) {
      alert('請先選擇日期');
      return;
    }

    // 更新 selectedDayLog 的日期欄位
    this.selectedDayLog.date = this.selectedDate;

    // 調用 Service 儲存紀錄
    this.periodService.saveDailyLog(this.selectedDayLog);

    // 重新加載日曆以更新顯示
    this.loadCalendar();
    this.nextPeriodDate = this.periodService.predictNextPeriod();

    // 用戶反饋
    alert('✓ 紀錄已儲存！');
  }

  /**
   * 清空當前選中的日期和表單
   */
  clearSelection(): void {
    this.selectedDate = null;
    this.selectedDayLog = {
      date: '',
      flow: '無',
      note: '',
    };
  }

  /**
   * 取得月份和年份的顯示文本
   * @returns string
   */
  getMonthYearDisplay(): string {
    const monthNames = [
      '一月',
      '二月',
      '三月',
      '四月',
      '五月',
      '六月',
      '七月',
      '八月',
      '九月',
      '十月',
      '十一月',
      '十二月',
    ];
    return `${this.currentYear} 年 ${monthNames[this.currentMonth - 1]}`;
  }
}
