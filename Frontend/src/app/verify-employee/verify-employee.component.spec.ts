import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VerifyEmployeeComponent } from './verify-employee.component';

describe('VerifyEmployeeComponent', () => {
  let component: VerifyEmployeeComponent;
  let fixture: ComponentFixture<VerifyEmployeeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VerifyEmployeeComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(VerifyEmployeeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
