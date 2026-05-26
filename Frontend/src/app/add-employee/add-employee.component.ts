import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AppStateService } from '../app-state.service';
import { LeadService } from '../lead.service';
import { NotificationService } from '../notification.service';

@Component({
  selector: 'app-add-employee',
  templateUrl: './add-employee.component.html',
  styleUrls: ['./add-employee.component.css']
})
export class AddEmployeeComponent implements OnInit, OnDestroy {
  lead = {
    name: '',
    department: '',
    email: '',
    status: 'New',
    source: '',
    notes: ''
  };

  statuses: string[] = ['New', 'Contacted', 'Qualified', 'Rejected', 'Converted'];
  sources: string[] = ['Website', 'Referral', 'Social Media', 'Direct', 'Other'];

  constructor(
    private leadService: LeadService, 
    private router: Router,
    private notificationService: NotificationService,
    private appStateService: AppStateService
  ) { }

  ngOnInit(): void {
    if (!localStorage.getItem('auth')) {
      this.router.navigate(['/login']);
      return;
    }

    const tempData = this.leadService.getTempLead();
    if (tempData) {
      this.lead = { ...tempData };
    } else if (this.appStateService.hasComponentState('AddEmployeeComponent')) {
      this.lead = this.appStateService.getComponentState('AddEmployeeComponent').lead;
    }
  }

  ngOnDestroy(): void {
    this.appStateService.setComponentState('AddEmployeeComponent', {
      lead: this.lead
    });
  }

  review(formValid: boolean | null) {
    if (formValid) {
      this.leadService.setTempLead(this.lead);
      this.router.navigate(['/verify-employee']);
    } else {
      this.notificationService.showError('Please fill out all required fields correctly.');
    }
  }

  cancel() {
    this.leadService.clearTempLead();
    this.appStateService.clearComponentState('AddEmployeeComponent');
    this.router.navigate(['/dashboard']);
  }
}
