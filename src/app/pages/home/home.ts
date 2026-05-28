import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PeriodService } from '../../services/period';

/**
 * 首頁組件
 * 顯示預估下一次月經開始日期
 */
@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  /** 預估下一次月經開始日期 */
  nextPeriodDate: string = '';

  constructor(private periodService: PeriodService) {}

  /**
   * 組件初始化時獲取預估日期
   */
  ngOnInit(): void {
    this.nextPeriodDate = this.periodService.predictNextPeriod();
  }
}
