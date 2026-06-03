import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleCalendarService } from '../../services/google-calendar';
import { PeriodService } from '../../services/period';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  readonly gcalService = inject(GoogleCalendarService);
  private periodService = inject(PeriodService);

  isSaving = signal(false);
  syncStatusMessage = signal('');

  constructor() {}

  /**
   * 點擊連結 Google 帳號
   */
  async connectGoogle(): Promise<void> {
    try {
      this.isSaving.set(true);
      await this.gcalService.connect();
    } catch (e: any) {
      alert(`連結失敗: ${e.message || e}`);
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * 中斷連結 Google 帳號
   */
  disconnectGoogle(): void {
    if (confirm('確定要中斷 Google 日曆連結嗎？這不會刪除已同步的日曆，但會停止未來的自動同步。')) {
      this.gcalService.disconnect();
    }
  }

  /**
   * 切換流量紀錄同步開關
   */
  toggleSyncLogs(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.gcalService.setSyncLogs(checked);
  }

  /**
   * 切換預估經期同步開關
   */
  toggleSyncPredictions(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.gcalService.setSyncPredictions(checked);
  }

  /**
   * 一次性手動同步所有紀錄與預測
   */
  async syncAllHistory(): Promise<void> {
    if (!this.gcalService.isConnected()) {
      alert('請先連結 Google 帳號！');
      return;
    }

    try {
      this.isSaving.set(true);
      this.syncStatusMessage.set('同步中，請稍候...');
      
      const allLogs = this.periodService.getAllLogs();
      const nextPredict = this.periodService.predictNextPeriod();
      
      await this.gcalService.syncAllHistory(allLogs, nextPredict);
      
      this.syncStatusMessage.set('✓ 同步成功！所有歷史紀錄與預估經期已同步至 Google 日曆中。');
      alert('✓ 同步完成！');
    } catch (e: any) {
      this.syncStatusMessage.set(`❌ 同步失敗: ${e.message || e}`);
      alert(`同步發生錯誤: ${e.message || e}`);
    } finally {
      this.isSaving.set(false);
    }
  }
}
