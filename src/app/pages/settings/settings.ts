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

  toggleSyncPredictions(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.gcalService.setSyncPredictions(checked);
  }

}
