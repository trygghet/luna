import { Injectable, signal, computed } from '@angular/core';
import { DailyLog } from './period';

declare const google: any;

@Injectable({
  providedIn: 'root',
})
export class GoogleCalendarService {
  // 狀態訊號 (Signals)
  // 開發者申請的 Google OAuth 用戶端 ID
  readonly clientId = signal<string>('1043320944909-4o23ljp511sl168c7e736m6cddko446f.apps.googleusercontent.com');
  readonly accessToken = signal<string>(localStorage.getItem('luna_gcal_access_token') || '');
  readonly tokenExpiresAt = signal<number>(Number(localStorage.getItem('luna_gcal_token_expires') || '0'));
  readonly isConnected = computed(() => {
    const token = this.accessToken();
    const expires = this.tokenExpiresAt();
    return !!token && expires > Date.now();
  });

  // 設定開關
  readonly syncLogsEnabled = signal<boolean>(localStorage.getItem('luna_sync_logs') !== 'false');
  readonly syncPredictionsEnabled = signal<boolean>(localStorage.getItem('luna_sync_predictions') !== 'false');
  readonly calendarId = signal<string>(localStorage.getItem('luna_gcal_calendar_id') || '');

  private gisLoaded = false;
  private tokenClient: any = null;

  constructor() {
    this.loadGisScript();
  }

  /**
   * 切換同步紀錄設定
   */
  setSyncLogs(enabled: boolean): void {
    this.syncLogsEnabled.set(enabled);
    localStorage.setItem('luna_sync_logs', String(enabled));
  }

  /**
   * 切換同步預測設定
   */
  setSyncPredictions(enabled: boolean): void {
    this.syncPredictionsEnabled.set(enabled);
    localStorage.setItem('luna_sync_predictions', String(enabled));
  }

  /**
   * 動態載入 Google Identity Services SDK
   */
  private loadGisScript(): Promise<void> {
    return new Promise((resolve) => {
      if (this.gisLoaded || typeof google !== 'undefined') {
        this.gisLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.gisLoaded = true;
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  /**
   * 初始化 Token Client
   */
  private async initTokenClient(): Promise<void> {
    await this.loadGisScript();
    
    if (!this.clientId()) {
      throw new Error('未設定 Google Client ID');
    }

    if (this.tokenClient) {
      return;
    }

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.clientId(),
      scope: [
        'https://www.googleapis.com/auth/calendar.app.created',
        'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
      ].join(' '),
      callback: (response: any) => {
        if (response.error) {
          console.error('OAuth 錯誤:', response.error);
          return;
        }
        
        // 儲存憑證資訊
        const expiresAt = Date.now() + response.expires_in * 1000;
        this.accessToken.set(response.access_token);
        this.tokenExpiresAt.set(expiresAt);
        localStorage.setItem('luna_gcal_access_token', response.access_token);
        localStorage.setItem('luna_gcal_token_expires', String(expiresAt));

        // 登入成功後，自動檢查/建立專屬日曆
        this.ensureLunaCalendar().then(() => {
          console.log('專屬日曆已備妥，ID為:', this.calendarId());
        });
      },
    });
  }

  /**
   * 連結 Google 帳號 (登入)
   */
  async connect(): Promise<void> {
    await this.initTokenClient();
    this.tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  /**
   * 中斷連結 (登出)
   */
  disconnect(): void {
    if (this.accessToken()) {
      google.accounts.oauth2.revoke(this.accessToken(), () => {
        console.log('Access token 已撤銷');
      });
    }
    
    this.accessToken.set('');
    this.tokenExpiresAt.set(0);
    this.calendarId.set('');
    localStorage.removeItem('luna_gcal_access_token');
    localStorage.removeItem('luna_gcal_token_expires');
    localStorage.removeItem('luna_gcal_calendar_id');
  }

  /**
   * 確保「LunaFlow 經期追蹤」專屬日曆存在，若無則創建
   */
  async ensureLunaCalendar(): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Google 帳號未連結或憑證已過期');
    }

    let calId = this.calendarId();
    if (calId) {
      try {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}`, {
          headers: { Authorization: `Bearer ${this.accessToken()}` },
        });
        if (res.ok) {
          return calId;
        }
      } catch (e) {
        console.warn('驗證現有日曆失敗，將重試搜尋或建立：', e);
      }

      // 若目前選中的日曆無效，清空儲存值
      this.calendarId.set('');
      localStorage.removeItem('luna_gcal_calendar_id');
      calId = '';
    }

    try {
      const listRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${this.accessToken()}` },
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        const existingCal = listData.items?.find(
          (item: any) => this.isLunaFlowCalendar(item)
        );
        if (existingCal) {
          this.setCalendarId(existingCal.id);
          return existingCal.id;
        }
      }
    } catch (e) {
      console.error('搜尋現有日曆清單時發生錯誤:', e);
    }

