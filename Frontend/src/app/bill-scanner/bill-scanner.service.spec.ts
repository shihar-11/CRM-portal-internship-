import { TestBed } from '@angular/core/testing';

import { BillScannerService } from './bill-scanner.service';

describe('BillScannerService', () => {
  let service: BillScannerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BillScannerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
