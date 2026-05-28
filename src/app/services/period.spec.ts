import { TestBed } from '@angular/core/testing';

import { Period } from './period';

describe('Period', () => {
  let service: Period;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Period);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
