import { Component, inject, signal, OnInit } from '@angular/core';
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
export class Settings implements OnInit {
  readonly gcalService = inject(GoogleCalendarService);
  private periodService = inject(PeriodService);

  isSaving = signal(false);
  syncStatusMessage = signal('');
  managementStatusMessage = signal('');

  constructor() {}

  ngOnInit(): void {
    if (this.gcalService.isConnected()) {
      // 已連線時，GoogleCalendarService 會自動尋找或建立 LunaFlow 專屬日曆
    }
  }

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

  /**
   * 一次性手動從 Google 日曆匯入/還原所有歷史紀錄
   */
  async importAllHistory(): Promise<void> {
    if (!this.gcalService.isConnected()) {
      alert('請先連結 Google 帳號！');
      return;
    }

    if (!confirm('此操作會將 Google 日曆上的經期行程與本機合併。若日期重複，將以 Google 日曆上的資料為準，確定要匯入嗎？')) {
      return;
    }

    try {
      this.isSaving.set(true);
      this.syncStatusMessage.set('正在從日曆匯入歷史資料，請稍候...');

      const importedLogs = await this.gcalService.importFromCalendar();
      this.periodService.importLogs(importedLogs);

      this.syncStatusMessage.set(`✓ 匯入成功！已從 Google 日曆成功匯入 ${importedLogs.length} 筆經期紀錄。`);
      alert(`✓ 匯入成功！共匯入 ${importedLogs.length} 筆經期紀錄。`);
    } catch (e: any) {
      this.syncStatusMessage.set(`❌ 匯入失敗: ${e.message || e}`);
      alert(`匯入發生錯誤: ${e.message || e}`);
    } finally {
      this.isSaving.set(false);
    }
  }

  async createLunaFlowCalendar(): Promise<void> {
    try {
      this.isSaving.set(true);
      this.managementStatusMessage.set('建立日曆中...');
      await this.gcalService.createLunaFlowCalendar();
      this.managementStatusMessage.set('✓ 已建立 LunaFlow 專屬日曆。');
    } catch (e: any) {
      this.managementStatusMessage.set(`建立失敗: ${e.message || e}`);
    } finally {
      this.isSaving.set(false);
    }
  }

}
