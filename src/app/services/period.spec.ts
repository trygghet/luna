import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { PeriodService, DailyLog } from './period';
import { GoogleCalendarService } from './google-calendar';

describe('PeriodService', () => {
  let service: PeriodService;
  let googleCalendarStub: Partial<GoogleCalendarService>;

  beforeEach(() => {
    localStorage.clear();

    googleCalendarStub = {
      syncLog: vi.fn().mockResolvedValue(undefined),
      syncPrediction: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        PeriodService,
        { provide: GoogleCalendarService, useValue: googleCalendarStub },
      ],
    });

    service = TestBed.inject(PeriodService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default logs when localStorage is empty', () => {
    const logs = service.getAllLogs();

    expect(logs.length).toBe(3);
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-05-01', flow: '多' }),
      ])
    );
    expect(localStorage.getItem('luna_period_logs')).toBeTruthy();
  });

  it('should save a new daily log and persist it', async () => {
    const newLog: DailyLog = {
      date: '2026-06-10',
      flow: '正常',
      note: '新紀錄',
    };

    service.saveDailyLog(newLog);
    await Promise.resolve();

    const saved = service.getDailyLog(newLog.date);
    expect(saved).toEqual(newLog);

    const stored = JSON.parse(localStorage.getItem('luna_period_logs') || '[]');
    expect(stored).toEqual(expect.arrayContaining([expect.objectContaining(newLog)]));
    expect(googleCalendarStub.syncLog).toHaveBeenCalledWith(newLog);
  });

  it('should update an existing daily log and persist changes', async () => {
    const updatedLog: DailyLog = {
      date: '2026-05-02',
      flow: '多',
      note: '更新為多量',
    };

    service.saveDailyLog(updatedLog);
    await Promise.resolve();

    expect(service.getDailyLog(updatedLog.date)).toEqual(updatedLog);
    const stored = JSON.parse(localStorage.getItem('luna_period_logs') || '[]');
    expect(stored).toContainEqual(updatedLog);
  });

  it('should remove logs when flow is set to 無 and persist the removal', async () => {
    const removeLog: DailyLog = {
      date: '2026-05-03',
      flow: '無',
      note: '',
    };

    service.saveDailyLog(removeLog);
    await Promise.resolve();

    expect(service.getDailyLog(removeLog.date)).toBeUndefined();
    const stored = JSON.parse(localStorage.getItem('luna_period_logs') || '[]');
    expect(stored.find((item: any) => item.date === removeLog.date)).toBeUndefined();
  });

  it('should delete a specific daily log and persist removal', async () => {
    service.deleteDailyLog('2026-05-02');
    await Promise.resolve();

    expect(service.getDailyLog('2026-05-02')).toBeUndefined();
    const stored = JSON.parse(localStorage.getItem('luna_period_logs') || '[]');
    expect(stored.find((item: any) => item.date === '2026-05-02')).toBeUndefined();
    expect(googleCalendarStub.syncLog).toHaveBeenCalledWith({ date: '2026-05-02', flow: '無', note: '' });
  });

  it('should predict next period based on the latest non-empty log', () => {
    const nextDate = service.predictNextPeriod();

    expect(nextDate).toBe('2026-05-31');
  });
});