    console.log('未找到專屬日曆，正在建立新的...');
    return this.createLunaFlowCalendar();
  }

  /**
   * 取得使用者可讀取的所有日曆清單
   */
  async listCalendars(): Promise<any[]> {
    if (!this.isConnected()) {
      throw new Error('Google 帳號未連結或憑證已過期');
    }

    const calendars: any[] = [];
    let pageToken = '';

    do {
      const url = `https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250${
        pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
      }`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken()}` },
      });

      if (!res.ok) {
        throw new Error('取得日曆清單失敗');
      }

      const data = await res.json();
      if (Array.isArray(data.items)) {
        calendars.push(...data.items);
      }
      pageToken = data.nextPageToken || '';
    } while (pageToken);

    return calendars;
  }

  /**
   * 設定目前要使用的日曆 ID
   */
  setCalendarId(calendarId: string): void {
    this.calendarId.set(calendarId);
    localStorage.setItem('luna_gcal_calendar_id', calendarId);
  }

  /**
   * 刪除指定日曆
   */
  async deleteCalendar(calendarId: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Google 帳號未連結或憑證已過期');
    }

    const deleteRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.accessToken()}` },
      }
    );

    if (!deleteRes.ok) {
      const errorText = await deleteRes.text();
      throw new Error(`刪除日曆失敗: ${errorText}`);
    }

    if (calendarId === this.calendarId()) {
      this.calendarId.set('');
      localStorage.removeItem('luna_gcal_calendar_id');
    }
  }

  /**
   * 建立一個 LunaFlow 專屬日曆
   */
  async createLunaFlowCalendar(): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Google 帳號未連結或憑證已過期');
    }

    const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: 'LunaFlow 經期追蹤',
        description: '此日曆由 LunaFlow 應用程式建立，用於同步經期紀錄與預測結果。',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`無法建立日曆: ${errText}`);
    }

    const newCal = await createRes.json();
    this.setCalendarId(newCal.id);
    return newCal.id;
  }

  /**
   * 判斷是否為本應用建立的 LunaFlow 日曆
   */
  private isLunaFlowCalendar(item: any): boolean {
    if (!item || typeof item.summary !== 'string') {
      return false;
    }
    return item.summary.includes('LunaFlow') || item.description?.includes?.('LunaFlow');
  }

  /**
   * 同步單筆經期紀錄到日曆
   */
  async syncLog(log: DailyLog): Promise<void> {
    if (!this.isConnected() || !this.syncLogsEnabled()) {
      return;
    }

    const calId = await this.ensureLunaCalendar();

    // 1. 先尋找該日期是否已有同步過的事件
    // 我們使用 extendedProperties 或查詢該天時間段來精準定位
    const startOfDay = `${log.date}T00:00:00Z`;
    const endOfDay = `${log.date}T23:59:59Z`;

    try {
      const searchRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?timeMin=${startOfDay}&timeMax=${endOfDay}`,
        { headers: { Authorization: `Bearer ${this.accessToken()}` } }
      );
      
      if (!searchRes.ok) throw new Error('搜尋日曆行程失敗');
      
      const searchData = await searchRes.json();
      // 尋找具有 lunaflow_log 屬性或標題符合的事件
      const existingEvent = searchData.items?.find((item: any) => 
        (item.extendedProperties?.private?.type === 'log') || 
        (item.summary && item.summary.startsWith('🩸 LunaFlow'))
      );

      // 若流量為「無」，且日曆上有對應事件，則刪除日曆行程
      if (log.flow === '無') {
        if (existingEvent) {
          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${existingEvent.id}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${this.accessToken()}` },
            }
          );
          console.log(`已從日曆刪除該日行程: ${log.date}`);
        }
        return;
      }

      // 準備行程的 JSON payload
      const eventBody = {
        summary: `🩸 LunaFlow (流量: ${log.flow})`,
        description: log.note || '無備忘紀錄',
        start: { date: log.date },
        end: { date: log.date }, // 整天活動
        colorId: this.getColorIdForFlow(log.flow),
        extendedProperties: {
          private: {
            type: 'log',
            flow: log.flow,
            date: log.date,
          },
        },
      };

      if (existingEvent) {
        // 更新現有行程
        const updateRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${existingEvent.id}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${this.accessToken()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventBody),
          }
        );
        if (updateRes.ok) console.log(`已成功更新日曆行程: ${log.date}`);
      } else {
        // 建立新行程
        const createRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.accessToken()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventBody),
          }
        );
        if (createRes.ok) console.log(`已成功新增日曆行程: ${log.date}`);
      }
    } catch (e) {
      console.error(`同步紀錄時發生錯誤 (${log.date}):`, e);
    }
  }

  /**
   * 同步預測的下次經期日到日曆
   */
  async syncPrediction(predictedDate: string): Promise<void> {
    if (!this.isConnected() || !this.syncPredictionsEnabled()) {
      return;
    }

    const calId = await this.ensureLunaCalendar();

    try {
      // 1. 尋找日曆中現有的「預測經期」行程
      const listRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
        { headers: { Authorization: `Bearer ${this.accessToken()}` } }
      );
      if (!listRes.ok) throw new Error('取得行程清單失敗');

      const listData = await listRes.json();
      const existingPredictions = listData.items?.filter((item: any) => 
        item.extendedProperties?.private?.type === 'prediction' || 
        (item.summary && item.summary.includes('預估經期'))
      );

      // 若沒有預測日期（空字串），刪除日曆上所有預測行程
      if (!predictedDate) {
        if (existingPredictions) {
          for (const ev of existingPredictions) {
            await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${ev.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${this.accessToken()}` },
            });
          }
        }
        return;
      }

      // 準備預測行程的資料 (整天行程)
      const eventBody = {
        summary: `🌸 LunaFlow 預估經期`,
        description: '基於 LunaFlow 月經週期紀錄所算出的下次預估開始日。',
        start: { date: predictedDate },
        end: { date: predictedDate },
        colorId: '4', // 綠色/粉黃/淡粉
        extendedProperties: {
          private: {
            type: 'prediction',
            date: predictedDate,
          },
        },
      };

      // 如果有現成的預測行程，我們直接更新第一個，並把多餘的預測行程刪除
      if (existingPredictions && existingPredictions.length > 0) {
        const mainPredict = existingPredictions[0];
        
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${mainPredict.id}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${this.accessToken()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventBody),
          }
        );

        // 刪除其餘多餘的預測行程
        for (let i = 1; i < existingPredictions.length; i++) {
          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${existingPredictions[i].id}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${this.accessToken()}` },
            }
          );
        }
        console.log(`已成功更新預估經期行程: ${predictedDate}`);
      } else {
        // 新建預測行程
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventBody),
        });
        console.log(`已成功新增預估經期行程: ${predictedDate}`);
      }
    } catch (e) {
      console.error('同步預估日期時發生錯誤:', e);
    }
  }

  /**
   * 同步所有歷史紀錄 (一次性匯出)
   */
  async syncAllHistory(logs: DailyLog[], predictedDate: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Google 帳號未連結');
    }

    // 1. 同步所有流量大於無的紀錄
    for (const log of logs) {
      await this.syncLog(log);
    }

    // 2. 同步預測行程
    if (predictedDate) {
      await this.syncPrediction(predictedDate);
    }
  }

  /**
   * 取得使用者可讀取的所有日曆清單（支援分頁）
   */
  private async loadCalendarList(): Promise<any[]> {
    const calendars: any[] = [];
    let pageToken = '';

    do {
      const url = `https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250${
        pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
      }`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken()}` },
      });

      if (!res.ok) {
        throw new Error('取得日曆清單失敗');
      }

      const data = await res.json();
      if (Array.isArray(data.items)) {
        calendars.push(...data.items);
      }
      pageToken = data.nextPageToken || '';
    } while (pageToken);

    return calendars;
  }

  /**
   * 刪除所有可讀取到的 LunaFlow 日曆
   */
  async deleteAllLunaCalendars(): Promise<number> {
    if (!this.isConnected()) {
      throw new Error('Google 帳號未連結或憑證已過期');
    }

    const calendarList = await this.loadCalendarList();
    const targets = calendarList.filter((item) => this.isLunaFlowCalendar(item));
    let deletedCount = 0;

    for (const calendar of targets) {
      try {
        const deleteRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${this.accessToken()}` },
          }
        );

        if (deleteRes.ok) {
          deletedCount++;
          if (calendar.id === this.calendarId()) {
            this.calendarId.set('');
            localStorage.removeItem('luna_gcal_calendar_id');
          }
        }
      } catch (e) {
        console.error(`刪除日曆 ${calendar.id} 時發生錯誤：`, e);
      }
    }

    return deletedCount;
  }

  /**
   * 根據流量取得 Google 日曆內建顏色的 ID
   * 1: 薰衣草藍, 2: 鼠尾草綠, 3: 紫, 4: 紅/粉紅, 5: 黃, 6: 橘, 7: 淺藍, 8: 灰, 9: 藍, 10: 綠, 11: 磚紅
   */
  private getColorIdForFlow(flow: string): string {
    switch (flow) {
      case '少':
        return '2'; // 淺綠/粉綠
      case '正常':
        return '1'; // 薰衣草藍
      case '多':
        return '11'; // 磚紅 (重流量)
      default:
        return '8'; // 灰色
    }
  }
}
