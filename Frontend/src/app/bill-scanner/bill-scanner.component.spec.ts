import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BillScannerComponent } from './bill-scanner.component';

describe('BillScannerComponent', () => {
  let component: BillScannerComponent;
  let fixture: ComponentFixture<BillScannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BillScannerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BillScannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
